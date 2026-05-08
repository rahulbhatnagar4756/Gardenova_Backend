import { getDB } from "../../core/config/db";
// import { FieldIndex } from "../../interface";




// import {
//   IAnswerType1or2,
//   IPartnerRecommendation,
//   // IPlantRecommendation,
//   // ISubmitAnswer,
//   // IUserAnswer,
// } from "../../interface/answer";
/**
 * Builds a descriptive reason for recommending partners based on the user's location
 * and their selected preferences.
 *
 * @param address - The user's selected address.
 * @param address.city - The city selected by the user.
 * @param address.state - The state selected by the user.
 * @param matchedOptions - A list of selected options that influenced the recommendation.
 * @returns A human-readable string explaining why the partner was recommended.
 */


export interface IUserAnswer {
  questionId?: string;
  type?: string;
  selectedOption?: string;
}

export interface IPlantRecommendation {
  species_id: number;
  species_name: string;
  genus_name: string | null;
  family_name: string | null;
  common_name: string | null;
  image_url: string | null;
  plant_type: string | null;
  growth_habit: string | null;
  edible: boolean | null;
  edible_part: string | null;
  vegetable: boolean | null;
  whyRecommended: string[];
  matchScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION → FIELD INDEX MAP  (0-based, matches survey question order)
//
//  Q1 (index 0): Space type       — Where do you want to plant?
//  Q2 (index 1): Sunlight         — How much sunlight?
//  Q3 (index 2): Goal             — Main gardening goal?
//  Q4 (index 3): Watering         — How often can you water?
//  Q5 (index 4): Climate          — Climate / weather type?
//  Q6 (index 5): Experience       — Gardening experience level?
// ─────────────────────────────────────────────────────────────────────────────

enum FieldIndex {
  space_type = 0,
  sunlight   = 1,
  goal       = 2,
  watering   = 3,
  climate    = 4,
  experience = 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE WEIGHTS
// Tune these to change how much each question influences the final ranking.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  goal:            35, // Most important — what the user actually wants to grow
  climate:         30, // Second — plants must be proven to grow in that zone
  space_type:      25, // Third — plant form must fit the physical space
  watering:        20, // Fourth — matches care commitment level
  sunlight:        15, // Fifth — light availability
  experience:      10, // Sixth — beginner vs. advanced complexity
  has_image:        5, // Bonus — prefer plants with photos
  has_common_name:  5, // Bonus — prefer well-documented species
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// INDIA CLIMATE ZONES → LAT / LON BOUNDING BOXES
//
// Plants observed within these coordinate ranges are likely adapted
// to that climate. Multiple rows per species in the table represent
// real field observations across India.
//
//  Tropical / Humid  → South India coast, Northeast, Andaman
//  Dry / Arid        → Rajasthan, Gujarat, interior Deccan plateau
//  Temperate / Mild  → North Indian plains, Himalayan foothills
//  Cold / Seasonal   → J&K, Himachal, Uttarakhand, Sikkim high-altitude
// ─────────────────────────────────────────────────────────────────────────────

interface ClimateBounds {
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

const INDIA_CLIMATE_BOUNDS = {
  tropical:  { lat_min: 8,  lat_max: 23, lon_min: 74, lon_max: 97 },
  dry:       { lat_min: 20, lat_max: 30, lon_min: 68, lon_max: 78 },
  temperate: { lat_min: 26, lat_max: 35, lon_min: 74, lon_max: 82 },
  cold:      { lat_min: 32, lat_max: 37, lon_min: 74, lon_max: 80 },
} satisfies Record<string, ClimateBounds>;
/**
 * Converts a user-selected climate description
 * into a supported India climate zone key.
 *
 * @param selectedOption - Climate option selected by the user
 * @returns Climate zone key
 */
function parseClimateKey(selectedOption: string): keyof typeof INDIA_CLIMATE_BOUNDS {
  const v = selectedOption.toLowerCase();
  if (v.includes("tropical") || v.includes("humid")) return "tropical";
  if (v.includes("dry")      || v.includes("arid"))  return "dry";
  if (v.includes("cold")     || v.includes("season")) return "cold";
  return "temperate"; // safe default for most of India
}

// ─────────────────────────────────────────────────────────────────────────────
// Q1 SPACE TYPE → plant_type + growth_habit keywords
// ─────────────────────────────────────────────────────────────────────────────

interface SpaceProfile {
  plantTypes:   string[];
  growthHabits: string[];
  label:        string;
}

const SPACE_PROFILES = {
  home_garden: {
    plantTypes:   ["Tree", "Shrub", "Herb", "Grass", "Forb"],
    growthHabits: ["Erect", "Spreading", "Climbing"],
    label:        "home garden",
  },
  balcony: {
    plantTypes:   ["Herb", "Shrub", "Vine", "Succulent", "Forb"],
    growthHabits: ["Erect", "Climbing", "Trailing"],
    label:        "balcony or terrace",
  },
  indoor: {
    plantTypes:   ["Herb", "Shrub", "Succulent", "Fern", "Forb"],
    growthHabits: ["Erect", "Rosette", "Trailing"],
    label:        "indoor space",
  },
  corporate: {
    plantTypes:   ["Tree", "Shrub", "Palm", "Grass"],
    growthHabits: ["Erect", "Spreading"],
    label:        "corporate outdoor area",
  },
} satisfies Record<string, SpaceProfile>;
/**
 * Resolves the user's space description
 * into a predefined space profile.
 *
 * @param selectedOption - User-selected space description
 * @returns Matching space profile
 */
function resolveSpaceProfile(selectedOption: string): SpaceProfile {
  const v = selectedOption.toLowerCase();
  if (v.includes("balcony") || v.includes("terrace") || v.includes("pot")) return SPACE_PROFILES.balcony;
  if (v.includes("indoor")  || v.includes("window")  || v.includes("shelf") || v.includes("living")) return SPACE_PROFILES.indoor;
  if (v.includes("corporate") || v.includes("office")) return SPACE_PROFILES.corporate;
  return SPACE_PROFILES.home_garden;
}

// ─────────────────────────────────────────────────────────────────────────────
// Q3 GOAL → scoring SQL  (edible, plant_type, growth_habit checks)
// ─────────────────────────────────────────────────────────────────────────────

interface ScoringProfile {
  scoreSql: string;
  label:    string;
}

/**
 * Builds a scoring profile based on the user's gardening goal.
 *
 * Generates SQL scoring logic to prioritize plants
 * matching the selected preference.
 *
 * @param selectedOption - User-selected gardening goal
 * @returns Plant scoring profile
 */
function buildGoalProfile(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.goal;

  if (v.includes("food") || v.includes("vegetable") || v.includes("edible") || v.includes("herb")) {
    return {
      scoreSql: `CASE
        WHEN (edible = TRUE AND vegetable = TRUE)           THEN ${w}
        WHEN (edible = TRUE OR  vegetable = TRUE)           THEN ${Math.floor(w * 0.7)}
        WHEN (plant_type ILIKE '%Herb%')                    THEN ${Math.floor(w * 0.4)}
        ELSE 0 END`,
      label: "grow food",
    };
  }

  if (v.includes("bloom") || v.includes("flower") || v.includes("color")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Flower%' OR plant_type ILIKE '%Orchid%' OR plant_type ILIKE '%Ornamental%') THEN ${w}
        WHEN (plant_type ILIKE '%Shrub%'  OR plant_type ILIKE '%Forb%')                                      THEN ${Math.floor(w * 0.6)}
        WHEN (plant_type ILIKE '%Herb%')                                                                      THEN ${Math.floor(w * 0.4)}
        ELSE 0 END`,
      label: "beautiful blooms",
    };
  }

  if (v.includes("green") || v.includes("foliage") || v.includes("calm") || v.includes("privacy")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type   ILIKE '%Tree%'     OR plant_type   ILIKE '%Fern%')      THEN ${w}
        WHEN (plant_type   ILIKE '%Shrub%'    OR plant_type   ILIKE '%Bamboo%')    THEN ${Math.floor(w * 0.7)}
        WHEN (growth_habit ILIKE '%Climbing%' OR growth_habit ILIKE '%Spreading%') THEN ${Math.floor(w * 0.5)}
        ELSE 0 END`,
      label: "lush greenery",
    };
  }

