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
  matchPercent: number;
  matchedCount: number;
}

export interface GardenInsightsResult {
  plantCount: number;
  hasPlants: boolean;
  totalPercent: number;
  chart: GardenInsightSlice[];
}

const ZERO_CHART: GardenInsightSlice[] = [
  { key: "lightFit", label: "Light Fit", percent: 0, matchPercent: 0, matchedCount: 0 },
  { key: "waterConsistency", label: "Water Consistency", percent: 0, matchPercent: 0, matchedCount: 0 },
  { key: "experienceReadiness", label: "Experience Readiness", percent: 0, matchPercent: 0, matchedCount: 0 },
  { key: "spaceUtilization", label: "Space Utilization", percent: 0, matchPercent: 0, matchedCount: 0 },
  { key: "growthPotential", label: "Growth Potential", percent: 0, matchPercent: 0, matchedCount: 0 },
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

type LightLevel = "full" | "partial" | "shade" | "artificial" | null;
type WaterLevel = "frequent" | "average" | "minimum" | null;
type CareLevel = "low" | "medium" | "high" | null;
type ExperienceLevel = "beginner" | "casual" | "experienced" | null;

/**
 * Normalizes catalog text so JSON arrays and snake_case still match.
 *
 * @param value - Raw catalog field
 * @returns Lowercase plain text
 */
function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[{}"[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads the user's sunlight class from the onboarding answer.
 *
 * @param answer - Sunlight answer
 * @returns Light class or null
 */
function userLightLevel(answer: string): LightLevel {
  if (!answer) return null;
  if (hasAny(answer, ["artificial", "no natural", "grow light"])) return "artificial";
  if (hasAny(answer, ["full", "6+", "direct"])) return "full";
  if (hasAny(answer, ["partial", "3", "some shade"])) return "partial";
  if (hasAny(answer, ["shade", "less than 3", "mostly", "low light"])) return "shade";
  return null;
}

/**
 * Reads sunlight classes listed on the plant catalog record.
 *
 * @param sunlight - Catalog sunlight text
 * @returns Light classes the plant can tolerate
 */
function plantLightLevels(sunlight: string): LightLevel[] {
  const value = normalizeCatalogText(sunlight);
  const levels: LightLevel[] = [];
  if (value.includes("full sun") || value.includes("fullsun")) levels.push("full");
  if (value.includes("part") || value.includes("filtered") || value.includes("dappled")) {
    levels.push("partial");
  }
  if (value.includes("shade") || value.includes("low light")) levels.push("shade");
  return [...new Set(levels)];
}

/**
 * Distance between two light classes, used for partial credit.
 *
 * @param userLevel - User light class
 * @param plantLevel - Plant light class
 * @returns 0–2
 */
function lightDistance(userLevel: LightLevel, plantLevel: LightLevel): number {
  const order: LightLevel[] = ["shade", "partial", "full"];
  const userIndex = order.indexOf(userLevel);
  const plantIndex = order.indexOf(plantLevel);
  if (userIndex < 0 || plantIndex < 0) return 2;
  return Math.abs(userIndex - plantIndex);
}

/**
 * Reads the user's watering habit from the onboarding answer.
 *
 * @param answer - Watering answer
 * @returns Water class or null
 */
function userWaterLevel(answer: string): WaterLevel {
  if (!answer) return null;
  if (hasAny(answer, ["daily"])) return "frequent";
  if (hasAny(answer, ["2", "3", "few", "twice"])) return "average";
  if (hasAny(answer, ["week", "weekend", "occasional"])) return "minimum";
  if (hasAny(answer, ["rare", "forget", "travel"])) return "minimum";
  return null;
}

/**
 * Reads the plant catalog watering class.
 *
 * @param watering - Catalog watering text
 * @param droughtTolerant - Drought-tolerant flag
 * @returns Water class or null
 */
function plantWaterLevel(
  watering: string,
  droughtTolerant: boolean | null
): WaterLevel {
  const value = normalizeCatalogText(watering);
  if (value.includes("frequent") || value.includes("often") || value.includes("regular")) {
    return "frequent";
  }
  if (value.includes("average") || value.includes("moderate") || value.includes("medium")) {
    return "average";
  }
  if (value.includes("minimum") || value.includes("none") || value.includes("low") || droughtTolerant === true) {
    return "minimum";
  }
  return droughtTolerant === false ? "average" : null;
}

/**
 * Reads the plant care difficulty from catalog fields.
 *
 * @param plant - Plant catalog row
 * @returns Care class or null
 */
function plantCareLevel(plant: UserPlantInsightRow): CareLevel {
  const care = normalizeCatalogText(`${plant.careLevel ?? ""} ${plant.maintenance ?? ""}`);
  if (hasAny(care, ["high", "hard", "difficult", "advanced"])) return "high";
  if (hasAny(care, ["medium", "moderate", "average"])) return "medium";
  if (hasAny(care, ["low", "easy", "beginner"])) return "low";
  return null;
}

/**
 * Reads the user's experience class from the onboarding answer.
 *
 * @param answer - Experience answer
 * @returns Experience class or null
 */
function userExperienceLevel(answer: string): ExperienceLevel {
  if (!answer) return null;
  if (hasAny(answer, ["beginner", "never", "total"])) return "beginner";
  if (hasAny(answer, ["casual", "mixed", "tried"])) return "casual";
  if (hasAny(answer, ["experience", "expert", "advanced"])) return "experienced";
  return "casual";
}

/**
 * Light score with adjacent-class credit. Missing catalog light still gets a modest score.
 *
 * @param sunlightAnswer - Onboarding sunlight answer
 * @param plant - Plant on the user's account
 * @returns 0–1
 */
function scoreLightFit(
  sunlightAnswer: string,
  plant: UserPlantInsightRow
): number {
  const userLevel = userLightLevel(sunlightAnswer);
  if (!userLevel) return 0.45;

  if (userLevel === "artificial") {
    if (plant.indoor === true) return 1;
    const levels = plantLightLevels(plant.sunlight ?? "");
    if (levels.includes("shade") || levels.includes("partial")) return 0.65;
    return 0.35;
  }

  const plantLevels = plantLightLevels(plant.sunlight ?? "");
  if (plantLevels.length === 0) {
    return plant.indoor === true && userLevel !== "full" ? 0.55 : 0.4;
  }

  const best = Math.min(...plantLevels.map((level) => lightDistance(userLevel, level)));
  if (best === 0) return 1;
  if (best === 1) return 0.65;
  return 0.25;
}

/**
 * Water score from plant watering needs vs user habit.
 * Reminders add a small bonus; they are not required.
 *
 * @param wateringAnswer - Onboarding watering answer
 * @param plant - Plant on the user's account
 * @returns 0–1
 */
function scoreWaterConsistency(
  wateringAnswer: string,
  plant: UserPlantInsightRow
): number {
  const userLevel = userWaterLevel(wateringAnswer);
  const plantLevel = plantWaterLevel(plant.watering ?? "", plant.droughtTolerant);

  let needMatch = 0.45;
  if (userLevel && plantLevel) {
    if (userLevel === plantLevel) needMatch = 0.85;
    else if (
      (userLevel === "frequent" && plantLevel === "average") ||
      (userLevel === "average" && plantLevel !== "minimum") ||
      (userLevel === "minimum" && plantLevel === "average")
    ) {
      needMatch = 0.55;
    } else {
      needMatch = 0.25;
    }
  } else if (plantLevel) {
    needMatch = 0.5;
  }

  if (plant.wateringNotificationEnabled) {
    needMatch = Math.min(1, needMatch + 0.15);
    if (plant.nextWateredAt) {
      const next = new Date(plant.nextWateredAt).getTime();
      if (!Number.isNaN(next) && next < Date.now()) {
        needMatch = Math.max(0.2, needMatch - 0.2);
      }
    }
  }

  return needMatch;
}

/**
 * Experience score: beginners prefer easy plants, but harder plants still get credit.
 *
 * @param experienceAnswer - Onboarding experience answer
 * @param plant - Plant on the user's account
 * @returns 0–1
 */
function scoreExperienceReadiness(
  experienceAnswer: string,
  plant: UserPlantInsightRow
): number {
  const experience = userExperienceLevel(experienceAnswer) ?? "casual";
  const care = plantCareLevel(plant) ?? "medium";

  if (experience === "beginner") {
    if (care === "low") return 1;
    if (care === "medium") return 0.6;
    return 0.3;
  }

  if (experience === "casual") {
    if (care === "high") return 0.55;
    return 0.9;
  }

  return 0.95;
}

/**
 * Space score with partial credit when a plant is a reasonable fit.
 *
 * @param spaceAnswer - Onboarding space answer
 * @param plant - Plant on the user's account
 * @returns 0–1
 */
function scoreSpaceUtilization(
  spaceAnswer: string,
  plant: UserPlantInsightRow
): number {
  const type = normalizeCatalogText(plant.type ?? "");
  const indoor = plant.indoor === true;
  const maxSize = Number.parseFloat(plant.dimensionMaxValue ?? "");
  const isCompact = Number.isFinite(maxSize) && maxSize > 0 && maxSize <= 150;
  const isTree = type.includes("tree");

  if (!spaceAnswer) return indoor ? 0.5 : 0.45;

  if (hasAny(spaceAnswer, ["indoor", "window", "shelf", "living"])) {
    if (indoor) return 1;
    if (isCompact || type.includes("herb")) return 0.55;
    return 0.25;
  }

  if (hasAny(spaceAnswer, ["balcony", "terrace", "pot"])) {
    if (indoor || isCompact) return 1;
    if (type.includes("herb") || type.includes("shrub") || type.includes("vine") || type.includes("climber")) {
      return 0.85;
    }
    if (isTree) return 0.3;
    return 0.5;
  }

  if (hasAny(spaceAnswer, ["corporate", "office"])) {
    if (isTree || type.includes("shrub") || type.includes("palm")) return 1;
    if (indoor) return 0.45;
    return 0.4;
  }

  if (isTree || type.includes("shrub") || type.includes("herb") || type.includes("grass")) return 1;
  if (indoor) return 0.45;
  return 0.55;
}

/**
 * Growth score from goal, climate, and plant vigor. Climate mismatch no longer zeros the score.
 *
 * @param goalAnswer - Onboarding goal answer
 * @param climateAnswer - Onboarding climate answer
 * @param plant - Plant on the user's account
 * @returns 0–1
 */
function scoreGrowthPotential(
  goalAnswer: string,
  climateAnswer: string,
  plant: UserPlantInsightRow
): number {
  const type = normalizeCatalogText(plant.type ?? "");
  let goal = 0.45;

  if (hasAny(goalAnswer, ["food", "vegetable", "edible", "herb"])) {
    if (plant.edibleFruit || plant.edibleLeaf || type.includes("herb")) goal = 1;
    else goal = 0.35;
  } else if (hasAny(goalAnswer, ["bloom", "flower", "color"])) {
    goal = plant.flowers ? 1 : 0.4;
  } else if (hasAny(goalAnswer, ["green", "foliage", "calm", "privacy"])) {
    goal = plant.leaf || type.includes("tree") || type.includes("shrub") || indoorLike(plant)
      ? 0.95
      : 0.5;
  } else if (hasAny(goalAnswer, ["low", "minimal", "easy", "effort"])) {
    const care = plantCareLevel(plant);
    if (care === "low" || plant.droughtTolerant) goal = 1;
    else if (care === "medium") goal = 0.6;
    else goal = 0.4;
  }

  let climate = 0.6;
  if (hasAny(climateAnswer, ["tropical", "humid"])) {
    climate = plant.tropical ? 1 : 0.45;
  } else if (hasAny(climateAnswer, ["dry", "arid"])) {
    climate = plant.droughtTolerant ? 1 : 0.45;
  } else if (hasAny(climateAnswer, ["cold", "season"])) {
    climate = plant.tropical ? 0.4 : 0.8;
  }

  const growthRate = normalizeCatalogText(plant.growthRate ?? "");
  let vigor = 0.55;
  if (hasAny(growthRate, ["high", "fast"])) vigor = 1;
  else if (hasAny(growthRate, ["moderate", "medium", "average"])) vigor = 0.7;
  else if (hasAny(growthRate, ["low", "slow"])) vigor = 0.45;

  return goal * 0.5 + climate * 0.3 + vigor * 0.2;
}

/**
 * Returns true when the plant is typically grown indoors.
 *
 * @param plant - Plant catalog row
 * @returns Whether the plant is indoor
 */
function indoorLike(plant: UserPlantInsightRow): boolean {
  return plant.indoor === true;
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

  const scorers: Array<(plant: UserPlantInsightRow) => number> = [
    (plant: UserPlantInsightRow): number => scoreLightFit(sunlightAnswer, plant),
    (plant: UserPlantInsightRow): number =>
      scoreWaterConsistency(wateringAnswer, plant),
    (plant: UserPlantInsightRow): number =>
      scoreExperienceReadiness(experienceAnswer, plant),
    (plant: UserPlantInsightRow): number =>
      scoreSpaceUtilization(spaceAnswer, plant),
    (plant: UserPlantInsightRow): number =>
      scoreGrowthPotential(goalAnswer, climateAnswer, plant),
  ];

  const matchRates = scorers.map((scoreFn) => averageScore(plants, scoreFn));
  const pieShares = toPiePercents(matchRates);

  const chart: GardenInsightSlice[] = ZERO_CHART.map((slice, index) => {
    const scoreFn = scorers[index];
    const rate = matchRates[index] ?? 0;
    const matchedCount = scoreFn
      ? plants.filter((plant) => scoreFn(plant) >= 0.5).length
      : 0;
    return {
      ...slice,
      percent: pieShares[index] ?? 0,
      matchPercent: Math.round(rate * 100),
      matchedCount,
    };
  });

  return {
    plantCount: plants.length,
    hasPlants: true,
    totalPercent: 100,
    chart,
  };
}
