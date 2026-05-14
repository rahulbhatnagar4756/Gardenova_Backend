// plant-recommendation.service.ts
// Scoring engine for the 6-question plant quiz.
// Adapted for the perenual-style `plants` table — no lat/lon needed.

import { getDB } from "../../core/config/db";
import { IPlantRecommendation } from "../../interface/answer";
import { IUserAnswer } from "./answerController";
import env from "../../core/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD INDEX  (matches question_order 1–6 from the survey)
// ─────────────────────────────────────────────────────────────────────────────

export enum FieldIndex {
  space_type = 0,
  sunlight   = 1,
  goal       = 2,
  watering   = 3,
  climate    = 4,
  experience = 5,
}

export const TOTAL_QUESTIONS = 6;

// ─────────────────────────────────────────────────────────────────────────────
// SCORE WEIGHTS
// Tune these to change how much each question influences the final ranking.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  goal:            35, // what the user wants to grow
  climate:         30, // plant must survive the local climate
  space_type:      25, // plant form must fit the physical space
  watering:        20, // matches care commitment
  sunlight:        15, // light availability
  experience:      10, // beginner vs advanced complexity
  has_image:        5, // bonus — prefer plants with photos
  has_common_name:  5, // bonus — prefer well-documented species
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED RETURN TYPE FOR SCORING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface ScoringProfile {
  sql:   string; // raw SQL CASE WHEN fragment (no params — safe values only)
  label: string; // human-readable label for whyRecommended
}

/**
 * Builds a scoring profile for plant recommendations based on the
 * user's available growing space or environment.
 *
 * The function returns:
 * - `sql`: A SQL CASE expression used to calculate weighted relevance scores.
 * - `label`: A human-readable label describing the detected space type.
 *
 * Matching is performed using keyword detection on the provided option string.
 *
 * Supported categories:
 * - Balcony / terrace / pots
 * - Indoor / window / shelf / living room
 * - Corporate / office outdoor spaces
 * - Default: home garden
 *
 * @param {string} selectedOption
 * User-selected space description (e.g. "Balcony", "Indoor shelf", "Office garden").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement for ranking
 * - `label`: normalized space category label
 *
 * @example
 * buildSpaceScore("Balcony Pots");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "balcony or terrace"
 * // }
 *
 * @example
 * buildSpaceScore("Indoor Window");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "indoor space"
 * // }
 */
function buildSpaceScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.space_type;

  if (v.includes("balcony") || v.includes("terrace") || v.includes("pot")) {
    return {
      sql: `CASE
        WHEN (indoor = TRUE)                                                          THEN ${w}
        WHEN (type ILIKE '%herb%'   OR type ILIKE '%shrub%')                         THEN ${Math.floor(w * 0.8)}
        WHEN (type ILIKE '%vine%'   OR type ILIKE '%climber%')                       THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "balcony or terrace",
    };
  }

  if (v.includes("indoor") || v.includes("window") || v.includes("shelf") || v.includes("living")) {
    return {
      sql: `CASE
        WHEN (indoor = TRUE)                                                          THEN ${w}
        WHEN (type ILIKE '%herb%'   OR type ILIKE '%shrub%')                         THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "indoor space",
    };
  }

  if (v.includes("corporate") || v.includes("office")) {
    return {
      sql: `CASE
        WHEN (type ILIKE '%tree%')                                                    THEN ${w}
        WHEN (type ILIKE '%shrub%'  OR type ILIKE '%palm%')                          THEN ${Math.floor(w * 0.7)}
        WHEN (type ILIKE '%grass%'  OR type ILIKE '%ornamental%')                    THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "corporate outdoor area",
    };
  }

  // home garden — default
  return {
    sql: `CASE
      WHEN (type ILIKE '%tree%'   OR type ILIKE '%shrub%')                           THEN ${w}
      WHEN (type ILIKE '%herb%'   OR type ILIKE '%grass%')                           THEN ${Math.floor(w * 0.8)}
      WHEN (type ILIKE '%vine%'   OR type ILIKE '%climber%')                         THEN ${Math.floor(w * 0.6)}
      ELSE ${Math.floor(w * 0.4)} END`,
    label: "home garden",
  };
}

/**
 * Builds a scoring profile based on the sunlight conditions
 * available in the user's growing environment.
 *
 * The function maps user-provided sunlight descriptions into
 * weighted SQL scoring logic used for plant recommendation ranking.
 *
 * Returned object:
 * - `sql`: SQL CASE expression for scoring sunlight compatibility
 * - `label`: normalized sunlight category label
 *
 * Supported sunlight categories:
 * - Full sun / direct sunlight
 * - Partial sun / light shade
 * - Mostly shade / low light
 * - Artificial or grow-light environments
 * - Default moderate light fallback
 *
 * Keyword matching is performed using simple substring checks.
 *
 * @param {string} selectedOption
 * User-selected sunlight condition
 * (e.g. "Full Sun", "Partial Shade", "Artificial Light").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement for ranking compatibility
 * - `label`: human-readable sunlight condition label
 *
 * @example
 * buildSunlightScore("Full Sun 6+ Hours");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "full sun (6+ hours)"
 * // }
 *
 * @example
 * buildSunlightScore("Mostly Shade");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "mostly shade / low light"
 * // }
 */
function buildSunlightScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.sunlight;

  if (v.includes("full") || v.includes("6+") || v.includes("direct")) {
    return {
      sql: `CASE
        WHEN (sunlight ILIKE '%full sun%')                                            THEN ${w}
        WHEN (sunlight ILIKE '%part%')                                                THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "full sun (6+ hours)",
    };
  }

  if (v.includes("partial") || v.includes("3") || v.includes("some shade")) {
    return {
      sql: `CASE
        WHEN (sunlight ILIKE '%part shade%' OR sunlight ILIKE '%part sun%')           THEN ${w}
        WHEN (sunlight ILIKE '%full sun%'   OR sunlight ILIKE '%filtered%')           THEN ${Math.floor(w * 0.6)}
        WHEN (sunlight ILIKE '%shade%')                                               THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.3)} END`,
      label: "partial sun / light shade",
    };
  }

  if (v.includes("shade") || v.includes("less than 3") || v.includes("mostly")) {
    return {
      sql: `CASE
        WHEN (sunlight ILIKE '%full shade%')                                          THEN ${w}
        WHEN (sunlight ILIKE '%shade%' AND sunlight NOT ILIKE '%full sun%')           THEN ${Math.floor(w * 0.8)}
        WHEN (sunlight ILIKE '%part%')                                                THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "mostly shade / low light",
    };
  }

  if (v.includes("artificial") || v.includes("no natural")) {
    return {
      sql: `CASE
        WHEN (indoor = TRUE)                                                          THEN ${w}
        WHEN (sunlight ILIKE '%shade%')                                               THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "artificial / grow-light",
    };
  }

  return { sql: `${Math.floor(w * 0.4)}`, label: "moderate light" };
}

 
/**
 * Builds a scoring profile based on the user's gardening goal
 * or desired outcome from growing plants.
 *
 * The function converts user intent into weighted SQL scoring logic
 * used to rank plant recommendations.
 *
 * Returned object:
 * - `sql`: SQL CASE expression for recommendation scoring
 * - `label`: normalized gardening goal label
 *
 * Supported gardening goals:
 * - Growing food / edible plants
 * - Beautiful blooms / flowers
 * - Lush greenery / foliage / privacy
 * - Low-maintenance gardening
 * - Default general gardening fallback
 *
 * Keyword matching is performed using substring checks
 * against the selected option text.
 *
 * @param {string} selectedOption
 * User-selected gardening goal
 * (e.g. "Grow Food", "Beautiful Flowers", "Low Effort Plants").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement used for weighted ranking
 * - `label`: human-readable gardening goal category
 *
 * @example
 * buildGoalScore("Grow Vegetables and Herbs");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "grow food"
 * // }
 *
 * @example
 * buildGoalScore("Low Maintenance Plants");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "low-maintenance"
 * // }
 */
function buildGoalScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.goal;

  if (v.includes("food") || v.includes("vegetable") || v.includes("edible") || v.includes("herb")) {
    return {
      sql: `CASE
        WHEN (edible_fruit = TRUE AND edible_leaf = TRUE)                             THEN ${w}
        WHEN (edible_fruit = TRUE OR  edible_leaf = TRUE OR cuisine = TRUE)           THEN ${Math.floor(w * 0.8)}
        WHEN (type ILIKE '%herb%')                                                    THEN ${Math.floor(w * 0.6)}
        WHEN (medicinal = TRUE)                                                       THEN ${Math.floor(w * 0.3)}
        ELSE 0 END`,
      label: "grow food",
    };
  }

  if (v.includes("bloom") || v.includes("flower") || v.includes("color")) {
    return {
      sql: `CASE
        WHEN (flowers = TRUE AND flowering_season IS NOT NULL AND flowering_season <> '') THEN ${w}
        WHEN (flowers = TRUE)                                                             THEN ${Math.floor(w * 0.8)}
        WHEN (type ILIKE '%ornamental%')                                                  THEN ${Math.floor(w * 0.5)}
        ELSE 0 END`,
      label: "beautiful blooms",
    };
  }

  if (v.includes("green") || v.includes("foliage") || v.includes("calm") || v.includes("privacy")) {
    return {
      sql: `CASE
        WHEN (leaf = TRUE AND (type ILIKE '%tree%' OR type ILIKE '%shrub%'))          THEN ${w}
        WHEN (leaf = TRUE OR type ILIKE '%tree%' OR type ILIKE '%shrub%')             THEN ${Math.floor(w * 0.7)}
        WHEN (type ILIKE '%grass%' OR type ILIKE '%bamboo%')                          THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "lush greenery",
    };
  }

  if (v.includes("low") || v.includes("minimal") || v.includes("easy") || v.includes("effort")) {
    return {
      sql: `CASE
        WHEN (care_level ILIKE '%low%' AND drought_tolerant = TRUE)                   THEN ${w}
        WHEN (care_level ILIKE '%low%' OR  maintenance ILIKE '%low%')                 THEN ${Math.floor(w * 0.8)}
        WHEN (drought_tolerant = TRUE)                                                THEN ${Math.floor(w * 0.6)}
        WHEN (care_level ILIKE '%medium%')                                            THEN ${Math.floor(w * 0.3)}
        ELSE 0 END`,
      label: "low-maintenance",
    };
  }

  return { sql: `${Math.floor(w * 0.2)}`, label: "general gardening" };
}
/**
 * Builds a scoring profile based on the user's preferred
 * watering frequency and maintenance commitment.
 *
 * The function converts watering preferences into weighted
 * SQL scoring logic used to rank compatible plant recommendations.
 *
 * Returned object:
 * - `sql`: SQL CASE expression for compatibility scoring
 * - `label`: normalized watering preference label
 *
 * Supported watering patterns:
 * - Daily watering / water-loving plants
 * - Moderate watering every 2–3 days
 * - Weekly or occasional watering
 * - Rare watering / drought-tolerant plants
 * - Default moderate watering fallback
 *
 * Keyword matching is performed using substring checks
 * against the selected option text.
 *
 * @param {string} selectedOption
 * User-selected watering preference
 * (e.g. "Daily Watering", "Weekend Only", "Rarely Water").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement for weighted recommendation ranking
 * - `label`: human-readable watering preference category
 *
 * @example
 * buildWateringScore("Daily Watering");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "daily watering — water-loving plants"
 * // }
 *
 * @example
 * buildWateringScore("Weekend Watering");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "weekly watering"
 * // }
 */
function buildWateringScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.watering;

  if (v.includes("daily")) {
    return {
      sql: `CASE
        WHEN (watering ILIKE '%frequent%')                                            THEN ${w}
        WHEN (watering ILIKE '%average%')                                             THEN ${Math.floor(w * 0.5)}
        WHEN (watering ILIKE '%minimum%' OR watering ILIKE '%none%')                 THEN 0
        ELSE ${Math.floor(w * 0.3)} END`,
      label: "daily watering — water-loving plants",
    };
  }

  if (v.includes("2") || v.includes("3") || v.includes("few") || v.includes("twice")) {
    return {
      sql: `CASE
        WHEN (watering ILIKE '%average%')                                             THEN ${w}
        WHEN (watering ILIKE '%frequent%')                                            THEN ${Math.floor(w * 0.7)}
        WHEN (watering ILIKE '%minimum%')                                             THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.5)} END`,
      label: "moderate watering — every 2–3 days",
    };
  }

  if (v.includes("week") || v.includes("weekend") || v.includes("occasional")) {
    return {
      sql: `CASE
        WHEN (drought_tolerant = TRUE AND watering ILIKE '%minimum%')                THEN ${w}
        WHEN (watering ILIKE '%minimum%')                                             THEN ${Math.floor(w * 0.8)}
        WHEN (drought_tolerant = TRUE)                                                THEN ${Math.floor(w * 0.7)}
        WHEN (watering ILIKE '%average%')                                             THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.2)} END`,
      label: "weekly watering",
    };
  }

  if (v.includes("rare") || v.includes("forget") || v.includes("travel")) {
    return {
      sql: `CASE
        WHEN (drought_tolerant = TRUE AND watering ILIKE '%minimum%')                THEN ${w}
        WHEN (drought_tolerant = TRUE OR  watering ILIKE '%minimum%')                THEN ${Math.floor(w * 0.8)}
        WHEN (watering ILIKE '%none%')                                                THEN ${w}
        WHEN (watering ILIKE '%average%')                                             THEN ${Math.floor(w * 0.2)}
        ELSE 0 END`,
      label: "drought-tolerant / low-water plants",
    };
  }

  return { sql: `${Math.floor(w * 0.3)}`, label: "moderate watering" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Q5: CLIMATE
// Columns: tropical (bool), drought_tolerant (bool), salt_tolerant (bool)
//          hardiness_min, hardiness_max (int — USDA-style zones)
//          watering (text — proxy for water needs in arid climates)
//
// USDA zone reference used here:
//   Tropical / Humid  → zones 10–13   (India south coast, Andaman, NE)
//   Dry / Arid        → zones 8–11    (Rajasthan, Gujarat, Deccan)
//   Temperate / Mild  → zones 6–10    (North plains, Himalayan foothills)
//   Cold / Seasonal   → zones 4–7     (J&K, Himachal, Uttarakhand)
// ─────────────────────────────────────────────────────────────────────────────

// Safe cast helper used inside SQL strings.
// NULLIF removes empty strings before casting so rows with '' don't throw.
const H_MIN = `NULLIF(hardiness_min, '')::INTEGER`;
const H_MAX = `NULLIF(hardiness_max, '')::INTEGER`;
/**
 * Builds a scoring profile based on the user's climate preference
 * for plant suitability ranking.
 *
 * The function translates climate-related intent into weighted
 * SQL CASE expressions used to score plant compatibility.
 *
 * Returned object:
 * - `sql`: SQL CASE expression used for climate-based scoring
 * - `label`: normalized climate category label
 *
 * Supported climate categories:
 * - Tropical / humid climates
 * - Dry / arid climates
 * - Cold / seasonal climates
 * - Temperate / mild climates (default)
 *
 * The logic uses humidity and hardiness range variables
 * (`H_MIN`, `H_MAX`) along with plant traits such as:
 * - tropical
 * - drought_tolerant
 * - salt_tolerant
 * - watering requirements
 *
 * @param {string} selectedOption
 * User-selected climate preference
 * (e.g. "Tropical", "Dry Climate", "Cold Weather Plants").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement for weighted ranking
 * - `label`: human-readable climate category
 *
 * @example
 * buildClimateScore("Tropical Humid");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "tropical / humid"
 * // }
 *
 * @example
 * buildClimateScore("Dry Arid Climate");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "dry / arid"
 * // }
 */
function buildClimateScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.climate;

  if (v.includes("tropical") || v.includes("humid")) {
    return {
      sql: `CASE
        WHEN (tropical = TRUE AND ${H_MIN} >= 10)                                     THEN ${w}
        WHEN (tropical = TRUE OR  ${H_MIN} >= 10)                                     THEN ${Math.floor(w * 0.8)}
        WHEN (${H_MIN} >= 8)                                                          THEN ${Math.floor(w * 0.5)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "tropical / humid",
    };
  }

  if (v.includes("dry") || v.includes("arid")) {
    return {
      sql: `CASE
        WHEN (drought_tolerant = TRUE AND salt_tolerant = TRUE)                       THEN ${w}
        WHEN (drought_tolerant = TRUE AND watering ILIKE '%minimum%')                 THEN ${Math.floor(w * 0.9)}
        WHEN (drought_tolerant = TRUE OR  watering ILIKE '%minimum%')                 THEN ${Math.floor(w * 0.7)}
        WHEN (${H_MIN} >= 8 AND ${H_MAX} <= 11)                                      THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "dry / arid",
    };
  }

  if (v.includes("cold") || v.includes("season")) {
    return {
      sql: `CASE
        WHEN (${H_MIN} <= 5)                                                          THEN ${w}
        WHEN (${H_MIN} <= 7)                                                          THEN ${Math.floor(w * 0.7)}
        WHEN (${H_MIN} <= 9)                                                          THEN ${Math.floor(w * 0.4)}
        ELSE ${Math.floor(w * 0.1)} END`,
      label: "cold / seasonal",
    };
  }

  // temperate / mild — default
  return {
    sql: `CASE
      WHEN (${H_MIN} <= 8 AND ${H_MAX} >= 6)                                         THEN ${w}
      WHEN (${H_MIN} <= 10 AND ${H_MAX} >= 5)                                        THEN ${Math.floor(w * 0.7)}
      WHEN (tropical = FALSE OR tropical IS NULL)                                     THEN ${Math.floor(w * 0.4)}
      ELSE ${Math.floor(w * 0.2)} END`,
    label: "temperate / mild",
  };
}

/**
 * Builds a scoring profile based on the user's gardening experience level.
 *
 * The function converts experience-related intent into weighted SQL scoring logic
 * used to rank plant recommendations by difficulty and maintenance requirements.
 *
 * Returned object:
 * - `sql`: SQL CASE expression for experience-based compatibility scoring
 * - `label`: normalized experience category label
 *
 * Supported experience levels:
 * - Beginner / no experience (beginner-friendly plants)
 * - Casual / mixed experience (intermediate gardeners)
 * - Experienced gardeners (no restrictions / full suitability)
 *
 * The logic primarily evaluates:
 * - care_level (low/medium/high)
 * - maintenance difficulty
 *
 * @param {string} selectedOption
 * User-selected gardening experience level
 * (e.g. "Beginner", "Some Experience", "Expert Gardener").
 *
 * @returns {ScoringProfile}
 * A scoring profile containing:
 * - `sql`: SQL CASE statement used for ranking compatibility
 * - `label`: human-readable experience category
 *
 * @example
 * buildExperienceScore("Beginner");
 * // => {
 * //   sql: "CASE WHEN ...",
 * //   label: "beginner-friendly"
 * // }
 *
 * @example
 * buildExperienceScore("Experienced Gardener");
 * // => {
 * //   sql: "all plants suitable",
 * //   label: "all plants suitable"
 * // }
 */
function buildExperienceScore(selectedOption: string): ScoringProfile {
  const v = selectedOption.toLowerCase();
  const w = WEIGHTS.experience;

  if (v.includes("beginner") || v.includes("never") || v.includes("total")) {
    return {
      sql: `CASE
        WHEN (care_level ILIKE '%low%'    AND maintenance ILIKE '%low%')              THEN ${w}
        WHEN (care_level ILIKE '%low%'    OR  maintenance ILIKE '%low%')              THEN ${Math.floor(w * 0.8)}
        WHEN (care_level ILIKE '%medium%' OR  maintenance ILIKE '%moderate%')         THEN ${Math.floor(w * 0.4)}
        WHEN (care_level ILIKE '%high%')                                              THEN ${Math.floor(w * 0.1)}
        ELSE ${Math.floor(w * 0.3)} END`,
      label: "beginner-friendly",
    };
  }

  if (v.includes("casual") || v.includes("mixed") || v.includes("tried")) {
    return {
      sql: `CASE
        WHEN (care_level ILIKE '%low%'    OR  care_level ILIKE '%medium%')            THEN ${w}
        WHEN (care_level ILIKE '%high%')                                              THEN ${Math.floor(w * 0.6)}
        ELSE ${Math.floor(w * 0.7)} END`,
      label: "intermediate gardener",
    };
  }

  // experienced — flat full bonus, all plants welcome
  return { sql: `${w}`, label: "all plants suitable" };
}

/**
 * Generates a human-readable explanation of why a given plant
 * was recommended based on multiple scoring dimensions.
 *
 * This function composes an array of "reason strings" by analyzing:
 * - Plant attributes (e.g. edible, drought tolerant, flowering)
 * - User preference labels (space, goal, watering, sunlight, climate, experience)
 *
 * Each label contributes a contextual explanation that helps
 * users understand recommendation decisions.
 *
 * Returned value:
 * - Array of strings describing recommendation reasons
 *
 * @param {Record<string, unknown>} plant
 * Plant object containing botanical and care-related attributes
 * (e.g. edible_fruit, tropical, flowering_season, care_level).
 *
 * @param {Object} labels
 * Normalized user preference labels used for scoring explanation.
 *
 * @param {string} [labels.spaceLabel]
 * User's selected growing space category.
 *
 * @param {string} [labels.goalLabel]
 * User's gardening goal (e.g. grow food, blooms, greenery).
 *
 * @param {string} [labels.wateringLabel]
 * User's watering preference category.
 *
 * @param {string} [labels.sunlightLabel]
 * User's sunlight condition preference.
 *
 * @param {string} [labels.climateLabel]
 * User's climate preference category.
 *
 * @param {string} [labels.experienceLabel]
 * User's gardening experience level.
 *
 * @returns {string[]}
 * Array of human-readable reasons explaining the recommendation.
 *
 * @example
 * buildWhyRecommended(plant, {
 *   goalLabel: "grow food",
 *   spaceLabel: "balcony or terrace"
 * });
 * // => [
 * //   "Great for growing food — edible fruit · edible leaves",
 * //   "Well-suited for balcony or terrace — grows as a shrub"
 * // ]
 *
 * @example
 * buildWhyRecommended(plant, {});
 * // => ["Matches your plant preferences"]
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
        const traits = [
          plant.edible_fruit ? "edible fruit"       : null,
          plant.edible_leaf  ? "edible leaves"      : null,
          plant.cuisine      ? "used in cuisine"    : null,
          plant.medicinal    ? "medicinal uses"     : null,
        ].filter(Boolean).join(" · ");
        why.push(`Great for growing food — ${traits || "edible plant"}`);
        break;
      }
      case "beautiful blooms":
        why.push(
          `Valued for ornamental beauty` +
          (plant.flowering_season ? ` — blooms: ${plant.flowering_season}` : "")
        );
        break;
      case "lush greenery":
        why.push(
          `Provides lush greenery — ` +
          ((plant.type as string) ?? "foliage plant").toLowerCase()
        );
        break;
      case "low-maintenance":
        why.push(
          `Low-maintenance` +
          (plant.care_level ? ` — care level: ${plant.care_level}` : " — thrives with minimal intervention")
        );
        break;
      default:
        why.push("Matches your gardening goal");
    }
  }

  // ── Space ──────────────────────────────────────────────────────────────────
  if (labels.spaceLabel) {
    why.push(
      `Well-suited for ${labels.spaceLabel}` +
      (plant.type ? ` — grows as a ${(plant.type as string).toLowerCase()}` : "")
    );
  }

  // ── Climate ────────────────────────────────────────────────────────────────
  if (labels.climateLabel) {
    const climateParts = [
      plant.tropical         ? "tropical-adapted"                                         : null,
      plant.drought_tolerant ? "drought-tolerant"                                         : null,
      // eslint-disable-next-line eqeqeq
      plant.hardiness_min != null
        ? `hardiness zones ${plant.hardiness_min}–${plant.hardiness_max}`
        : null,
    ].filter(Boolean).join(", ");
    why.push(
      `Suited to ${labels.climateLabel} climate` +
      (climateParts ? ` — ${climateParts}` : "")
    );
  }

  // ── Watering ───────────────────────────────────────────────────────────────
  if (labels.wateringLabel) {
    why.push(`Matches your watering schedule — ${labels.wateringLabel}`);
  }

  // ── Sunlight ───────────────────────────────────────────────────────────────
  if (labels.sunlightLabel) {
    why.push(`Suited for ${labels.sunlightLabel}`);
  }

  // ── Experience ─────────────────────────────────────────────────────────────
  if (labels.experienceLabel && labels.experienceLabel !== "all plants suitable") {
    why.push(
      `${labels.experienceLabel.charAt(0).toUpperCase()}${labels.experienceLabel.slice(1)}` +
      " — a good match for your experience level"
    );
  }

  if (why.length === 0) why.push("Matches your plant preferences");
  return why;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Converts a local image file path into a public image URL.
 *
 * Example:
 * Input:  "/uploads/plant_00001.jpg"
 * Output: "https://your-domain.com/plant-images/plant_00001.jpg"
 *
 * @param {string | null} localPath - Local filesystem path of the image.
 * @returns {string | null} Public image URL or null if no path is provided.
 */
const toImageUrl = (localPath: string | null): string | null => {
    if (!localPath) return null;
    const filename = localPath.split("/").pop();   // "plant_00001.jpg"
    return `${env.APPDEV_URL}/plant-images/${filename}`;
};



/**
 * Generates scored plant recommendations from the `plants` table
 * using the user's 6-question survey answers.
 *
 * All scoring is done in pure SQL CASE WHEN expressions — no external params
 * are injected into score fragments (only safe integer literals), so there is
 * no SQL-injection risk from the quiz answers. The only bound parameter is
 * the LIMIT placeholder ($1).
 *
 * @param answers - Array of IUserAnswer indexed 0–5 matching FieldIndex enum.
 * @returns Array of up to 10 IPlantRecommendation objects sorted by matchScore.
 */
export const getRecommendedPlants = async (
  answers: (IUserAnswer | null)[]
): Promise<IPlantRecommendation[]> => {
  const client      = await getDB();
  const LIMIT       = 10;
  const MIN_RESULTS =  5;
  const TABLE       = "plant_table_final"; // ← replace with your actual table name

  const scoreFragments: string[] = [];
  const labels: Parameters<typeof buildWhyRecommended>[1] = {};

  // ── Q1: Space Type ──────────────────────────────────────────────────────────
  const spaceAns = answers[FieldIndex.space_type];
  if (spaceAns?.selectedOption?.trim()) {
    const p = buildSpaceScore(spaceAns.selectedOption);
    labels.spaceLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Q2: Sunlight ────────────────────────────────────────────────────────────
  const sunlightAns = answers[FieldIndex.sunlight];
  if (sunlightAns?.selectedOption?.trim()) {
    const p = buildSunlightScore(sunlightAns.selectedOption);
    labels.sunlightLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Q3: Goal ────────────────────────────────────────────────────────────────
  const goalAns = answers[FieldIndex.goal];
  if (goalAns?.selectedOption?.trim()) {
    const p = buildGoalScore(goalAns.selectedOption);
    labels.goalLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Q4: Watering ────────────────────────────────────────────────────────────
  const wateringAns = answers[FieldIndex.watering];
  if (wateringAns?.selectedOption?.trim()) {
    const p = buildWateringScore(wateringAns.selectedOption);
    labels.wateringLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Q5: Climate ─────────────────────────────────────────────────────────────
  const climateAns = answers[FieldIndex.climate];
  if (climateAns?.selectedOption?.trim()) {
    const p = buildClimateScore(climateAns.selectedOption);
    labels.climateLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Q6: Experience ──────────────────────────────────────────────────────────
  const expAns = answers[FieldIndex.experience];
  if (expAns?.selectedOption?.trim()) {
    const p = buildExperienceScore(expAns.selectedOption);
    labels.experienceLabel = p.label;
    scoreFragments.push(p.sql);
  }

  // ── Universal quality bonuses ───────────────────────────────────────────────
  scoreFragments.push(
    `CASE WHEN (image_regular_url IS NOT NULL AND image_regular_url <> '') THEN ${WEIGHTS.has_image} ELSE 0 END`
  );
  scoreFragments.push(
    `CASE WHEN (common_name IS NOT NULL AND common_name <> '') THEN ${WEIGHTS.has_common_name} ELSE 0 END`
  );

  // ── Compose total score expression ──────────────────────────────────────────
  const scoreExpr = scoreFragments.length > 0
    ? `(\n      ${scoreFragments.join("\n      + ")}\n    )`
    : "0";

  // ── Main query ──────────────────────────────────────────────────────────────
  // RANDOM() in the final ORDER BY adds variety when scores are tied.
  const mainQuery = `
    SELECT
      id,
      common_name,
      scientific_name,
      other_name,
      family,
      genus,
      type,
      cycle,
      watering,
      sunlight,
      care_level,
      maintenance,
      growth_rate,
      drought_tolerant,
      salt_tolerant,
      tropical,
      indoor,
      flowers,
      flowering_season,
      fruits,
      edible_fruit,
      harvest_season,
      leaf,
      edible_leaf,
      cuisine,
      medicinal,
      poisonous_to_humans,
      poisonous_to_pets,
      hardiness_min,
      hardiness_max,
      description,
      image_original_url,
      image_regular_url,
      image_medium_url,
      image_small_url,
      image_thumbnail,
      local_image_path,
      ${scoreExpr} AS match_score
    FROM ${TABLE}
    WHERE scientific_name IS NOT NULL
      AND scientific_name <> ''
    ORDER BY match_score DESC, RANDOM()
    LIMIT $1;
  `;

  let rows: Record<string, unknown>[] = [];

  try {
    const result = await client.query(mainQuery, [LIMIT]);
    rows = result.rows;
  } catch (err) {
    console.error("[getRecommendedPlants] Main query failed:", err);
  }

  // ── Fallback: fill remaining slots with photo-documented plants ─────────────
  if (rows.length < MIN_RESULTS) {
    try {
      const needed      = LIMIT - rows.length;
      const existingIds = [...new Set(rows.map((r) => r.id as number))];

      const excludeClause =
        existingIds.length > 0
          ? `AND id NOT IN (${existingIds.map((_, i) => `$${i + 2}`).join(", ")})`
          : "";

      const fallbackQuery = `
        SELECT
          id, common_name, scientific_name, other_name, family, genus,
          type, cycle, watering, sunlight, care_level, maintenance, growth_rate,
          drought_tolerant, salt_tolerant, tropical, indoor,
          flowers, flowering_season, fruits, edible_fruit, harvest_season,
          leaf, edible_leaf, cuisine, medicinal,
          poisonous_to_humans, poisonous_to_pets,
          hardiness_min, hardiness_max, description,
          image_original_url, image_regular_url, image_medium_url,
          image_small_url, image_thumbnail,local_image_path,
          0 AS match_score
        FROM ${TABLE}
        WHERE scientific_name IS NOT NULL
          AND scientific_name <> ''
          AND image_regular_url IS NOT NULL
          AND image_regular_url <> ''
          ${excludeClause}
        ORDER BY RANDOM()
        LIMIT $1;
      `;

      const fbResult = await client.query(fallbackQuery, [needed, ...existingIds]);
      rows = [...rows, ...fbResult.rows];
    } catch (err) {
      console.error("[getRecommendedPlants] Fallback query failed:", err);
    }
  }

  // ── Map raw rows → typed output ─────────────────────────────────────────────
  return rows.slice(0, LIMIT).map((plant) => ({
    id:                  plant.id                   as number,
    commonName:         (plant.common_name           as string)  ?? null,
    scientificName:      plant.scientific_name       as string,
    otherName:          (plant.other_name            as string)  ?? null,
    family:             (plant.family                as string)  ?? null,
    genus:              (plant.genus                 as string)  ?? null,
    type:               (plant.type                  as string)  ?? null,
    cycle:              (plant.cycle                 as string)  ?? null,
    watering:           (plant.watering              as string)  ?? null,
    sunlight:           (plant.sunlight              as string)  ?? null,
    careLevel:          (plant.care_level            as string)  ?? null,
    maintenance:        (plant.maintenance           as string)  ?? null,
    growthRate:         (plant.growth_rate           as string)  ?? null,
    droughtTolerant:    (plant.drought_tolerant      as boolean) ?? null,
    saltTolerant:       (plant.salt_tolerant         as boolean) ?? null,
    tropical:           (plant.tropical              as boolean) ?? null,
    indoor:             (plant.indoor                as boolean) ?? null,
    flowers:            (plant.flowers               as boolean) ?? null,
    floweringSeason:    (plant.flowering_season      as string)  ?? null,
    fruits:             (plant.fruits                as boolean) ?? null,
    edibleFruit:        (plant.edible_fruit          as boolean) ?? null,
    harvestSeason:      (plant.harvest_season        as string)  ?? null,
    leaf:               (plant.leaf                  as boolean) ?? null,
    edibleLeaf:         (plant.edible_leaf           as boolean) ?? null,
    cuisine:            (plant.cuisine               as boolean) ?? null,
    medicinal:          (plant.medicinal             as boolean) ?? null,
    poisonousToHumans:  (plant.poisonous_to_humans   as boolean) ?? null,
    poisonousToPets:    (plant.poisonous_to_pets     as boolean) ?? null,
    hardinessMin:       (plant.hardiness_min         as number)  ?? null,
    hardinessMax:       (plant.hardiness_max         as number)  ?? null,
    description:        (plant.description           as string)  ?? null,
    imageOriginal:      (plant.image_original_url    as string)  ?? null,
    image:              (plant.image_regular_url     as string)  ?? null,
    imageMedium:        (plant.image_medium_url      as string)  ?? null,
    imageSmall:         (plant.image_small_url       as string)  ?? null,
    imageThumbnail:     (plant.image_thumbnail       as string)  ?? null,
    image_url:         toImageUrl(plant.local_image_path       as string)  ?? null,
    matchScore:         (plant.match_score           as number)  ?? 0,
    whyRecommended:      buildWhyRecommended(plant, labels),
  }));
};