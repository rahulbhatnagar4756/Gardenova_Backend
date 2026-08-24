import {
  findLatestSurveyAnswers,
  findUserPlantsForInsights,
  SurveyAnswerRow,
  UserPlantInsightRow,
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
}

export interface GardenInsightsResult {
  plantCount: number;
  hasPlants: boolean;
  totalPercent: number;
  chart: GardenInsightSlice[];
}

const ZERO_CHART: GardenInsightSlice[] = [
  { key: "lightFit", label: "Light Fit", percent: 0 },
  { key: "waterConsistency", label: "Water Consistency", percent: 0 },
  { key: "experienceReadiness", label: "Experience Readiness", percent: 0 },
  { key: "spaceUtilization", label: "Space Utilization", percent: 0 },
  { key: "growthPotential", label: "Growth Potential", percent: 0 },
];

const QUESTION_ORDER = {
  space: 1,
  sunlight: 2,
  goal: 3,
  watering: 4,
  climate: 5,
  experience: 6,
} as const;

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
 * Averages per-plant scores into a 0–1 value.
 *
 * @param plants - User plants
 * @param scoreFn - Per-plant scorer
 * @returns Average score
 */
function averageScore(
  plants: UserPlantInsightRow[],
  scoreFn: (plant: UserPlantInsightRow) => number
): number {
  if (plants.length === 0) {
    return 0;
  }
  const total = plants.reduce((sum, plant) => sum + scoreFn(plant), 0);
  return total / plants.length;
}

/**
 * Converts raw 0–1 scores into integer percents that sum to 100.
 *
 * @param rawScores - Five raw scores
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
 * Scores how well a plant matches the user's light conditions (0–1).
 *
 * @param sunlightAnswer - Onboarding sunlight answer
 * @param plant - Plant catalog row
 * @returns Fit score
 */
function scoreLightFit(
  sunlightAnswer: string,
  plant: UserPlantInsightRow
): number {
  const sunlight = (plant.sunlight ?? "").toLowerCase();
  const indoor = plant.indoor === true;

  if (!sunlightAnswer) {
    return indoor || sunlight.length > 0 ? 0.45 : 0.2;
  }

  if (hasAny(sunlightAnswer, ["artificial", "no natural", "grow light"])) {
    return indoor ? 1 : sunlight.includes("shade") ? 0.55 : 0.2;
  }

  if (hasAny(sunlightAnswer, ["full", "6+", "direct"])) {
    if (sunlight.includes("full sun")) return 1;
    if (sunlight.includes("part")) return 0.5;
    if (sunlight.includes("shade")) return 0.15;
    return 0.3;
  }

  if (hasAny(sunlightAnswer, ["partial", "3", "some shade"])) {
    if (sunlight.includes("part")) return 1;
    if (sunlight.includes("full sun") || sunlight.includes("filtered")) return 0.6;
    if (sunlight.includes("shade")) return 0.45;
    return 0.4;
  }

  if (hasAny(sunlightAnswer, ["shade", "less than 3", "mostly", "low light"])) {
    if (sunlight.includes("full shade")) return 1;
    if (sunlight.includes("shade")) return 0.8;
    if (sunlight.includes("part")) return 0.5;
    return 0.2;
  }

  return indoor ? 0.5 : 0.4;
}

/**
 * Scores watering habit vs plant needs, plus reminder consistency (0–1).
 *
 * @param wateringAnswer - Onboarding watering answer
 * @param plant - Plant catalog and reminder row
 * @returns Fit score
 */
