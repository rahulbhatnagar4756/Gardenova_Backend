import {
  findLatestSurveyAnswers,
  SurveyAnswerRow,
} from "./gardenInsightsRepository";

export interface GardenInsightSlice {
  key:
    | "lightFit"
    | "waterConsistency"
    | "experienceReadiness"
    | "spaceUtilization"
    | "growthPotential";
  label: string;
  percent: number;
  score: number;
}

export interface GardenInsightsResult {
  hasSurvey: boolean;
  totalPercent: number;
  chart: GardenInsightSlice[];
}

const ZERO_CHART: GardenInsightSlice[] = [
  { key: "lightFit", label: "Light Fit", percent: 0, score: 0 },
  { key: "waterConsistency", label: "Water Consistency", percent: 0, score: 0 },
  { key: "experienceReadiness", label: "Experience Readiness", percent: 0, score: 0 },
  { key: "spaceUtilization", label: "Space Utilization", percent: 0, score: 0 },
  { key: "growthPotential", label: "Growth Potential", percent: 0, score: 0 },
];

/** Matches `questions.order` in the onboarding quiz. */
const QUESTION_ORDER = {
  space: 1,
  sunlight: 2,
  goal: 3,
  watering: 4,
  climate: 5,
  experience: 6,
} as const;

type SpaceKind = "indoor" | "balcony" | "garden" | "office" | null;
type LightKind = "full" | "partial" | "shade" | "artificial" | null;
type WaterKind = "daily" | "regular" | "weekly" | "rare" | null;
type GoalKind = "food" | "flowers" | "greenery" | "easy" | null;
type ClimateKind = "tropical" | "dry" | "temperate" | "cold" | null;
type ExperienceKind = "beginner" | "casual" | "experienced" | null;

/**
 * Returns true when the text contains any of the given keywords.
 *
 * @param text - Source text
 * @param keywords - Keywords to look for
 * @returns Whether any keyword is present
 */
function hasAny(text: string, keywords: string[]): boolean {
  const value = text.toLowerCase();
  return keywords.some((keyword) => value.includes(keyword));
}

/**
 * Picks the survey answer for a 1-based question order.
 *
 * @param answers - Survey rows
 * @param order - Question order
 * @returns Answer text or empty string
 */
function answerByOrder(answers: SurveyAnswerRow[], order: number): string {
  return (
    answers.find((item) => Number(item.order) === order)?.answer ?? ""
  ).toLowerCase();
}

/**
 * Converts 0–1 scores into integer percents that sum to 100.
 *
 * @param rawScores - Raw 0–1 scores
 * @returns Integer percents
 */
function toPiePercents(rawScores: number[]): number[] {
  const sum = rawScores.reduce((total, value) => total + value, 0);
  if (sum <= 0) {
    return rawScores.map(() => 0);
  }

  const exact = rawScores.map((value) => (value / sum) * 100);
  const floors = exact.map((value) => Math.floor(value));
  const leftover = 100 - floors.reduce((total, value) => total + value, 0);

  const ranked = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < leftover; i += 1) {
    const target = ranked[i % ranked.length];
    if (target) {
      floors[target.index] = (floors[target.index] ?? 0) + 1;
    }
  }

  return floors;
}

/**
 * Classifies the selected space option.
 *
 * @param answer - Space answer
 * @returns Space class
 */
function spaceKind(answer: string): SpaceKind {
  if (!answer) return null;
  if (hasAny(answer, ["indoor", "window", "shelf", "living"])) return "indoor";
  if (hasAny(answer, ["balcony", "terrace", "pot"])) return "balcony";
  if (hasAny(answer, ["corporate", "office"])) return "office";
  return "garden";
}

/**
 * Classifies the selected sunlight option.
 *
 * @param answer - Sunlight answer
 * @returns Light class
 */