  if (v.includes("low") || v.includes("minimal") || v.includes("easy") || v.includes("effort")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Succulent%' OR plant_type ILIKE '%Cactus%')        THEN ${w}
        WHEN (plant_type ILIKE '%Shrub%'     OR plant_type ILIKE '%Tree%')          THEN ${Math.floor(w * 0.6)}
        WHEN (plant_type ILIKE '%Grass%'     OR plant_type ILIKE '%Graminoid%')     THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "low-maintenance",
    };
  }

  return { scoreSql: `${Math.floor(w * 0.2)}`, label: "general gardening" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Q4 WATERING → plant type / drought tolerance inference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a scoring profile based on the user's watering preference.
 *
 * Infers suitable plant types using plant category,
 * edible traits, and growth habits.
 *
 * @param selectedOption - User-selected watering frequency
 * @returns Plant scoring profile
 */
function buildWateringProfile(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.watering;

  if (v.includes("daily")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Herb%' OR vegetable = TRUE OR edible = TRUE) THEN ${w}
        WHEN (plant_type ILIKE '%Fern%' OR plant_type ILIKE '%Flower%')       THEN ${Math.floor(w * 0.7)}
        ELSE ${Math.floor(w * 0.3)} END`,
      label: "daily watering — water-loving plants",
    };
  }

  if (v.includes("2") || v.includes("3") || v.includes("few") || v.includes("twice")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Shrub%' OR plant_type ILIKE '%Herb%'  OR plant_type ILIKE '%Grass%') THEN ${w}
        WHEN (plant_type ILIKE '%Tree%'  OR plant_type ILIKE '%Forb%')                                THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.4)} END`,
      label: "moderate watering",
    };
  }

  if (v.includes("week") || v.includes("weekend") || v.includes("occasional")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Tree%'  OR plant_type ILIKE '%Shrub%')    THEN ${w}
        WHEN (plant_type ILIKE '%Grass%' OR plant_type ILIKE '%Bamboo%')   THEN ${Math.floor(w * 0.7)}
        WHEN (plant_type ILIKE '%Herb%')                                   THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.3)} END`,
      label: "weekly watering",
    };
  }

  if (v.includes("rare") || v.includes("forget") || v.includes("travel")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Succulent%' OR plant_type ILIKE '%Cactus%')     THEN ${w}
        WHEN (plant_type ILIKE '%Tree%'      OR plant_type ILIKE '%Shrub%')      THEN ${Math.floor(w * 0.7)}
        WHEN (plant_type ILIKE '%Grass%'     OR plant_type ILIKE '%Graminoid%')  THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "drought-tolerant / low-water plants",
    };
  }

  return { scoreSql: `${Math.floor(w * 0.3)}`, label: "moderate watering" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Q2 SUNLIGHT → plant type inferences
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a scoring profile based on the user's sunlight availability.
 *
 * Infers suitable plant types using plant categories
 * and light tolerance characteristics.
 *
 * @param selectedOption - User-selected sunlight condition
 * @returns Plant scoring profile
 */
function buildSunlightProfile(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.sunlight;

  if (v.includes("full") || v.includes("6+") || v.includes("direct")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Tree%'  OR plant_type ILIKE '%Grass%' OR plant_type ILIKE '%Graminoid%') THEN ${w}
        WHEN (edible = TRUE OR vegetable = TRUE)                                                           THEN ${Math.floor(w * 0.8)}
        WHEN (plant_type ILIKE '%Shrub%' OR plant_type ILIKE '%Forb%')                                    THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "full sun (6+ hours)",
    };
  }

  if (v.includes("partial") || v.includes("3") || v.includes("some shade")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Herb%'  OR plant_type ILIKE '%Shrub%' OR plant_type ILIKE '%Fern%') THEN ${w}
        WHEN (plant_type ILIKE '%Tree%'  OR plant_type ILIKE '%Forb%')                               THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.4)} END`,
      label: "partial sun / light shade",
    };
  }

  if (v.includes("shade") || v.includes("less than 3") || v.includes("mostly")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Fern%'  OR plant_type ILIKE '%Moss%')  THEN ${w}
        WHEN (plant_type ILIKE '%Herb%'  OR plant_type ILIKE '%Shrub%') THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "mostly shade / low light",
    };
  }

  if (v.includes("artificial") || v.includes("no natural")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Herb%' OR plant_type ILIKE '%Succulent%' OR plant_type ILIKE '%Fern%') THEN ${w}
        WHEN (plant_type ILIKE '%Shrub%')                                                               THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "artificial / grow-light",
    };
  }

  return { scoreSql: `${Math.floor(w * 0.4)}`, label: "moderate light" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Q6 EXPERIENCE → plant complexity hints
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Builds a scoring profile based on the user's gardening experience.
 *
 * Prioritizes beginner-friendly plants for new gardeners,
 * while experienced users receive broader recommendations.
 *
 * @param selectedOption - User-selected experience level
 * @returns Plant scoring profile
 */
function buildExperienceProfile(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.experience;

  if (v.includes("beginner") || v.includes("never") || v.includes("total")) {
    return {
      scoreSql: `CASE
        WHEN (plant_type ILIKE '%Herb%' OR plant_type ILIKE '%Succulent%')          THEN ${w}
        WHEN (plant_type ILIKE '%Shrub%' OR plant_type ILIKE '%Grass%')             THEN ${Math.floor(w * 0.7)}
        WHEN (vegetable = TRUE)                                                      THEN ${Math.floor(w * 0.6)}
        WHEN (plant_type ILIKE '%Tree%')                                             THEN ${Math.floor(w * 0.3)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "beginner-friendly",
    };
  }

  if (v.includes("casual") || v.includes("mixed") || v.includes("tried")) {
    return {
      scoreSql: `${Math.floor(w * 0.6)}`, // neutral — most plants are fine
      label: "intermediate gardener",
    };
  }

  // Experienced — all plants welcome, flat bonus
  return {
    scoreSql: `${w}`,
    label: "all plants suitable",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WHY RECOMMENDED — human-readable explanations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds human-readable reasons for why a plant was recommended.
 *
 * @param plant - Plant record
 * @param labels - Scoring labels used in recommendation logic
 * @param labels.spaceLabel
 * @param labels.goalLabel
 * @param labels.wateringLabel
 * @param labels.sunlightLabel
 * @param labels.climateLabel
 * @param labels.experienceLabel
 * @returns Array of short explanation strings
 */
function buildWhyRecommended(
  plant: Record<string, unknown>,
  labels: {
    spaceLabel?:      string;
    goalLabel?:       string;
    wateringLabel?:   string;
    sunlightLabel?:   string;
    climateLabel?:    string;
    experienceLabel?: string;
  }
): string[] {
  const why: string[] = [];

  // ── Goal ───────────────────────────────────────────────────────────────────
  if (labels.goalLabel) {
    switch (labels.goalLabel) {
      case "grow food": {
        const parts = [
          plant.edible    ? "edible"   : null,
          plant.vegetable ? "vegetable": null,
          plant.edible_part ? `edible parts: ${plant.edible_part}` : null,
        ].filter(Boolean).join(" · ");
        why.push(`Great for growing food — ${parts || "edible plant"}`);
        break;
      }
      case "beautiful blooms":
        why.push("Valued for ornamental beauty — adds colour to any garden");
        break;
      case "lush greenery": {
        const habit = plant.growth_habit as string | null;
        why.push(`Provides lush greenery${habit ? ` — ${habit.toLowerCase()} habit` : ""}`);
        break;
      }
      case "low-maintenance":
        why.push("Low-maintenance — thrives with minimal intervention");
        break;
      default:
        why.push("Matches your gardening goal");
    }
  }

  // ── Space ──────────────────────────────────────────────────────────────────
  if (labels.spaceLabel) {
    const type = plant.plant_type as string | null;
    why.push(
      `Well-suited for ${labels.spaceLabel}` +
      (type ? ` — grows as a ${type.toLowerCase()}` : "")
    );
  }

  // ── Climate ────────────────────────────────────────────────────────────────
  if (labels.climateLabel) {
    why.push(
      `Proven to grow in ${labels.climateLabel} conditions — observation data confirms presence in this Indian climate zone`
    );
  }

  // ── Watering ───────────────────────────────────────────────────────────────
  if (labels.wateringLabel) {
    why.push(`Matches your care schedule — ${labels.wateringLabel}`);
  }

  // ── Sunlight ───────────────────────────────────────────────────────────────
  if (labels.sunlightLabel) {
    why.push(`Suited for ${labels.sunlightLabel}`);
  }

  // ── Experience ─────────────────────────────────────────────────────────────
  if (labels.experienceLabel && labels.experienceLabel !== "all plants suitable") {
    why.push(
      `${labels.experienceLabel.charAt(0).toUpperCase() + labels.experienceLabel.slice(1)} — a good match for your experience level`
    );
  }

  if (why.length === 0) why.push("Matches your plant preferences");
  return why;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates scored plant recommendations from the `plant_observations` table
 * using the user's 6-question survey answers.
 *
 * Strategy:
 *  1. Each answer builds a CASE WHEN SQL fragment that assigns a partial score.
 *  2. All fragments are summed into a single `match_score` expression.
 *  3. Because the table holds one row per GBIF observation (many rows per
 *     species), we deduplicate with DISTINCT ON (species_id), keeping the
 *     observation row that scores highest.
 *  4. If fewer than MIN_RESULTS species are returned, a fallback query fills
 *     in well-documented species with images.
 *
 * @param answers - Array of IUserAnswer indexed 0–5 matching FieldIndex enum.
 * @returns Array of up to 10 IPlantRecommendation objects sorted by matchScore.
 */
export const getRecommendedPlants = async (
  answers: (IUserAnswer | null)[]
): Promise<IPlantRecommendation[]> => {
  const client    = await getDB();
  const LIMIT       = 10;
  const MIN_RESULTS =  5;
  const TABLE       = "plantstable"; // ← replace with your actual table name

  // ── Shared mutable state for parameterized query builder ───────────────────
  const scoreFragments: string[]  = [];
  const queryParams:    unknown[] = [];
  let   paramIdx = 1;

  const labels: Parameters<typeof buildWhyRecommended>[1] = {};

 /**
 * Helper: produces a CASE WHEN … THEN score ELSE 0 END expression
 * using ILIKE $N placeholders. Mutates queryParams and paramIdx.
 *
 * @param column - DB column to match against
 * @param keywords - list of keywords used for ILIKE matching
 * @param score - score returned when a match is found
 * @returns SQL CASE WHEN expression
 */
  function ilikeCaseWhen(column: string, keywords: string[], score: number): string {
    const clauses = keywords.map((kw) => {
      queryParams.push(`%${kw}%`);
      return `${column} ILIKE $${paramIdx++}`;
    });
    return `CASE WHEN (${clauses.join(" OR ")}) THEN ${score} ELSE 0 END`;
  }

  // ── Q1: Space Type ──────────────────────────────────────────────────────────
  const spaceAns = answers[FieldIndex.space_type];
  if (spaceAns?.selectedOption?.trim()) {
    const profile = resolveSpaceProfile(spaceAns.selectedOption);
    labels.spaceLabel = profile.label;

    if (profile.plantTypes.length > 0) {
      scoreFragments.push(
        ilikeCaseWhen("plant_type", profile.plantTypes, WEIGHTS.space_type)
      );
    }
    if (profile.growthHabits.length > 0) {
      scoreFragments.push(
        ilikeCaseWhen("growth_habit", profile.growthHabits, Math.floor(WEIGHTS.space_type / 2))
      );
    }
  }

  // ── Q2: Sunlight ────────────────────────────────────────────────────────────
  const sunlightAns = answers[FieldIndex.sunlight];
  if (sunlightAns?.selectedOption?.trim()) {
    const profile = buildSunlightProfile(sunlightAns.selectedOption);
    labels.sunlightLabel = profile.label;
    scoreFragments.push(profile.scoreSql);
  }

  // ── Q3: Goal ────────────────────────────────────────────────────────────────
  const goalAns = answers[FieldIndex.goal];
  if (goalAns?.selectedOption?.trim()) {
    const profile = buildGoalProfile(goalAns.selectedOption);
    labels.goalLabel = profile.label;
    scoreFragments.push(profile.scoreSql);
  }

  // ── Q4: Watering ────────────────────────────────────────────────────────────
  const wateringAns = answers[FieldIndex.watering];
  if (wateringAns?.selectedOption?.trim()) {
    const profile = buildWateringProfile(wateringAns.selectedOption);
    labels.wateringLabel = profile.label;
    scoreFragments.push(profile.scoreSql);
  }

  // ── Q5: Climate — uses lat / lon bounding box ───────────────────────────────
  const climateAns = answers[FieldIndex.climate];
  if (climateAns?.selectedOption?.trim()) {
    const key    = parseClimateKey(climateAns.selectedOption);
    const bounds = INDIA_CLIMATE_BOUNDS[key];
    labels.climateLabel = climateAns.selectedOption.trim();

    // Assign full weight when the observation falls inside the climate zone.
    // Assign half weight when it's "close" (within 3° latitude buffer).
    const latMinPh  = `$${paramIdx++}`;  queryParams.push(bounds.lat_min);
    const latMaxPh  = `$${paramIdx++}`;  queryParams.push(bounds.lat_max);
    const lonMinPh  = `$${paramIdx++}`;  queryParams.push(bounds.lon_min);
    const lonMaxPh  = `$${paramIdx++}`;  queryParams.push(bounds.lon_max);
    const latMinBuf = `$${paramIdx++}`;  queryParams.push(bounds.lat_min - 3);
    const latMaxBuf = `$${paramIdx++}`;  queryParams.push(bounds.lat_max + 3);

    scoreFragments.push(`
      CASE
        WHEN (lat BETWEEN ${latMinPh}  AND ${latMaxPh}  AND lon BETWEEN ${lonMinPh} AND ${lonMaxPh})
          THEN ${WEIGHTS.climate}
        WHEN (lat BETWEEN ${latMinBuf} AND ${latMaxBuf} AND lon BETWEEN ${lonMinPh} AND ${lonMaxPh})
          THEN ${Math.floor(WEIGHTS.climate / 2)}
        ELSE 0
      END`);
  }

  // ── Q6: Experience ──────────────────────────────────────────────────────────
  const expAns = answers[FieldIndex.experience];
  if (expAns?.selectedOption?.trim()) {
    const profile = buildExperienceProfile(expAns.selectedOption);
    labels.experienceLabel = profile.label;
    scoreFragments.push(profile.scoreSql);
  }

  // ── Universal quality bonuses ───────────────────────────────────────────────
  scoreFragments.push(
    `CASE WHEN (image_url IS NOT NULL AND image_url <> '') THEN ${WEIGHTS.has_image} ELSE 0 END`
  );
  scoreFragments.push(
    `CASE WHEN (COALESCE(common_name, inat_common_name, trefle_common_name) IS NOT NULL) THEN ${WEIGHTS.has_common_name} ELSE 0 END`
  );

  // ── Compose total score expression ──────────────────────────────────────────
  const scoreExpr = scoreFragments.length > 0
    ? `(${scoreFragments.join("\n      + ")})`
    : "0";

  // ── Main query ──────────────────────────────────────────────────────────────
  // Step 1 (CTE "scored"): compute match_score for every row.
  // Step 2 (CTE "deduped"): DISTINCT ON species_id keeps the single best row
  //         per species (highest score; prefer row with image on tie).
  // Step 3: re-order the deduplicated results by match_score DESC.
  //
  // RANDOM() in the final ORDER BY prevents deterministic ties so users see
  // variety when they re-run the quiz with identical answers.
  //
  const limitPh = `$${paramIdx++}`;
  queryParams.push(LIMIT);

  const mainQuery = `
    WITH scored AS (
      SELECT
        species_id,
        species_name,
        genus_name,
        family_name,
        COALESCE(common_name, inat_common_name, trefle_common_name) AS common_name,
        image_url,
        plant_type,
        growth_habit,
        edible,
        edible_part,
        vegetable,
        lat,
        lon,
        ${scoreExpr} AS match_score
      FROM ${TABLE}
      WHERE species_name IS NOT NULL
        AND species_name <> ''
    ),
    deduped AS (
      SELECT DISTINCT ON (species_id) *
      FROM scored
      ORDER BY
        species_id,
        match_score DESC,
        (image_url IS NOT NULL AND image_url <> '') DESC
    )
    SELECT *
    FROM deduped
    ORDER BY match_score DESC, RANDOM()
    LIMIT ${limitPh};
  `;

  let rows: Record<string, unknown>[] = [];

  try {
    const result = await client.query(mainQuery, queryParams);
    rows = result.rows;
  } catch (err) {
    console.error("[getRecommendedPlants] Main query failed:", err);
  }

  // ── Fallback: fill remaining slots with documented species ──────────────────
  if (rows.length < MIN_RESULTS) {
    try {
      const needed       = LIMIT - rows.length;
      const existingIds  = new Set(rows.map((r) => r.species_id));
      const excludePh    = [...existingIds].map((_, i) => `$${i + 2}`).join(", ");

      const fallbackQuery = `
        SELECT DISTINCT ON (species_id)
          species_id,
          species_name,
          genus_name,
          family_name,
          COALESCE(common_name, inat_common_name, trefle_common_name) AS common_name,
          image_url,
          plant_type,
          growth_habit,
          edible,
          edible_part,
          vegetable,
          lat,
          lon,
          0 AS match_score
        FROM ${TABLE}
        WHERE species_name IS NOT NULL
          AND species_name <> ''
          AND image_url    IS NOT NULL
          AND image_url    <> ''
          ${existingIds.size > 0 ? `AND species_id NOT IN (${excludePh})` : ""}
        ORDER BY species_id, (image_url IS NOT NULL) DESC
        LIMIT $1;
      `;

      const fbParams: unknown[] = [needed, ...[...existingIds]];
      const fbResult = await client.query(fallbackQuery, fbParams);

      for (const r of fbResult.rows) {
        if (rows.length >= LIMIT) break;
        rows.push(r);
      }
    } catch (err) {
      console.error("[getRecommendedPlants] Fallback query failed:", err);
    }
  }

  // ── Map to output type ──────────────────────────────────────────────────────
  return rows.map((plant) => ({
    species_id:    plant.species_id   as number,
    species_name:  plant.species_name as string,
    genus_name:   (plant.genus_name   as string)  ?? null,
    family_name:  (plant.family_name  as string)  ?? null,
    common_name:  (plant.common_name  as string)  ?? null,
    image_url:    (plant.image_url    as string)  ?? null,
    plant_type:   (plant.plant_type   as string)  ?? null,
    growth_habit: (plant.growth_habit as string)  ?? null,
    edible:       (plant.edible       as boolean) ?? null,
    edible_part:  (plant.edible_part  as string)  ?? null,
    vegetable:    (plant.vegetable    as boolean) ?? null,
    matchScore:   (plant.match_score  as number)  ?? 0,
    whyRecommended: buildWhyRecommended(plant, labels),
  }));
};