function scoreWaterConsistency(
  wateringAnswer: string,
  plant: UserPlantInsightRow
): number {
  const watering = (plant.watering ?? "").toLowerCase();
  const drought = plant.droughtTolerant === true;

  let needMatch = 0.4;
  if (hasAny(wateringAnswer, ["daily"])) {
    if (watering.includes("frequent")) needMatch = 1;
    else if (watering.includes("average")) needMatch = 0.5;
    else if (watering.includes("minimum") || watering.includes("none")) needMatch = 0.1;
    else needMatch = 0.35;
  } else if (hasAny(wateringAnswer, ["2", "3", "few", "twice"])) {
    if (watering.includes("average")) needMatch = 1;
    else if (watering.includes("frequent")) needMatch = 0.7;
    else if (watering.includes("minimum")) needMatch = 0.4;
    else needMatch = 0.5;
  } else if (hasAny(wateringAnswer, ["week", "weekend", "occasional"])) {
    if (drought && watering.includes("minimum")) needMatch = 1;
    else if (watering.includes("minimum")) needMatch = 0.8;
    else if (drought) needMatch = 0.7;
    else if (watering.includes("average")) needMatch = 0.4;
    else needMatch = 0.25;
  } else if (hasAny(wateringAnswer, ["rare", "forget", "travel"])) {
    if (drought && watering.includes("minimum")) needMatch = 1;
    else if (drought || watering.includes("minimum") || watering.includes("none")) {
      needMatch = 0.85;
    } else if (watering.includes("average")) needMatch = 0.2;
    else needMatch = 0.1;
  }

  let habit = plant.wateringNotificationEnabled ? 0.85 : 0.45;
  const now = Date.now();

  if (plant.nextWateredAt) {
    const next = new Date(plant.nextWateredAt).getTime();
    if (!Number.isNaN(next) && next < now) {
      habit *= 0.55;
    }
  }

  if (plant.lastWateredAt) {
    const last = new Date(plant.lastWateredAt).getTime();
    const daysSince = (now - last) / (1000 * 60 * 60 * 24);
    const expectedDays = plant.wateringReminderFrequency || 7;
    if (daysSince <= expectedDays) {
      habit = Math.max(habit, 0.9);
    } else if (daysSince > expectedDays * 2) {
      habit = Math.min(habit, 0.35);
    }
  }

  return needMatch * 0.65 + habit * 0.35;
}

/**
 * Scores whether plant difficulty matches the user's experience (0–1).
 *
 * @param experienceAnswer - Onboarding experience answer
 * @param plant - Plant catalog row
 * @returns Fit score
 */
function scoreExperienceReadiness(
  experienceAnswer: string,
  plant: UserPlantInsightRow
): number {
  const care = `${plant.careLevel ?? ""} ${plant.maintenance ?? ""}`.toLowerCase();
  const isLow = care.includes("low");
  const isMedium = care.includes("medium") || care.includes("moderate");
  const isHigh = care.includes("high");

  if (!experienceAnswer) {
    if (isLow) return 0.7;
    if (isMedium) return 0.5;
    return 0.35;
  }

  if (hasAny(experienceAnswer, ["beginner", "never", "total"])) {
    if (isLow) return 0.9;
    if (isMedium) return 0.4;
    if (isHigh) return 0.12;
    return 0.3;
  }

  if (hasAny(experienceAnswer, ["casual", "mixed", "tried"])) {
    if (isLow || isMedium) return 1;
    if (isHigh) return 0.55;
    return 0.7;
  }

  return 0.9;
}

/**
 * Scores whether the plant form fits the user's growing space (0–1).
 *
 * @param spaceAnswer - Onboarding space answer
 * @param plant - Plant catalog row
 * @returns Fit score
 */
function scoreSpaceUtilization(
  spaceAnswer: string,
  plant: UserPlantInsightRow
): number {
  const type = (plant.type ?? "").toLowerCase();
  const indoor = plant.indoor === true;
  const maxSize = Number.parseFloat(plant.dimensionMaxValue ?? "");
  const isCompact = Number.isFinite(maxSize) && maxSize > 0 && maxSize <= 120;

  if (!spaceAnswer) {
    return indoor || type.length > 0 ? 0.45 : 0.25;
  }

  if (hasAny(spaceAnswer, ["indoor", "window", "shelf", "living"])) {
    if (indoor) return 1;
    if (type.includes("herb") || type.includes("shrub")) return 0.5;
    return 0.15;
  }

  if (hasAny(spaceAnswer, ["balcony", "terrace", "pot"])) {
    if (indoor || isCompact) return 1;
    if (type.includes("herb") || type.includes("shrub")) return 0.8;
    if (type.includes("vine") || type.includes("climber")) return 0.65;
    if (type.includes("tree")) return 0.2;
    return 0.4;
  }

  if (hasAny(spaceAnswer, ["corporate", "office"])) {
    if (type.includes("tree")) return 1;
    if (type.includes("shrub") || type.includes("palm")) return 0.7;
    if (indoor) return 0.25;
    return 0.35;
  }

  if (type.includes("tree") || type.includes("shrub")) return 1;
  if (type.includes("herb") || type.includes("grass")) return 0.8;
  if (indoor) return 0.35;
  return 0.5;
}

/**
 * Scores goal + climate + growth rate as overall growth potential (0–1).
 *
 * @param goalAnswer - Onboarding goal answer
 * @param climateAnswer - Onboarding climate answer
 * @param plant - Plant catalog row
 * @returns Fit score
 */