function lightKind(answer: string): LightKind {
  if (!answer) return null;
  if (hasAny(answer, ["artificial", "no natural", "grow light"])) return "artificial";
  if (hasAny(answer, ["full", "6+", "direct"])) return "full";
  if (hasAny(answer, ["partial", "3", "some shade"])) return "partial";
  if (hasAny(answer, ["shade", "less than 3", "mostly", "low light"])) return "shade";
  return null;
}

/**
 * Classifies the selected watering option.
 *
 * @param answer - Watering answer
 * @returns Water class
 */
function waterKind(answer: string): WaterKind {
  if (!answer) return null;
  if (hasAny(answer, ["daily"])) return "daily";
  if (hasAny(answer, ["2", "3", "few", "twice"])) return "regular";
  if (hasAny(answer, ["week", "weekend", "occasional"])) return "weekly";
  if (hasAny(answer, ["rare", "forget", "travel"])) return "rare";
  return null;
}

/**
 * Classifies the selected goal option.
 *
 * @param answer - Goal answer
 * @returns Goal class
 */
function goalKind(answer: string): GoalKind {
  if (!answer) return null;
  if (hasAny(answer, ["food", "vegetable", "edible", "herb"])) return "food";
  if (hasAny(answer, ["bloom", "flower", "color"])) return "flowers";
  if (hasAny(answer, ["green", "foliage", "calm", "privacy"])) return "greenery";
  if (hasAny(answer, ["low", "minimal", "easy", "effort"])) return "easy";
  return null;
}

/**
 * Classifies the selected climate option.
 *
 * @param answer - Climate answer
 * @returns Climate class
 */
function climateKind(answer: string): ClimateKind {
  if (!answer) return null;
  if (hasAny(answer, ["tropical", "humid"])) return "tropical";
  if (hasAny(answer, ["dry", "arid"])) return "dry";
  if (hasAny(answer, ["cold", "season"])) return "cold";
  return "temperate";
}

/**
 * Classifies the selected experience option.
 *
 * @param answer - Experience answer
 * @returns Experience class
 */
function experienceKind(answer: string): ExperienceKind {
  if (!answer) return null;
  if (hasAny(answer, ["beginner", "never", "total"])) return "beginner";
  if (hasAny(answer, ["casual", "mixed", "tried"])) return "casual";
  if (hasAny(answer, ["experience", "expert", "advanced"])) return "experienced";
  return "casual";
}

/**
 * Light Fit: does available light match what that space type can typically provide.
 *
 * @param sunlight - Sunlight answer
 * @param space - Space answer
 * @returns 0–1
 */
function scoreLightFit(sunlight: string, space: string): number {
  const light = lightKind(sunlight);
  const spaceType = spaceKind(space);
  if (!light || !spaceType) return 0.4;

  const table: Record<Exclude<SpaceKind, null>, Record<Exclude<LightKind, null>, number>> = {
    indoor: { full: 0.4, partial: 0.9, shade: 1, artificial: 1 },
    balcony: { full: 0.85, partial: 1, shade: 0.55, artificial: 0.45 },
    garden: { full: 1, partial: 0.75, shade: 0.45, artificial: 0.25 },
    office: { full: 0.9, partial: 0.7, shade: 0.4, artificial: 0.35 },
  };

  return table[spaceType][light];
}

/**
 * Water Consistency: how reliable the user's watering commitment is.
 *
 * @param watering - Watering-frequency answer
 * @returns 0–1
 */
function scoreWaterConsistency(watering: string): number {
  const water = waterKind(watering);
  if (water === "daily") return 1;
  if (water === "regular") return 0.85;
  if (water === "weekly") return 0.6;
  if (water === "rare") return 0.3;
  return 0.45;
}

/**
 * Experience Readiness: maps skill level directly to a readiness score.
 *
 * @param experience - Experience answer
 * @returns 0–1
 */
function scoreExperienceReadiness(experience: string): number {
  const level = experienceKind(experience);
  if (level === "experienced") return 1;
  if (level === "casual") return 0.7;
  if (level === "beginner") return 0.35;
  return 0.45;
}