function scoreGrowthPotential(
  goalAnswer: string,
  climateAnswer: string,
  plant: UserPlantInsightRow
): number {
  let goal = 0.35;
  if (!goalAnswer) {
    goal = 0.4;
  } else if (hasAny(goalAnswer, ["food", "vegetable", "edible", "herb"])) {
    if (plant.edibleFruit && plant.edibleLeaf) goal = 1;
    else if (plant.edibleFruit || plant.edibleLeaf) goal = 0.8;
    else if ((plant.type ?? "").toLowerCase().includes("herb")) goal = 0.6;
    else goal = 0.15;
  } else if (hasAny(goalAnswer, ["bloom", "flower", "color"])) {
    if (plant.flowers) goal = 0.95;
    else if ((plant.type ?? "").toLowerCase().includes("ornamental")) goal = 0.5;
    else goal = 0.15;
  } else if (hasAny(goalAnswer, ["green", "foliage", "calm", "privacy"])) {
    const type = (plant.type ?? "").toLowerCase();
    if (plant.leaf && (type.includes("tree") || type.includes("shrub"))) goal = 1;
    else if (plant.leaf || type.includes("tree") || type.includes("shrub")) goal = 0.7;
    else goal = 0.3;
  } else if (hasAny(goalAnswer, ["low", "minimal", "easy", "effort"])) {
    const care = `${plant.careLevel ?? ""} ${plant.maintenance ?? ""}`.toLowerCase();
    if (care.includes("low") && plant.droughtTolerant) goal = 1;
    else if (care.includes("low")) goal = 0.8;
    else if (plant.droughtTolerant) goal = 0.6;
    else goal = 0.25;
  }

  let climate = 0.5;
  if (hasAny(climateAnswer, ["tropical", "humid"])) {
    climate = plant.tropical ? 1 : 0.35;
  } else if (hasAny(climateAnswer, ["dry", "arid"])) {
    climate = plant.droughtTolerant ? 1 : 0.3;
  } else if (hasAny(climateAnswer, ["cold", "season"])) {
    climate = plant.tropical ? 0.25 : 0.7;
  }

  const growthRate = (plant.growthRate ?? "").toLowerCase();
  let vigor = 0.5;
  if (growthRate.includes("high") || growthRate.includes("fast")) vigor = 1;
  else if (growthRate.includes("moderate") || growthRate.includes("medium")) vigor = 0.7;
  else if (growthRate.includes("low") || growthRate.includes("slow")) vigor = 0.4;

  return goal * 0.5 + climate * 0.3 + vigor * 0.2;
}

/**
 * Builds pie-chart garden scores from onboarding answers and the user's plants.
 * Returns all zeros when the user has not added any plants.
 *
 * @param userId - Authenticated user id
 * @returns Pie-chart slices totaling 100 when plants exist, otherwise 0
 */
export async function getGardenInsights(
  userId: string
): Promise<GardenInsightsResult> {
  const [answers, plants] = await Promise.all([
    findLatestSurveyAnswers(userId),
    findUserPlantsForInsights(userId),
  ]);

  if (plants.length === 0) {
    return {
      plantCount: 0,
      hasPlants: false,
      totalPercent: 0,
      chart: ZERO_CHART,
    };
  }

  const sunlightAnswer = answerByOrder(answers, QUESTION_ORDER.sunlight);
  const wateringAnswer = answerByOrder(answers, QUESTION_ORDER.watering);
  const experienceAnswer = answerByOrder(answers, QUESTION_ORDER.experience);
  const spaceAnswer = answerByOrder(answers, QUESTION_ORDER.space);
  const goalAnswer = answerByOrder(answers, QUESTION_ORDER.goal);
  const climateAnswer = answerByOrder(answers, QUESTION_ORDER.climate);

  const raw = [
    averageScore(plants, (plant) => scoreLightFit(sunlightAnswer, plant)),
    averageScore(plants, (plant) => scoreWaterConsistency(wateringAnswer, plant)),
    averageScore(plants, (plant) =>
      scoreExperienceReadiness(experienceAnswer, plant)
    ),
    averageScore(plants, (plant) => scoreSpaceUtilization(spaceAnswer, plant)),
    averageScore(plants, (plant) =>
      scoreGrowthPotential(goalAnswer, climateAnswer, plant)
    ),
  ];

  const percents = toPiePercents(raw);
  const chart: GardenInsightSlice[] = ZERO_CHART.map((slice, index) => ({
    ...slice,
    percent: percents[index] ?? 0,
  }));

  return {
    plantCount: plants.length,
    hasPlants: true,
    totalPercent: 100,
    chart,
  };
}