/**
 * Space Utilization: how well the chosen space supports the user's goal.
 *
 * @param space - Space answer
 * @param goal - Goal answer
 * @returns 0–1
 */
function scoreSpaceUtilization(space: string, goal: string): number {
  const spaceType = spaceKind(space);
  const goalType = goalKind(goal);
  if (!spaceType || !goalType) return 0.4;

  const table: Record<
    Exclude<SpaceKind, null>,
    Record<Exclude<GoalKind, null>, number>
  > = {
    indoor: { food: 0.55, flowers: 0.75, greenery: 1, easy: 0.9 },
    balcony: { food: 0.8, flowers: 0.9, greenery: 0.85, easy: 0.85 },
    garden: { food: 1, flowers: 0.95, greenery: 0.95, easy: 0.8 },
    office: { food: 0.4, flowers: 0.65, greenery: 0.85, easy: 0.9 },
  };

  return table[spaceType][goalType];
}

/**
 * Growth Potential: combined climate, watering, and sunlight favorability.
 *
 * @param climate - Climate answer
 * @param watering - Watering answer
 * @param sunlight - Sunlight answer
 * @returns 0–1
 */
function scoreGrowthPotential(
  climate: string,
  watering: string,
  sunlight: string
): number {
  const climateType = climateKind(climate);
  const water = waterKind(watering);
  const light = lightKind(sunlight);

  let climateScore = 0.55;
  if (climateType === "tropical") climateScore = 0.9;
  else if (climateType === "temperate") climateScore = 0.8;
  else if (climateType === "dry") climateScore = 0.65;
  else if (climateType === "cold") climateScore = 0.5;

  let waterScore = 0.5;
  if (water === "daily") waterScore = 0.95;
  else if (water === "regular") waterScore = 0.85;
  else if (water === "weekly") waterScore = 0.6;
  else if (water === "rare") waterScore = 0.35;

  let lightScore = 0.5;
  if (light === "full") lightScore = 0.95;
  else if (light === "partial") lightScore = 0.75;
  else if (light === "shade") lightScore = 0.45;
  else if (light === "artificial") lightScore = 0.55;

  return climateScore * 0.4 + waterScore * 0.3 + lightScore * 0.3;
}

/**
 * Builds pie-chart insight scores from the user's onboarding answers only.
 * Does not use recommended plants or My Plants.
 *
 * @param userId - Authenticated user id
 * @returns Pie-chart slices totaling 100 when a survey exists, otherwise 0
 */
export async function getGardenInsights(
  userId: string
): Promise<GardenInsightsResult> {
  const answers = await findLatestSurveyAnswers(userId);

  if (answers.length === 0) {
    return {
      hasSurvey: false,
      totalPercent: 0,
      chart: ZERO_CHART,
    };
  }

  const space = answerByOrder(answers, QUESTION_ORDER.space);
  const sunlight = answerByOrder(answers, QUESTION_ORDER.sunlight);
  const goal = answerByOrder(answers, QUESTION_ORDER.goal);
  const watering = answerByOrder(answers, QUESTION_ORDER.watering);
  const climate = answerByOrder(answers, QUESTION_ORDER.climate);
  const experience = answerByOrder(answers, QUESTION_ORDER.experience);

  const raw = [
    scoreLightFit(sunlight, space),
    scoreWaterConsistency(watering),
    scoreExperienceReadiness(experience),
    scoreSpaceUtilization(space, goal),
    scoreGrowthPotential(climate, watering, sunlight),
  ];

  const pieShares = toPiePercents(raw);

  const chart: GardenInsightSlice[] = ZERO_CHART.map((slice, index) => ({
    ...slice,
    percent: pieShares[index] ?? 0,
    score: Math.round((raw[index] ?? 0) * 100),
  }));

  return {
    hasSurvey: true,
    totalPercent: 100,
    chart,
  };
}
