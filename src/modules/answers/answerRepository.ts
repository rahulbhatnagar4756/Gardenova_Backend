import { getDB } from "../../core/config/db";
import { FieldIndex } from "../../interface";
import {
  IAnswerType1or2,
  IPartnerRecommendation,
  // IPlantRecommendation,
  ISubmitAnswer,
  IUserAnswer,
} from "../../interface/answer";

/**
 * Retrieves a list of recommended plants based on the user's provided answers.
 * Uses PostgreSQL with optimized joins and indexing.
 *
 * @param {IUserAnswer[]} answers - Array of user answers used to generate filters
 * @returns {Promise<IPlantRecommendation[]>} Array of plant recommendations
 */
// export const getRecommendedPlants = async (
//   answers: IUserAnswer[]
// ): Promise<IPlantRecommendation[]> => {
//   const client = await getDB();

//   try {
//     const conditions: string[] = ["p.is_deleted = FALSE"];
//     const params: unknown[] = [];
//     let paramIndex = 1;

//     // Store match criteria for why recommended
//     const matchCriteria: Record<string, string> = {};

//     for (const [i, ans] of answers.entries()) {
//       if (!ans) continue;

//       switch (i) {
//         case FieldIndex.space_types: {
//           const value = ans.selectedOption?.trim();
//           if (value) {
//             conditions.push(
//               `EXISTS (
//                 SELECT 1 FROM plant_space_types pst 
//                 WHERE pst.plant_id = p.id 
//                 AND pst.space_type ILIKE $${paramIndex}
//               )`
//             );
//             params.push(`%${value}%`);
//             matchCriteria.space_types = value;
//             paramIndex++;
//           }
//           break;
//         }

//         case FieldIndex.area_sizes: {
//           const value = ans.selectedOption?.trim();
//           if (value) {
//             conditions.push(
//               `EXISTS (
//                 SELECT 1 FROM plant_area_sizes pas 
//                 WHERE pas.plant_id = p.id 
//                 AND pas.area_size ILIKE $${paramIndex}
//               )`
//             );
//             params.push(`%${value}%`);
//             matchCriteria.area_sizes = value;
//             paramIndex++;
//           }
//           break;
//         }

//         case FieldIndex.challenges: {
//           const value = ans.selectedOption?.trim();
//           if (value) {
//             conditions.push(
//               `EXISTS (
//                 SELECT 1 FROM plant_challenges pc 
//                 WHERE pc.plant_id = p.id 
//                 AND pc.challenge ILIKE $${paramIndex}
//               )`
//             );
//             params.push(`%${value}%`);
//             matchCriteria.challenges = value;
//             paramIndex++;
//           }
//           break;
//         }

//         case FieldIndex.tech_preferences: {
//           const value = ans.selectedOption?.trim();
//           if (value) {
//             conditions.push(
//               `EXISTS (
//                 SELECT 1 FROM plant_tech_preferences ptp 
//                 WHERE ptp.plant_id = p.id 
//                 AND ptp.tech_preference ILIKE $${paramIndex}
//               )`
//             );
//             params.push(`%${value}%`);
//             matchCriteria.tech_preferences = value;
//             paramIndex++;
//           }
//           break;
//         }

//         case FieldIndex.locations:
//           if (ans.selectedAddress?.state || ans.selectedAddress?.city) {
//             const stateVariations = ans.selectedAddress?.state
//               ? getLocationVariations(ans.selectedAddress.state)
//               : [];
//             const cityVariations = ans.selectedAddress?.city
//               ? getLocationVariations(ans.selectedAddress.city)
//               : [];

//             // Normalize both state and city
//             const normalizedStates = stateVariations.map((s) =>
//               normalizeText(s)
//             );
//             const normalizedCities = cityVariations.map((c) =>
//               normalizeText(c)
//             );

//             // Add SQL to normalize database side using unaccent + lower
//             conditions.push(`
//       EXISTS (
//         SELECT 1 FROM plant_locations pl
//         WHERE pl.plant_id = p.id
//         AND unaccent(lower(pl.location_type)) = ANY($${paramIndex})
//         AND unaccent(lower(pl.location_value)) = ANY($${paramIndex + 1})
//       )
//     `);

//             params.push(normalizedStates, normalizedCities);
//             matchCriteria.locations = `${cityVariations.join(", ")}, ${stateVariations.join(", ")}`;
//             paramIndex += 2;
//           }
//           break;
//       }
//     }

//     const whereClause =
//       conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

//     // Main query with aggregated data
//     const query = `
//   SELECT 
//     p.id,
//     p.scientific_name,
//     p.common_name,
//     p.image_search_url,
//     p.description,

//     -- Space Types
//     COALESCE(
//       (
//         SELECT json_agg(pst.space_type)
//         FROM plant_space_types pst
//         WHERE pst.plant_id = p.id
//       ), '[]'::json
//     ) AS space_types,

//     -- Area Sizes
//     COALESCE(
//       (
//         SELECT json_agg(pas.area_size)
//         FROM plant_area_sizes pas
//         WHERE pas.plant_id = p.id
//       ), '[]'::json
//     ) AS area_sizes,

//     -- Challenges
//     COALESCE(
//       (
//         SELECT json_agg(pc.challenge)
//         FROM plant_challenges pc
//         WHERE pc.plant_id = p.id
//       ), '[]'::json
//     ) AS challenges,

//     -- Tech Preferences
//     COALESCE(
//       (
//         SELECT json_agg(ptp.tech_preference)
//         FROM plant_tech_preferences ptp
//         WHERE ptp.plant_id = p.id
//       ), '[]'::json
//     ) AS tech_preferences,

//     -- Locations (state = location_type, city = location_value)
//     COALESCE(
//       (
//         SELECT json_agg(
//           json_build_object(
//             'state', pl.location_type,
//             'city', pl.location_value
//           )
//         )
//         FROM plant_locations pl
//         WHERE pl.plant_id = p.id
//       ), '[]'::json
//     ) AS locations

//   FROM plants p
//   ${whereClause}
//   LIMIT 20;
// `;

//     const result = await client.query(query, params);

//     // Build "why recommended" for each plant
//     const enhanced: IPlantRecommendation[] = result.rows.map((plant) => {
//       const why: string[] = [];

//       if (matchCriteria.space_types && plant.space_types?.length) {
//         const match = plant.space_types.find((st: string) =>
//           st.toLowerCase().includes(matchCriteria.space_types!.toLowerCase())
//         );
//         if (match) {
//           why.push(`Matches your preference for space types (${match})`);
//         }
//       }

//       if (matchCriteria.area_sizes && plant.area_sizes?.length) {
//         const match = plant.area_sizes.find((as: string) =>
//           as.toLowerCase().includes(matchCriteria.area_sizes!.toLowerCase())
//         );
//         if (match) {
//           why.push(`Matches your preference for area sizes (${match})`);
//         }
//       }

//       if (matchCriteria.challenges && plant.challenges?.length) {
//         const match = plant.challenges.find((c: string) =>
//           c.toLowerCase().includes(matchCriteria.challenges!.toLowerCase())
//         );
//         if (match) {
//           why.push(`Matches your challenge (${match})`);
//         }
//       }

//       if (matchCriteria.tech_preferences && plant.tech_preferences?.length) {
//         const match = plant.tech_preferences.find((tp: string) =>
//           tp
//             .toLowerCase()
//             .includes(matchCriteria.tech_preferences!.toLowerCase())
//         );
//         if (match) {
//           why.push(`Matches your tech preference (${match})`);
//         }
//       }

//       if (matchCriteria.locations && plant.locations?.length) {
//         why.push(`Available in your location (${matchCriteria.locations})`);
//       }

//       return {
//         ...plant,
//         whyRecommended: why,
//       };
//     });

//     return enhanced;
//   } catch (error) {
//     console.error("Error getting recommended plants:", error);
//     throw error;
//   }
// };

/**
 * Generates recommended partner profiles based on submitted answers.
 * Uses PostgreSQL with multilingual location matching.
 *
 * @param answers - User-submitted answers
 * @returns Array of partner recommendations
 */
export const getRecommendedPartners = async (
  answers: ISubmitAnswer[]
): Promise<Array<IPartnerRecommendation>> => {
  const client = await getDB();

  try {
    const type2Answer = answers.find((ans) => ans.type === 2);

    let userAddress: { state: string; city: string } | null = null;

    if (type2Answer) {
      const [state, city] = type2Answer.selectedOption
        .split("/")
        .map((s) => s.trim());
      if (state && city) {
        userAddress = { state, city };
      }
    }

    if (!userAddress?.state || !userAddress?.city) {
      return [];
    }

    // Normalize and generate multilingual variations
    const stateVariations = getLocationVariations(userAddress.state);
    const cityVariations = getLocationVariations(userAddress.city);

    // Build query
    const conditions: string[] = ["status = 'active'"];
    const params: unknown[] = [];
    let paramIndex = 1;

    // State matching (accent-insensitive)
    if (stateVariations.length > 0) {
      const statePlaceholders = stateVariations
        .map(() => `$${paramIndex++}`)
        .join(", ");
      conditions.push(`unaccent(lower(state)) IN (${statePlaceholders})`);
      params.push(...stateVariations.map((s) => normalizeText(s)));
    }

    // City matching (accent-insensitive)
    if (cityVariations.length > 0) {
      const cityPlaceholders = cityVariations
        .map(() => `$${paramIndex++}`)
        .join(", ");
      conditions.push(`unaccent(lower(city)) IN (${cityPlaceholders})`);
      params.push(...cityVariations.map((c) => normalizeText(c)));
    }

    const query = `
  SELECT 
    id,
    email,
    mobile_number,
    company_name,
    speciality_1,
    speciality_2,
    speciality_3,
    street,
    city,
    state,
    country,
    zip_code,
    website,
    contact_person,
    project_image_url,
    rating
  FROM partner_profiles
  WHERE ${conditions.join(" AND ")}
  ORDER BY rating DESC NULLS LAST
  LIMIT 20
`;

    const result = await client.query(query, params);

    // Build match reason
    const matchedOptions = answers
      .filter((ans): ans is IAnswerType1or2 => ans.type === 1)
      .map((ans) => ans.selectedOption)
      .filter(Boolean);

    const whyRecommended = buildMatchReason(
      userAddress,
      matchedOptions as string[]
    );

    // Map to return type
    return result.rows.map((partner) => ({
      partnerId: partner.id,
      email: partner.email,
      mobileNumber: partner.mobile_number,
      companyName: partner.company_name || "",
      speciality: [
        partner.speciality_1,
        partner.speciality_2,
        partner.speciality_3,
      ].filter(Boolean),
      address: {
        street: partner.street || "",
        city: partner.city || "",
        state: partner.state || "",
        country: partner.country || "",
        zipCode: partner.zip_code || "",
      },
      website: partner.website || "",
      contactPerson: partner.contact_person || "",
      projectImageUrl: partner.project_image_url || "",
      rating: partner.rating || "0.0",
      whyRecommended,
    }));
  } catch (error) {
    console.error("Error getting recommended partners:", error);
    return [];
  }
};

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
const buildMatchReason = (
  address: { city: string; state: string },
  matchedOptions: string[]
): string => {
  const reasons = [];

  reasons.push(`Location match: ${address.city}, ${address.state}`);

  if (matchedOptions.length > 0) {
    const uniqueOptions = [...new Set(matchedOptions)];
    reasons.push(`Criteria match: ${uniqueOptions.join(", ")}`);
  }

  return reasons.join(" | ");
};

/**
 * Normalizes a text string for case-insensitive and whitespace-tolerant comparisons.
 * Converts the text to lowercase and trims extra spaces.
 *
 * @param text - The input string to normalize.
 * @returns The normalized version of the input string.
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ã|á|à|â|ä/g, "a")
    .replace(/ç/g, "c")
    .replace(/é|ê/g, "e")
    .replace(/í/g, "i")
    .replace(/ó|ô|õ/g, "o")
    .replace(/ú|ü/g, "u")
    .replace(/\s+/g, " ");
};

const locationMappings: Record<string, string[]> = {
  belo_horizonte: ["belo horizonte", "bh"],
  brasilia: ["brasília", "brasilia", "df"],
  salvador: ["salvador", "ssa"],
  fortaleza: ["fortaleza", "for"],
  manaus: ["manaus", "mao"],
  curitiba: ["curitiba", "cwb"],
  recife: ["recife", "rec"],
  porto_alegre: ["porto alegre", "poa"],
  sao_paulo: ["são paulo", "sao paulo", "sp"],
  rio_de_janeiro: ["rio de janeiro", "rj"],
  minas_gerais: ["minas gerais", "mg"],
  bahia: ["bahia", "ba"],
  parana: ["paraná", "parana", "pr"],
  rio_grande_do_sul: ["rio grande do sul", "rs"],
  santa_catarina: ["santa catarina", "sc"],
  goias: ["goiás", "goias", "go"],
  ceara: ["ceará", "ceara", "ce"],
  pernambuco: ["pernambuco", "pe"],
  lisboa: ["lisboa", "lisbon"],
  porto: ["porto", "oporto"],
  braga: ["braga"],
  coimbra: ["coimbra"],
  funchal: ["funchal"],
};

/**
 * Generates possible text variations for a given location name.
 * Used to improve flexible matching across multilingual or differently formatted entries.
 *
 * @param location - The location string (e.g., a city or state name).
 * @returns An array of possible normalized variations of the input location.
 */
const getLocationVariations = (location: string): string[] => {
  const normalized = normalizeText(location);
  const variations = [location, normalized];

  for (const [key, values] of Object.entries(locationMappings)) {
    if (normalizeText(key) === normalized) {
      variations.push(...values);
      break;
    }
    if (values.some((v) => normalizeText(v) === normalized)) {
      variations.push(...values);
      variations.push(key);
      break;
    }
  }

  return [...new Set(variations.map((v) => normalizeText(v)))];
};


// export interface IUserAnswer {
//   questionId?: string;
//   type?: string;
//   selectedOption?: string;
//   selectedAddress?: {
//     state?: string;
//     city?: string;
//   };
// }
 
export interface IPlantRecommendationforPlat {
  id: number;
  common_name: string | null;
  scientific_name: string;
  image_url: string | null;
  family: string | null;
  genus: string | null;
  growth_habit: string | null;
  growth_rate: string | null;
  average_height_cm: number | null;
  maximum_height_cm: number | null;
  light: number | null;
  ground_humidity: number | null;
  atmospheric_humidity: number | null;
  edible: boolean | null;
  vegetable: boolean | null;
  distributions: string | null;
  flower_color: string | null;
  foliage_color: string | null;
  whyRecommended: string[];
}
 
 

 
// const BRAZIL_STATE_TO_REGION: Record<string, string[]> = {
//   // North
//   "amazonas":            ["Brazil North"],
//   "pará":                ["Brazil North"],
//   "para":                ["Brazil North"],
//   "roraima":             ["Brazil North"],
//   "rondônia":            ["Brazil North"],
//   "rondonia":            ["Brazil North"],
//   "acre":                ["Brazil North"],
//   "amapá":               ["Brazil North"],
//   "amapa":               ["Brazil North"],
//   "tocantins":           ["Brazil North"],
//   // Northeast
//   "maranhão":            ["Brazil Northeast"],
//   "maranhao":            ["Brazil Northeast"],
//   "piauí":               ["Brazil Northeast"],
//   "piaui":               ["Brazil Northeast"],
//   "ceará":               ["Brazil Northeast"],
//   "ceara":               ["Brazil Northeast"],
//   "rio grande do norte": ["Brazil Northeast"],
//   "paraíba":             ["Brazil Northeast"],
//   "paraiba":             ["Brazil Northeast"],
//   "pernambuco":          ["Brazil Northeast"],
//   "alagoas":             ["Brazil Northeast"],
//   "sergipe":             ["Brazil Northeast"],
//   "bahia":               ["Brazil Northeast"],
//   // Southeast
//   "são paulo":           ["Brazil Southeast"],
//   "sao paulo":           ["Brazil Southeast"],
//   "rio de janeiro":      ["Brazil Southeast"],
//   "minas gerais":        ["Brazil Southeast"],
//   "espírito santo":      ["Brazil Southeast"],
//   "espirito santo":      ["Brazil Southeast"],
//   // South
//   "paraná":              ["Brazil South"],
//   "parana":              ["Brazil South"],
//   "santa catarina":      ["Brazil South"],
//   "rio grande do sul":   ["Brazil South"],
//   // Central-West
//   "mato grosso do sul":  ["Brazil West-Central"],
//   "mato grosso":         ["Brazil West-Central"],
//   "goiás":               ["Brazil West-Central"],
//   "goias":               ["Brazil West-Central"],
//   "distrito federal":    ["Brazil West-Central"],
//   // Biome values that appear in city column of plant_locations
//   "cerrado":             ["Brazil West-Central", "Brazil Northeast"],
//   "tropical":            ["Brazil North", "Brazil Northeast"],
// };
/**
 * Maps a Brazilian location (state or city name) to its corresponding region(s).
 *
 * @param {string} location - The input location string (e.g., state or city name).
 *
 * @returns {string[]} An array of region names associated with the given location.
 * - Returns matched region(s) if found.
 * - Falls back to ["Brazil"] if no match is found.
 *
 * @description
 * This function normalizes the input location string and attempts to:
 * 1. Perform a direct lookup using a predefined state-to-region mapping.
 * 2. If no exact match is found, perform a partial match:
 *    - Checks if the input contains a known state name
 *    - OR if a known state name contains the input
 * 3. Returns a default region ["Brazil"] when no match is identified.
 */ 
// function brazilianLocationToRegions(location: string): string[] {
//   const key = location.toLowerCase().trim();
//   if (BRAZIL_STATE_TO_REGION[key]) return BRAZIL_STATE_TO_REGION[key];
//   // Partial match for city names that contain a state name
//   for (const [stateKey, regions] of Object.entries(BRAZIL_STATE_TO_REGION)) {
//     if (key.includes(stateKey) || stateKey.includes(key)) return regions;
//   }
//   return ["Brazil"];
// }
 
// ─────────────────────────────────────────────────────────────────
// SPACE TYPES → growth_habit
//
// Actual values from plant_space_types table:
//   "Home Garden"            → Tree, Shrub, Forb/herb
//   "Balcony"                → Forb/herb, Subshrub, Shrub
//   "Apartment Balcony"      → Forb/herb, Subshrub
//   "Corporate Outdoor Area" → Tree, Shrub
//   "Corporate Indoor"       → Forb/herb, Subshrub
//   "Urban Park"             → Tree, Shrub, Forb/herb
//   "Park"                   → Tree, Shrub
//   "Farm"                   → Forb/herb, Graminoid, Tree
//   "Avenue"                 → Tree
//   "Botanical Garden"       → Tree, Shrub, Forb/herb
//   "Community Garden"       → Forb/herb, Shrub
//   "Green Wall"             → Vine, Forb/herb, Subshrub
// ─────────────────────────────────────────────────────────────────

/**
 * Builds a SQL condition for filtering plants based on space type.
 *
 * @param {string} value - The space type input (e.g., "balcony", "park", "farm").
 * @param {number} startIndex - The starting index for SQL parameter placeholders
 * (used for parameterized queries, e.g., $1, $2, ...).
 *
 * @returns {{ sql: string; params: string[]; label: string } | null}
 * An object containing:
 * - `sql`: SQL condition string using ILIKE clauses
 * - `params`: Array of values to bind to the query
 * - `label`: Original input value for reference
 *
 * @description
 * This function maps a given space type to appropriate plant growth habits
 * and generates a parameterized SQL condition for filtering.
 *
 * Steps:
 * 1. Normalizes the input value (lowercase + trim).
 * 2. Maps the space type to a list of growth habits using a predefined dictionary.
 * 3. Falls back to a default set of habits if no mapping is found.
 * 4. Constructs SQL `ILIKE` conditions for each habit.
 * 5. Returns the SQL string along with query parameters.
 *
 *
 */
// function buildSpaceTypeCondition(
//   value: string,
//   startIndex: number
// ): { sql: string; params: string[]; label: string } | null {
//   const v = value.toLowerCase().trim();
 
//   const habitMap: Record<string, string[]> = {
//     "home garden":            [ "%Shrub%", "%Forb/herb%", "%Tree%"],
//     "balcony":                ["%Forb/herb%", "%Shrub%"],
//     "apartment balcony":      ["%Forb/herb%", "%Subshrub%"],
//     "corporate outdoor area": ["%Tree%", "%Shrub%"],
//     "corporate indoor":       ["%Forb/herb%", "%Subshrub%"],
//     "urban park":             ["%Tree%", "%Shrub%",],
//     "park":                   ["%Tree%", "%Shrub%"],
//     "farm":                   ["%Forb/herb%", "%Graminoid%", "%Tree%"],
//     "avenue":                 ["%Tree%"],
//     "botanical garden":       ["%Tree%", "%Shrub%", "%Forb/herb%"],
//     "community garden":       ["%Forb/herb%", "%Shrub%"],
//     "green wall":             ["%Vine%", "%Forb/herb%", "%Subshrub%"],
//   };
 
//   const habits = habitMap[v] ?? ["%Tree%", "%Shrub%", "%Forb/herb%"];
//   const clauses = habits.map((_, i) => `growth_habit ILIKE $${startIndex + i}`);
 
//   return {
//     sql: `(${clauses.join(" OR ")})`,
//     params: habits,
//     label: value,
//   };
// }
 
// ─────────────────────────────────────────────────────────────────
// AREA SIZES → height columns
//
// Actual values from rule_conditions table:
//   "Intimate"  → ≤ 150 cm   (compact plants)
//   "Ample"     → 151–800 cm (medium shrubs, small trees)
//   "Extensive" → > 800 cm   (large trees)
//
// NULLs are included for Intimate/Ample since most All_plants rows
// lack height data — avoids over-filtering.
// ─────────────────────────────────────────────────────────────────
 
/**
 * Builds a SQL condition for filtering plants based on area size.
 *
 * @param {string} value - The area size category (e.g., "intimate", "ample", "extensive").
 * @param {number} startIndex - The starting index for SQL parameter placeholders
 * (used for parameterized queries like $1, $2, etc.).
 *
 * @returns {{ sql: string; params: number[]; label: string } | null}
 * An object containing:
 * - `sql`: SQL condition string for filtering by plant height
 * - `params`: Array of numeric values to bind to the query
 * - `label`: Human-readable label for the selected area size
 *
 * @description
 * This function maps area size categories to plant height constraints using:
 * - `average_height_cm` (preferred when available)
 * - `maximum_height_cm` (fallback when average height is null)
 *
 * Categories:
 * 1. **Intimate (compact)**:
 *    - Plants ≤ 150 cm
 *    - Includes plants with unknown height
 *
 * 2. **Ample (medium)**:
 *    - Plants between 150 cm and 800 cm
 *    - Includes plants with unknown height
 *
 * 3. **Extensive (large)**:
 *    - Plants > 800 cm
 *
 * Logic:
 * - Prioritizes `average_height_cm` when available
 * - Falls back to `maximum_height_cm` if average is null
 * - Handles null values gracefully to avoid excluding plants unnecessarily
 *
 * @example
 * buildAreaSizeCondition("intimate", 1);
 * // Returns SQL filtering plants <= 150 cm
 *
 * @example
 * buildAreaSizeCondition("ample", 2);
 * // Returns SQL filtering plants between 150–800 cm
 *
 * @example
 * buildAreaSizeCondition("extensive", 3);
 * // Returns SQL filtering plants > 800 cm
 *
 * @example
 * buildAreaSizeCondition("unknown", 1);
 * // Returns null
 */
// function buildAreaSizeCondition(
//   value: string,
//   startIndex: number
// ): { sql: string; params: number[]; label: string } | null {
//   const v = value.toLowerCase().trim();
 
//   if (v === "intimate") {
//     return {
//       sql: `(
//         (average_height_cm IS NOT NULL AND average_height_cm <= $${startIndex})
//         OR (average_height_cm IS NULL AND maximum_height_cm IS NOT NULL AND maximum_height_cm <= $${startIndex + 1})
//         OR (average_height_cm IS NULL AND maximum_height_cm IS NULL)
//       )`,
//       params: [150, 150],
//       label: "intimate (compact)",
//     };
//   }
 
//   if (v === "ample") {
//     return {
//       sql: `(
//         (average_height_cm IS NOT NULL AND average_height_cm > $${startIndex} AND average_height_cm <= $${startIndex + 1})
//         OR (average_height_cm IS NULL AND maximum_height_cm IS NOT NULL AND maximum_height_cm > $${startIndex + 2} AND maximum_height_cm <= $${startIndex + 3})
//         OR (average_height_cm IS NULL AND maximum_height_cm IS NULL)
//       )`,
//       params: [150, 800, 150, 800],
//       label: "ample (medium)",
//     };
//   }
 
//   if (v === "extensive") {
//     return {
//       sql: `(
//         (average_height_cm IS NOT NULL AND average_height_cm > $${startIndex})
//         OR (average_height_cm IS NULL AND maximum_height_cm IS NOT NULL AND maximum_height_cm > $${startIndex + 1})
//       )`,
//       params: [800, 800],
//       label: "extensive (large)",
//     };
//   }
 
//   return null;
// }
 
// ─────────────────────────────────────────────────────────────────
// CHALLENGES → All_plants columns
//
// Actual values from rule_conditions table:
//   "Knowledge"   → both common_name AND scientific_name present
//                   (well-documented species = good for learning)
//   "Aesthetics"  → flower_color OR foliage_color IS NOT NULL
//   "Maintenance" → growth_rate Slow/Moderate + ground_humidity ≤ 5
//   "Control"     → growth_rate Slow/Moderate (won't spread aggressively)
// ─────────────────────────────────────────────────────────────────
 /**
 * Builds a SQL condition for filtering plants based on user-defined challenges or priorities.
 *
 * @param {string} value - The challenge type (e.g., "knowledge", "aesthetics", "maintenance", "control").
 * @param {number} startIndex - The starting index for SQL parameter placeholders
 * (used for parameterized queries like $1, $2, etc.).
 *
 * @returns {{ sql: string; params: (string | number)[]; label: string } | null}
 * An object containing:
 * - `sql`: SQL condition string for filtering plants
 * - `params`: Array of values to bind to the query
 * - `label`: Human-readable label describing the applied filter
 *
 * @description
 * This function maps user challenges or preferences to SQL filtering conditions:
 *
 * 1. **Knowledge (educational/well-documented)**:
 *    - Filters plants with both common and scientific names available.
 *
 * 2. **Aesthetics (ornamental)**:
 *    - Filters plants with either flower color or foliage color defined.
 *
 * 3. **Maintenance (low-maintenance)**:
 *    - Filters plants with slow or moderate growth rates
 *    - AND low or unspecified ground humidity requirements
 *
 * 4. **Control (easy to control)**:
 *    - Filters plants with slow or moderate growth rates
 *
 * If the input does not match any known category, the function returns `null`.
 *
 */
// function buildChallengeCondition(
//   value: string,
//   startIndex: number
// ): { sql: string; params: (string | number)[]; label: string } | null {
//   const v = value.toLowerCase().trim();
 
//   if (v === "knowledge") {
//     return {
//       sql: `(
//         common_name IS NOT NULL AND common_name <> ''
//         AND scientific_name IS NOT NULL AND scientific_name <> ''
//       )`,
//       params: [],
//       label: "educational/well-documented",
//     };
//   }
 
//   if (v === "aesthetics") {
//     return {
//       sql: `(flower_color IS NOT NULL OR foliage_color IS NOT NULL)`,
//       params: [],
//       label: "ornamental",
//     };
//   }
 
//   if (v === "maintenance") {
//     return {
//       sql: `(
//         (growth_rate = $${startIndex} OR growth_rate = $${startIndex + 1})
//         AND (ground_humidity IS NULL OR ground_humidity <= $${startIndex + 2})
//       )`,
//       params: ["Slow", "Moderate", 5],
//       label: "low-maintenance",
//     };
//   }
 
//   if (v === "control") {
//     return {
//       sql: `(growth_rate = $${startIndex} OR growth_rate = $${startIndex + 1})`,
//       params: ["Slow", "Moderate"],
//       label: "easy to control",
//     };
//   }
 
//   return null;
// }
 
// ─────────────────────────────────────────────────────────────────
// TECH PREFERENCES → All_plants columns
//
// Actual values from plant_tech_preferences table:
//   "Water Savings"         → ground_humidity ≤ 3 (drought-tolerant)
//   "Automation"            → growth_rate Slow/Moderate
//   "Mobile Control"        → growth_rate Slow/Moderate (casing variants)
//   "Mobile control"        → same
//   "Irrigation Automation" → ground_humidity between 3–7
// ─────────────────────────────────────────────────────────────────

/**
 * Builds a SQL condition for filtering plants based on technology-related preferences.
 *
 * @param {string} value - The technology preference (e.g., "water savings", "automation", "mobile control", "irrigation automation").
 * @param {number} startIndex - The starting index for SQL parameter placeholders
 * (used for parameterized queries like $1, $2, etc.).
 *
 * @returns {{ sql: string; params: (string | number)[]; label: string } | null}
 * An object containing:
 * - `sql`: SQL condition string for filtering plants
 * - `params`: Array of values to bind to the query
 * - `label`: Human-readable label describing the applied filter
 *
 * @description
 * This function maps technology preferences to SQL filtering conditions:
 *
 * 1. **Water savings (water-efficient)**:
 *    - Filters plants with ground humidity ≤ 3
 *
 * 2. **Automation / Mobile control (automation-friendly)**:
 *    - Filters plants with slow or moderate growth rates
 *
 * 3. **Irrigation automation (irrigation-automation compatible)**:
 *    - Filters plants with ground humidity between 3 and 7
 *
 * If the input does not match any known category, the function returns `null`.
 *
 * 
 */
// function buildTechPreferenceCondition(
//   value: string,
//   startIndex: number
// ): { sql: string; params: (string | number)[]; label: string } | null {
//   const v = value.toLowerCase().trim();
 
//   if (v === "water savings") {
//     return {
//       sql: `(ground_humidity IS NOT NULL AND ground_humidity <= $${startIndex})`,
//       params: [3],
//       label: "water-efficient",
//     };
//   }
 
//   if (v === "automation" || v === "mobile control") {
//     return {
//       sql: `(growth_rate = $${startIndex} OR growth_rate = $${startIndex + 1})`,
//       params: ["Slow", "Moderate"],
//       label: "automation-friendly",
//     };
//   }
 
//   if (v === "irrigation automation") {
//     return {
//       sql: `(ground_humidity IS NOT NULL AND ground_humidity >= $${startIndex} AND ground_humidity <= $${startIndex + 1})`,
//       params: [3, 7],
//       label: "irrigation-automation compatible",
//     };
//   }
 
//   return null;
// }
 
// ─────────────────────────────────────────────────────────────────
// LOCATIONS → distributions TEXT column
//
// Translates Brazilian state names to English region strings
// that appear in All_plants.distributions, then does ILIKE matching.
// ─────────────────────────────────────────────────────────────────
/**
 * Builds a SQL condition to filter plants based on a user's location answer.
 *
 * @param {IUserAnswer} ans - The user's answer containing the selected address.
 * @param {number} startIndex - The starting index for SQL parameter placeholders
 * (used for parameterized queries like $1, $2, etc.).
 *
 * @returns {{ sql: string; params: string[]; label: string } | null}
 * An object containing:
 * - `sql`: SQL condition string using `ILIKE` for matching regions in plant distributions.
 * - `params`: Array of region names (with wildcards) to bind to the query.
 * - `label`: Human-readable label derived from city and/or state for display purposes.
 * Returns `null` if no valid state or city is provided.
 *
 * @description
 * This function:
 * 1. Extracts the state and city from `ans.selectedAddress`.
 * 2. Converts each into a set of corresponding Brazilian regions via `brazilianLocationToRegions`.
 * 3. Constructs a parameterized SQL condition using `ILIKE` for each region.
 * 4. Returns a label combining city and state for reference.
 *
 *
 */
// function buildLocationCondition(
//   ans: IUserAnswer,
//   startIndex: number
// ): { sql: string; params: string[]; label: string } | null {
//   const regionSet = new Set<string>();
 
//   if (ans.selectedAddress?.state?.trim()) {
//     for (const r of brazilianLocationToRegions(ans.selectedAddress.state.trim())) {
//       regionSet.add(r);
//     }
//   }
 
//   if (ans.selectedAddress?.city?.trim()) {
//     for (const r of brazilianLocationToRegions(ans.selectedAddress.city.trim())) {
//       regionSet.add(r);
//     }
//   }
 
//   if (regionSet.size === 0) return null;
 
//   const regions = [...regionSet];
//   const clauses = regions.map((_, i) => `distributions ILIKE $${startIndex + i}`);
//   const label = [ans.selectedAddress?.city, ans.selectedAddress?.state]
//     .filter(Boolean)
//     .join(", ");
 
//   return {
//     sql: `(${clauses.join(" OR ")})`,
//     params: regions.map((r) => `%${r}%`),
//     label,
//   };
// }
 
// ─────────────────────────────────────────────────────────────────
// Why Recommended Builder
// ─────────────────────────────────────────────────────────────────
/**
 * Generates human-readable reasons explaining why a plant is recommended
 * based on the user's matched criteria.
 *
 * @param {Record<string, unknown>} plant - The plant object containing properties like
 * growth_habit, average_height_cm, maximum_height_cm, flower_color, foliage_color,
 * growth_rate, and ground_humidity.
 *
 * @param {Record<string, string>} matchCriteria - The criteria matched for this plant,
 * including keys like `space_types`, `area_sizes`, `challenges`, `tech_preferences`,
 * and `locations`.
 *
 * @returns {string[]} An array of descriptive strings explaining why the plant is suitable
 * for the user.
 *
 * @description
 * This function examines the matched criteria and generates personalized explanations:
 *
 * - **Space Types**: Adds a note about suitability and growth habit.
 * - **Area Sizes**: Notes space compatibility and approximate height.
 * - **Challenges**:
 *   - `knowledge`: Well-documented species.
 *   - `aesthetics`: Notes ornamental features (flower/foliage color).
 *   - `maintenance`: Low-maintenance notes including growth rate and water needs.
 *   - `control`: Easy-to-control growth rate.
 * - **Tech Preferences**:
 *   - `water savings`: Water-efficient.
 *   - `automation`/`mobile control`: Automation-friendly.
 *   - `irrigation automation`: Compatible with automated irrigation.
 * - **Locations**: Notes plant distribution in the user's region.
 *
 * If no criteria are matched, it defaults to a generic recommendation message.
 *
 *
 */
// function buildWhyRecommended(
//   plant: Record<string, unknown>,
//   matchCriteria: Record<string, string>
// ): string[] {
//   const why: string[] = [];
 
//   if (matchCriteria.space_types) {
//     const habit = plant.growth_habit as string | null;
//     why.push(
//       `Suited for ${matchCriteria.space_types}` +
//         (habit ? ` — grows as ${habit.toLowerCase()}` : "")
//     );
//   }
 
//   if (matchCriteria.area_sizes) {
//     const h = (plant.average_height_cm ?? plant.maximum_height_cm) as number | null;
//     why.push(
//       `Fits your ${matchCriteria.area_sizes} space` +
//         (h !== null ? ` — reaches ~${h} cm` : "")
//     );
//   }
 
//   if (matchCriteria.challenges) {
//     const v = matchCriteria.challenges.toLowerCase();
//     if (v === "knowledge") {
//       why.push(`Well-documented species — ideal for learning`);
//     } else if (v === "aesthetics") {
//       const desc = [
//         plant.flower_color ? `flowers: ${plant.flower_color}` : null,
//         plant.foliage_color ? `foliage: ${plant.foliage_color}` : null,
//       ]
//         .filter(Boolean)
//         .join(", ");
//       why.push(`Ornamental value${desc ? ` (${desc})` : ""}`);
//     } else if (v === "maintenance") {
//       why.push(
//         `Low-maintenance — growth: ${plant.growth_rate ?? "moderate"}, ` +
//           `water needs: ${plant.ground_humidity ?? "moderate"}/10`
//       );
//     } else if (v === "control") {
//       why.push(`Easy to control — ${(plant.growth_rate as string)?.toLowerCase() ?? "moderate"} growth rate`);
//     }
//   }
 
//   if (matchCriteria.tech_preferences) {
//     const v = matchCriteria.tech_preferences.toLowerCase();
//     if (v === "water savings") {
//       why.push(`Water-efficient — humidity needs: ${plant.ground_humidity}/10`);
//     } else if (v === "automation" || v === "mobile control") {
//       why.push(`Automation-friendly — ${(plant.growth_rate as string)?.toLowerCase() ?? "moderate"} growth rate`);
//     } else if (v === "irrigation automation") {
//       why.push(`Suits automated irrigation (humidity: ${plant.ground_humidity}/10)`);
//     }
//   }
 
//   if (matchCriteria.locations) {
//     why.push(`Distributed in your region (${matchCriteria.locations})`);
//   }
 
//   if (why.length === 0) {
//     why.push("Matches your plant preferences");
//   }
 
//   return why;
// }
 
// ─────────────────────────────────────────────────────────────────
// Main Recommendation Function
// ─────────────────────────────────────────────────────────────────
/**
 * Generates a list of recommended plants based on user survey answers.
 *
 * @param {IUserAnswer[]} answers - Array of user answers from the survey.
 *
 * @returns {Promise<IPlantRecommendationforPlat[]>} A promise resolving to an array of
 * plant recommendations. Each recommendation includes plant data and
 * `whyRecommended` reasons explaining suitability.
 *
 * @description
 * This function:
 * 1. Iterates over user answers, building SQL conditions dynamically
 *    based on the type of question (space type, area size, challenges,
 *    tech preferences, and locations).
 * 2. Keeps track of matched criteria to generate human-readable
 *    recommendations via `buildWhyRecommended`.
 * 3. Constructs a parameterized SQL query with all conditions
 *    and executes it against the `All_plants` table.
 * 4. Maps results into `IPlantRecommendationforPlat` objects,
 *    including the `whyRecommended` array.
 * 5. Limits results to 20 plants for performance.
 *
 * @example
 * const answers: IUserAnswer[] = [
 *   { questionId: 1, type: "space_types", selectedOption: "balcony" },
 *   { questionId: 2, type: "area_sizes", selectedOption: "ample" },
 *   { questionId: 3, type: "challenges", selectedOption: "aesthetics" }
 * ];
 *
 * const plants = await getRecommendedPlants(answers);
 * // Returns an array of plant objects with `whyRecommended` explanations
 *
 * @throws {Error} If there is a database error or query failure.
 */
export interface IPlantRecommendation {
  id: number;
  common_name: string | null;
  common_name_pt: string | null;
  scientific_name: string;
  image_url: string | null;
  family: string | null;
  genus: string | null;
  category: string | null;
  care_level: string | null;
  watering: string | null;
  watering_pt: string | null;
  sunlight: string | null;
  growth_rate: string | null;
  indoor: boolean | null;
  drought_tolerant: boolean | null;
  tropical: boolean | null;
  edible: boolean | null;
  medicinal: boolean | null;
  climate: string | null;
  brazil_region: string | null;
  color: string | null;
  blooming: string | null;
  description_pt: string | null;
  temperature_min: number | null;
  temperature_max: number | null;
  soil: string | null;
  cycle: string | null;
  whyRecommended: string[];
  matchScore: number;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// SCORE WEIGHTS
// Higher = that criterion matters more to the final ranking.
// ─────────────────────────────────────────────────────────────────────────────
 
const WEIGHTS = {
  location: 35,      // Most important: plant must be from the right region
  space_type: 30,    // Correct environment type (indoor/outdoor, category)
  challenge: 25,     // User's main gardening challenge
  area_size: 20,     // Space size match
  tech_pref: 20,     // Tech/watering preference
  has_image: 5,      // Bonus for plants with photos
  has_common_name: 5, // Bonus for well-documented plants
} as const;
 
// ─────────────────────────────────────────────────────────────────────────────
// LOCATION: Brazilian state → plant_care brazil_region values
//
// plant_care.brazil_region uses Portuguese names like:
//   "Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"
//   plus free-form strings like "Norte (tropical)", "Sul (subtropical)"
// ─────────────────────────────────────────────────────────────────────────────
 
const BRAZIL_STATE_TO_CARE_REGION: Record<string, string[]> = {
  // North
  amazonas:             ["Norte"],
  "pará":               ["Norte"],
  para:                 ["Norte"],
  roraima:              ["Norte"],
  "rondônia":           ["Norte"],
  rondonia:             ["Norte"],
  acre:                 ["Norte"],
  "amapá":              ["Norte"],
  amapa:                ["Norte"],
  tocantins:            ["Norte"],
  // Northeast
  "maranhão":           ["Nordeste"],
  maranhao:             ["Nordeste"],
  "piauí":              ["Nordeste"],
  piaui:                ["Nordeste"],
  "ceará":              ["Nordeste"],
  ceara:                ["Nordeste"],
  "rio grande do norte": ["Nordeste"],
  "paraíba":            ["Nordeste"],
  paraiba:              ["Nordeste"],
  pernambuco:           ["Nordeste"],
  alagoas:              ["Nordeste"],
  sergipe:              ["Nordeste"],
  bahia:                ["Nordeste"],
  // Southeast
  "são paulo":          ["Sudeste"],
  "sao paulo":          ["Sudeste"],
  "rio de janeiro":     ["Sudeste"],
  "minas gerais":       ["Sudeste"],
  "espírito santo":     ["Sudeste"],
  "espirito santo":     ["Sudeste"],
  // South
  "paraná":             ["Sul"],
  parana:               ["Sul"],
  "santa catarina":     ["Sul"],
  "rio grande do sul":  ["Sul"],
  // Central-West
  "mato grosso do sul": ["Centro-Oeste"],
  "mato grosso":        ["Centro-Oeste"],
  "goiás":              ["Centro-Oeste"],
  goias:                ["Centro-Oeste"],
  "distrito federal":   ["Centro-Oeste"],
  df:                   ["Centro-Oeste"],
};
 
// Climate hint per region — used to also match plant_care.climate column
const REGION_TO_CLIMATE: Record<string, string[]> = {
  Norte:        ["Tropical", "Tropical Humid", "Tropical Úmido"],
  Nordeste:     ["Tropical", "Tropical Seasonal", "Tropical Sazonal", "Semi-arid"],
  Sudeste:      ["Tropical", "Subtropical", "Tropical Seasonal"],
  Sul:          ["Subtropical", "Temperate", "Temperado"],
  "Centro-Oeste": ["Tropical", "Tropical Highland", "Tropical de Altitude", "Cerrado"],
};

/**
 * Maps a given location string (state name or partial match) to its corresponding care regions.
 *
 * @function stateToRegions
 * @param {string} location - The input location string (e.g., state name, partial state name, or user-provided value)
 *
 * @description
 * This function:
 * 1. Normalizes the input by converting it to lowercase and trimming whitespace.
 * 2. Attempts an exact match against the `BRAZIL_STATE_TO_CARE_REGION` mapping.
 * 3. If no exact match is found, performs a partial match:
 *    - Checks if the input includes a known state key OR
 *    - If a state key includes the input string.
 * 4. Returns the associated care regions if a match is found.
 * 5. Returns an empty array if no match exists.
 *
 * @returns {string[]} An array of care region identifiers. Returns an empty array if no matching state is found.
 *
 * @example
 * stateToRegions("São Paulo");
 * // → ["tropical", "subtropical"]
 *
 * @example
 * stateToRegions("paulo");
 * // → ["tropical", "subtropical"] (partial match)
 *
 * @example
 * stateToRegions("unknown");
 * // → []
 */
function stateToRegions(location: string): string[] {
  const key = location.toLowerCase().trim();
  if (BRAZIL_STATE_TO_CARE_REGION[key]) return BRAZIL_STATE_TO_CARE_REGION[key];
  // Partial match
  for (const [stateKey, regions] of Object.entries(BRAZIL_STATE_TO_CARE_REGION)) {
    if (key.includes(stateKey) || stateKey.includes(key)) return regions;
  }
  return [];
}
 
// ─────────────────────────────────────────────────────────────────────────────
// SPACE TYPE → category + indoor mapping
// ─────────────────────────────────────────────────────────────────────────────
 
interface SpaceProfile {
  indoorPreference: boolean | null; // true = indoor, false = outdoor, null = both
  categoryKeywords: string[];       // ILIKE fragments for plant_care.category
}
 
const SPACE_TYPE_PROFILES: Record<string, SpaceProfile> = {
  "home garden":            { indoorPreference: false, categoryKeywords: ["Tree", "Shrub", "Herb", "Forb"] },
  "balcony":                { indoorPreference: true,  categoryKeywords: ["Herb", "Shrub", "Climber", "Vine"] },
  "apartment balcony":      { indoorPreference: true,  categoryKeywords: ["Herb", "Shrub", "Succulent"] },
  "corporate outdoor area": { indoorPreference: false, categoryKeywords: ["Tree", "Shrub", "Palm"] },
  "corporate indoor":       { indoorPreference: true,  categoryKeywords: ["Herb", "Shrub", "Palm"] },
  "urban park":             { indoorPreference: false, categoryKeywords: ["Tree", "Shrub"] },
  "park":                   { indoorPreference: false, categoryKeywords: ["Tree", "Shrub"] },
  "farm":                   { indoorPreference: false, categoryKeywords: ["Herb", "Tree", "Grass", "Graminoid", "Edible"] },
  "avenue":                 { indoorPreference: false, categoryKeywords: ["Tree", "Palm"] },
  "botanical garden":       { indoorPreference: false, categoryKeywords: ["Tree", "Shrub", "Herb", "Climber"] },
  "community garden":       { indoorPreference: false, categoryKeywords: ["Herb", "Shrub", "Edible"] },
  "green wall":             { indoorPreference: null,  categoryKeywords: ["Climber", "Vine", "Fern", "Herb"] },
};
 
// ─────────────────────────────────────────────────────────────────────────────
// AREA SIZE → plant category size hints
// ─────────────────────────────────────────────────────────────────────────────
 
const AREA_SIZE_CATEGORIES: Record<string, string[]> = {
  intimate:  ["Herb", "Shrub", "Succulent", "Orchid", "Bromeliad", "Fern", "Climber"],
  ample:     ["Shrub", "Palm", "Tree", "Herb", "Bamboo"],
  extensive: ["Tree", "Palm", "Bamboo"],
};
 
// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE → plant_care column filters
// ─────────────────────────────────────────────────────────────────────────────
 
// Returns a CASE WHEN SQL fragment (no params — uses hard-coded safe values or IS NULL/NOT NULL)
// These are all string/boolean checks — safe to inline since values come from our own mapping, not user input.
 
interface ChallengeProfile {
  /** Extra scoring SQL fragment (added to score expression) */
  scoreSql: string;
  label: string;
}
/**
 * Builds a challenge-based scoring profile used to influence plant recommendations.
 *
 * @function buildChallengeProfile
 * @param {string} value - The challenge preference selected by the user
 * (e.g., "knowledge", "aesthetics", "maintenance", "control")
 *
 * @description
 * This function maps a user-selected challenge preference to:
 * 1. A SQL scoring expression (`scoreSql`) used to rank plants dynamically.
 * 2. A human-readable label describing the recommendation focus.
 *
 * Supported challenge types:
 * - "knowledge": Prioritizes well-documented plants with both common and scientific names.
 * - "aesthetics": Prioritizes visually appealing plants (color or blooming).
 * - "maintenance": Prefers low-maintenance plants, with moderate scoring fallback.
 * - "control": Prefers slow or moderately growing plants (easy to manage growth).
 *
 * The scoring logic uses predefined weights from `WEIGHTS.challenge` and may assign:
 * - Full score for strong matches
 * - Half score for moderate matches
 * - Zero for no match
 *
 * @returns {ChallengeProfile | null}
 * Returns a ChallengeProfile object containing:
 * - `scoreSql` {string}: SQL CASE expression for scoring
 * - `label` {string}: Description of the challenge type
 *
 * Returns `null` if the input value does not match any supported challenge type.
 *
 * @example
 * buildChallengeProfile("maintenance");
 * // → {
 * //   scoreSql: "CASE WHEN (...) THEN 10 WHEN (...) THEN 5 ELSE 0 END",
 * //   label: "low-maintenance"
 * // }
 *
 * @example
 * buildChallengeProfile("unknown");
 * // → null
 */ 
function buildChallengeProfile(value: string): ChallengeProfile | null {
  const v = value.toLowerCase().trim();
  if (v === "knowledge") {
    return {
      scoreSql: `CASE WHEN (common_name IS NOT NULL AND common_name <> '' AND scientific_name IS NOT NULL) THEN ${WEIGHTS.challenge} ELSE 0 END`,
      label: "educational/well-documented",
    };
  }
  if (v === "aesthetics") {
    return {
      scoreSql: `CASE WHEN (color IS NOT NULL OR blooming IS NOT NULL) THEN ${WEIGHTS.challenge} ELSE 0 END`,
      label: "ornamental",
    };
  }
  if (v === "maintenance") {
    return {
      scoreSql: `CASE WHEN (
        care_level ILIKE '%Low%' OR care_level ILIKE '%Easy%'
        OR watering ILIKE '%Low%' OR watering ILIKE '%Minimum%' OR drought_tolerant = TRUE
      ) THEN ${WEIGHTS.challenge} WHEN (
        care_level ILIKE '%Moderate%' OR watering ILIKE '%Average%'
      ) THEN ${Math.floor(WEIGHTS.challenge / 2)} ELSE 0 END`,
      label: "low-maintenance",
    };
  }
  if (v === "control") {
    return {
      scoreSql: `CASE WHEN (growth_rate ILIKE '%Slow%') THEN ${WEIGHTS.challenge}
                      WHEN (growth_rate ILIKE '%Moderate%') THEN ${Math.floor(WEIGHTS.challenge / 2)}
                      ELSE 0 END`,
      label: "easy to control",
    };
  }
  return null;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// TECH PREFERENCE → plant_care columns
// ─────────────────────────────────────────────────────────────────────────────
 
interface TechProfile {
  scoreSql: string;
  label: string;
}
/**
 * Builds a technology preference profile used to influence plant recommendation scoring.
 *
 * @function buildTechProfile
 * @param {string} value - The technology preference selected by the user
 * (e.g., "water savings", "automation", "mobile control", "irrigation automation")
 *
 * @description
 * This function maps a user-selected technology preference to:
 * 1. A SQL scoring expression (`scoreSql`) used to rank plants dynamically.
 * 2. A human-readable label describing the plant’s compatibility with the tech preference.
 *
 * Supported tech preferences:
 * - "water savings":
 *   Prioritizes drought-tolerant or low-water plants.
 *
 * - "automation" / "mobile control":
 *   Prefers plants that grow slowly and require low to moderate care,
 *   making them suitable for automated or remote-controlled systems.
 *
 * - "irrigation automation":
 *   Targets plants with moderate to frequent watering needs,
 *   making them compatible with irrigation systems.
 *
 * Scoring logic:
 * - Full score (`WEIGHTS.tech_pref`) for strong matches
 * - Half score for moderate matches
 * - Zero for non-matching plants
 *
 * @returns {TechProfile | null}
 * Returns a TechProfile object containing:
 * - `scoreSql` {string}: SQL CASE expression for scoring
 * - `label` {string}: Description of the tech compatibility
 *
 * Returns `null` if the input value does not match any supported preference.
 *
 * @example
 * buildTechProfile("water savings");
 * // → { scoreSql: "CASE WHEN (...) THEN 10 ...", label: "water-efficient" }
 *
 * @example
 * buildTechProfile("automation");
 * // → { scoreSql: "CASE WHEN (...) THEN 10 ...", label: "automation-friendly" }
 *
 * @example
 * buildTechProfile("unknown");
 * // → null
 */ 
function buildTechProfile(value: string): TechProfile | null {
  const v = value.toLowerCase().trim();
  if (v === "water savings") {
    return {
      scoreSql: `CASE WHEN (drought_tolerant = TRUE OR watering ILIKE '%Low%' OR watering ILIKE '%Minimum%' OR watering ILIKE '%Dry%')
                      THEN ${WEIGHTS.tech_pref}
                      WHEN watering ILIKE '%Average%' THEN ${Math.floor(WEIGHTS.tech_pref / 2)}
                      ELSE 0 END`,
      label: "water-efficient",
    };
  }
  if (v === "automation" || v === "mobile control") {
    return {
      scoreSql: `CASE WHEN (growth_rate ILIKE '%Slow%' AND (care_level ILIKE '%Low%' OR care_level ILIKE '%Moderate%'))
                      THEN ${WEIGHTS.tech_pref}
                      WHEN (growth_rate ILIKE '%Slow%' OR growth_rate ILIKE '%Moderate%')
                      THEN ${Math.floor(WEIGHTS.tech_pref / 2)}
                      ELSE 0 END`,
      label: "automation-friendly",
    };
  }
  if (v === "irrigation automation") {
    return {
      scoreSql: `CASE WHEN (watering ILIKE '%Average%' OR watering ILIKE '%Medium%' OR watering ILIKE '%Frequent%')
                      THEN ${WEIGHTS.tech_pref}
                      WHEN (watering ILIKE '%High%') THEN ${Math.floor(WEIGHTS.tech_pref / 2)}
                      ELSE 0 END`,
      label: "irrigation-automation compatible",
    };
  }
  return null;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// WHY RECOMMENDED builder — human-readable explanations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generates human-readable reasons explaining why a plant was recommended.
 *
 * @function buildWhyRecommended
 * @param {Record<string, unknown>} plant - Plant data object containing attributes
 * such as category, color, blooming, watering, growth_rate, etc.
 * @param {Object} criteria - User-selected criteria used for generating explanations
 * @param {string} [criteria.spaceLabel] - Label describing the user's available space
 * @param {string} [criteria.areaLabel] - Label describing the area type (e.g., indoor/outdoor)
 * @param {string} [criteria.challengeLabel] - Label representing challenge preference
 * @param {string} [criteria.techLabel] - Label representing tech preference
 * @param {string} [criteria.locationLabel] - Label for user’s geographic location
 *
 * @description
 * This function builds a list of explanation strings ("why recommended") based on:
 * - Space suitability (category match)
 * - Area compatibility (indoor/outdoor)
 * - Challenge preferences (learning, aesthetics, maintenance, control)
 * - Technology preferences (automation, irrigation, water efficiency)
 * - Location relevance (native or suitable region)
 *
 * It dynamically incorporates plant attributes such as:
 * - `category`, `color`, `blooming`
 * - `watering`, `watering_pt`, `drought_tolerant`
 * - `growth_rate`, `brazil_region`
 *
 * If no criteria match, a default fallback reason is returned.
 *
 * @returns {string[]} Array of human-readable recommendation reasons
 *
 * @example
 * buildWhyRecommended(plant, {
 *   spaceLabel: "small apartments",
 *   challengeLabel: "low-maintenance",
 *   techLabel: "water-efficient"
 * });
 * // → [
 * //   "Suitable for small apartments — grows as shrub",
 * //   "Low-maintenance — watering: low, drought-tolerant",
 * //   "Water-efficient — watering needs: low (drought-tolerant)"
 * // ]
 *
 * @example
 * buildWhyRecommended(plant, {});
 * // → ["Matches your plant preferences"]
 */
function buildWhyRecommended(
  plant: Record<string, unknown>,
  criteria: {
    spaceLabel?: string;
    areaLabel?: string;
    challengeLabel?: string;
    techLabel?: string;
    locationLabel?: string;
  }
): string[] {
  const why: string[] = [];
 
  if (criteria.spaceLabel) {
    const cat = plant.category as string | null;
    why.push(
      `Suitable for ${criteria.spaceLabel}` +
        (cat ? ` — grows as ${cat.toLowerCase()}` : "")
    );
  }
 
  if (criteria.areaLabel) {
    why.push(`Fits your ${criteria.areaLabel} space`);
  }
 
  if (criteria.challengeLabel) {
    const label = criteria.challengeLabel;
    if (label === "educational/well-documented") {
      why.push(`Well-documented species — ideal for learning`);
    } else if (label === "ornamental") {
      const parts = [
        plant.color ? `colors: ${plant.color}` : null,
        plant.blooming ? `blooms: ${plant.blooming}` : null,
      ].filter(Boolean).join(", ");
      why.push(`Ornamental value${parts ? ` (${parts})` : ""}`);
    } else if (label === "low-maintenance") {
      const waterPt = plant.watering_pt ?? plant.watering ?? "moderate";
      const droughtNote = plant.drought_tolerant ? ", drought-tolerant" : "";
      why.push(`Low-maintenance — watering: ${waterPt}${droughtNote}`);
    } else if (label === "easy to control") {
      const rate = (plant.growth_rate as string) ?? "moderate";
      why.push(`Easy to control — ${rate.toLowerCase()} growth rate`);
    }
  }
 
  if (criteria.techLabel) {
    const label = criteria.techLabel;
    if (label === "water-efficient") {
      const w = plant.watering_pt ?? plant.watering ?? "low";
      const dt = plant.drought_tolerant ? " (drought-tolerant)" : "";
      why.push(`Water-efficient — watering needs: ${w}${dt}`);
    } else if (label === "automation-friendly") {
      const rate = (plant.growth_rate as string) ?? "moderate";
      why.push(`Automation-friendly — ${rate.toLowerCase()} growth rate`);
    } else if (label === "irrigation-automation compatible") {
      const w = plant.watering_pt ?? plant.watering ?? "average";
      why.push(`Compatible with automated irrigation (watering: ${w})`);
    }
  }
 
  if (criteria.locationLabel) {
    const region = plant.brazil_region as string | null;
    why.push(
      `Found in your region (${criteria.locationLabel})` +
        (region ? ` — native to: ${region}` : "")
    );
  }
 
  if (why.length === 0) {
    why.push("Matches your plant preferences");
  }
 
  return why;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// MAIN RECOMMENDATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Generates plant recommendations based on user survey answers using a
 * dynamic scoring system and fallback strategy.
 *
 * @async
 * @function getRecommendedPlants
 * @param {IUserAnswer[]} answers - Array of user answers mapped by question index
 *
 * @description
 * This function:
 * - Builds a dynamic SQL scoring query based on user preferences
 * - Applies weighted scoring across multiple dimensions:
 *   - Space type (indoor/outdoor, category match)
 *   - Area size (category suitability)
 *   - Challenge preference (maintenance, aesthetics, control, etc.)
 *   - Technology preference (automation, irrigation, water efficiency)
 *   - Location (region, climate, tropical compatibility)
 * - Adds universal quality bonuses (image availability, common name presence)
 * - Executes the query to rank plants by relevance (`match_score`)
 * - Applies a fallback query if insufficient results are returned
 * - Maps raw database rows into a structured recommendation format
 * - Generates human-readable explanations using `buildWhyRecommended`
 *
 * Scoring characteristics:
 * - Fully dynamic (no strict WHERE filters except valid scientific name)
 * - Uses parameterized queries for safety and flexibility
 * - Combines multiple weighted CASE expressions into a single score
 *
 * Fallback behavior:
 * - Triggered when results are below `MIN_RESULTS`
 * - Fetches random, well-documented plants with images
 * - Ensures no duplicate plant IDs in final output
 *
 * @returns {Promise<IPlantRecommendation[]>}
 * Resolves to an array of plant recommendations including:
 * - Plant metadata (name, category, care info, etc.)
 * - Computed `matchScore`
 * - Generated `whyRecommended` explanations
 *
 * @throws {Error}
 * Logs database query failures internally but does not throw;
 * returns best-effort results instead
 */
export const getRecommendedPlants = async (
  answers: IUserAnswer[]
): Promise<IPlantRecommendation[]> => {
  const client = await getDB();
  const LIMIT = 10;
  const MIN_RESULTS = 5;
 
  // ── Collect scoring fragments & labels ──────────────────────────────────────
  const scoreFragments: string[] = [];
  const queryParams: unknown[] = [];
  let paramIdx = 1;
 
  const labels: {
    spaceLabel?: string;
    areaLabel?: string;
    challengeLabel?: string;
    techLabel?: string;
    locationLabel?: string;
  } = {};
 
  /**
 * Builds a parameterized SQL CASE WHEN expression for matching a column
 * against multiple keywords using ILIKE (case-insensitive pattern matching).
 *
 * @function ilikeCaseWhen
 * @param {string} column - The database column name to evaluate
 * @param {string[]} keywords - List of keywords to match against the column
 * @param {number} score - Score to assign if any keyword match is found
 *
 * @description
 * This helper function:
 * - Generates a SQL CASE WHEN clause using ILIKE conditions
 * - Creates parameterized placeholders (`$N`) for each keyword
 * - Pushes `%keyword%` patterns into the shared `queryParams` array
 * - Increments the shared `paramIdx` counter for each parameter
 * - Combines all conditions using OR logic
 *
 * The resulting SQL expression returns:
 * - `score` if any keyword matches the column
 * - `0` if no match is found
 *
 * Note:
 * - Relies on external mutable variables `paramIdx` and `queryParams`
 *   for parameter indexing and value binding
 * - Designed to be safely used in parameterized queries to prevent SQL injection
 *
 * @returns {string} SQL CASE WHEN expression string
 */
  function ilikeCaseWhen(
    column: string,
    keywords: string[],
    score: number
  ): string {
    const clauses = keywords.map((_) => {
      const ph = `$${paramIdx++}`;
      queryParams.push(`%${_}%`);
      return `${column} ILIKE ${ph}`;
    });
    return `CASE WHEN (${clauses.join(" OR ")}) THEN ${score} ELSE 0 END`;
  }
 
  // ── FIELD 0: space_types ────────────────────────────────────────────────────
  const spaceAns = answers[FieldIndex.space_types];
  if (spaceAns?.selectedOption?.trim()) {
    const spaceVal = spaceAns.selectedOption.trim().toLowerCase();
    const profile = SPACE_TYPE_PROFILES[spaceVal] ?? {
      indoorPreference: null,
      categoryKeywords: ["Tree", "Shrub", "Herb"],
    };
 
    labels.spaceLabel = spaceAns.selectedOption.trim();
 
    // Category match
    if (profile.categoryKeywords.length > 0) {
      scoreFragments.push(
        ilikeCaseWhen("category", profile.categoryKeywords, WEIGHTS.space_type)
      );
    }
 
    // Indoor/outdoor match bonus
    if (profile.indoorPreference !== null) {
      const expected = profile.indoorPreference; // true | false
      const ph = `$${paramIdx++}`;
      queryParams.push(expected);
      scoreFragments.push(
        `CASE WHEN indoor = ${ph} THEN ${Math.floor(WEIGHTS.space_type / 2)} ELSE 0 END`
      );
    }
  }
 
  // ── FIELD 1: area_sizes ─────────────────────────────────────────────────────
  const areaAns = answers[FieldIndex.area_sizes];
  if (areaAns?.selectedOption?.trim()) {
    const areaVal = areaAns.selectedOption.trim().toLowerCase();
    const cats = AREA_SIZE_CATEGORIES[areaVal] ?? ["Tree", "Shrub", "Herb"];
    labels.areaLabel = areaVal;
    scoreFragments.push(ilikeCaseWhen("category", cats, WEIGHTS.area_size));
  }
 
  // ── FIELD 2: challenges ─────────────────────────────────────────────────────
  const challengeAns = answers[FieldIndex.challenges];
  if (challengeAns?.selectedOption?.trim()) {
    const profile = buildChallengeProfile(challengeAns.selectedOption.trim());
    if (profile) {
      labels.challengeLabel = profile.label;
      scoreFragments.push(profile.scoreSql);
    }
  }
 
  // ── FIELD 3: tech_preferences ───────────────────────────────────────────────
  const techAns = answers[FieldIndex.tech_preferences];
  if (techAns?.selectedOption?.trim()) {
    const profile = buildTechProfile(techAns.selectedOption.trim());
    if (profile) {
      labels.techLabel = profile.label;
      scoreFragments.push(profile.scoreSql);
    }
  }
 
  // ── FIELD 4: locations ──────────────────────────────────────────────────────
  const locationAns = answers[FieldIndex.locations];
  if (locationAns?.selectedAddress) {
    const { state, city } = locationAns.selectedAddress;
    const regionSet = new Set<string>();
    const climateSet = new Set<string>();
 
    for (const loc of [state, city].filter(Boolean) as string[]) {
      for (const r of stateToRegions(loc)) {
        regionSet.add(r);
        for (const c of REGION_TO_CLIMATE[r] ?? []) climateSet.add(c);
      }
    }
 
    if (regionSet.size > 0) {
      const regions = [...regionSet];
      const climates = [...climateSet];
 
      labels.locationLabel = [city, state].filter(Boolean).join(", ");
 
      // brazil_region column score
      const regionClauses = regions.map((_) => {
        const ph = `$${paramIdx++}`;
        queryParams.push(`%${_}%`);
        return `brazil_region ILIKE ${ph}`;
      });
      scoreFragments.push(
        `CASE WHEN (${regionClauses.join(" OR ")}) THEN ${WEIGHTS.location} ELSE 0 END`
      );
 
      // climate column bonus
      if (climates.length > 0) {
        const climateClauses = climates.map((_) => {
          const ph = `$${paramIdx++}`;
          queryParams.push(`%${_}%`);
          return `climate ILIKE ${ph}`;
        });
        scoreFragments.push(
          `CASE WHEN (${climateClauses.join(" OR ")}) THEN ${Math.floor(WEIGHTS.location / 2)} ELSE 0 END`
        );
      }
 
      // tropical flag bonus for Norte/Nordeste
      if (regions.some((r) => ["Norte", "Nordeste"].includes(r))) {
        scoreFragments.push(
          `CASE WHEN tropical = TRUE THEN ${Math.floor(WEIGHTS.location / 3)} ELSE 0 END`
        );
      }
    }
  }
 
  // ── Universal quality bonuses (always applied) ───────────────────────────────
  scoreFragments.push(
    `CASE WHEN (image_url IS NOT NULL AND image_url <> '') THEN ${WEIGHTS.has_image} ELSE 0 END`
  );
  scoreFragments.push(
    `CASE WHEN (common_name IS NOT NULL AND common_name <> '') THEN ${WEIGHTS.has_common_name} ELSE 0 END`
  );
 
  // ── Compose total score expression ───────────────────────────────────────────
  const totalScoreExpr =
    scoreFragments.length > 0
      ? `(${scoreFragments.join(" + ")})`
      : "0";
 
  // ── Main query: all criteria are scoring-only, no hard WHERE filters ─────────
  const mainQuery = `
    SELECT
      id,
      common_name,
      common_name_pt,
      scientific_name,
      image_url,
      family,
      genus,
      category,
      care_level,
      watering,
      watering_pt,
      sunlight,
      growth_rate,
      indoor,
      drought_tolerant,
      tropical,
      edible,
      
      climate,
      brazil_region,
      color,
      blooming,
      description_pt,
      temperature_min,
      temperature_max,
      soil,
      cycle,
      ${totalScoreExpr} AS match_score
    FROM plant_care
    WHERE
      scientific_name IS NOT NULL
      AND scientific_name <> ''
    ORDER BY match_score DESC, RANDOM()
    LIMIT $${paramIdx};
  `;
  queryParams.push(LIMIT);
 
  let rows: Record<string, unknown>[] = [];
 
  try {
    const result = await client.query(mainQuery, queryParams);
    rows = result.rows;
  } catch (err) {
    console.error("[getRecommendedPlants] Main query failed:", err);
  }
 
  // ── Tier-2 fallback: no scoring, just return well-documented plants ───────────
  if (rows.length < MIN_RESULTS) {
    // console.warn(
    //   `[getRecommendedPlants] Only ${rows.length} results — running fallback query`
    // );
    try {
      const fallbackResult = await client.query(
        `SELECT
           id, common_name, common_name_pt, scientific_name, image_url,
           family, genus, category, care_level, watering, watering_pt,
           sunlight, growth_rate, indoor, drought_tolerant, tropical,
           edible, medicinal, climate, brazil_region, color, blooming,
           description_pt, temperature_min, temperature_max, soil, cycle,
           0 AS match_score
         FROM plant_care
         WHERE scientific_name IS NOT NULL AND scientific_name <> ''
           AND image_url IS NOT NULL AND image_url <> ''
         ORDER BY RANDOM()
         LIMIT $1`,
        [LIMIT - rows.length]
      );
      // Merge: avoid duplicate ids
      const existingIds = new Set(rows.map((r) => r.id));
      for (const r of fallbackResult.rows) {
        if (!existingIds.has(r.id)) rows.push(r);
        if (rows.length >= LIMIT) break;
      }
    } catch (err) {
      console.error("[getRecommendedPlants] Fallback query failed:", err);
    }
  }
 
  // ── Map to output type ────────────────────────────────────────────────────────
  return rows.map((plant) => ({
    id: plant.id as number,
    common_name: (plant.common_name as string) ?? null,
    common_name_pt: (plant.common_name_pt as string) ?? null,
    scientific_name: plant.scientific_name as string,
    image_url: (plant.image_url as string) ?? null,
    family: (plant.family as string) ?? null,
    genus: (plant.genus as string) ?? null,
    category: (plant.category as string) ?? null,
    care_level: (plant.care_level as string) ?? null,
    watering: (plant.watering as string) ?? null,
    watering_pt: (plant.watering_pt as string) ?? null,
    sunlight: (plant.sunlight as string) ?? null,
    growth_rate: (plant.growth_rate as string) ?? null,
    indoor: (plant.indoor as boolean) ?? null,
    drought_tolerant: (plant.drought_tolerant as boolean) ?? null,
    tropical: (plant.tropical as boolean) ?? null,
    edible: (plant.edible as boolean) ?? null,
    medicinal: (plant.medicinal as boolean) ?? null,
    climate: (plant.climate as string) ?? null,
    brazil_region: (plant.brazil_region as string) ?? null,
    color: (plant.color as string) ?? null,
    blooming: (plant.blooming as string) ?? null,
    description_pt: (plant.description_pt as string) ?? null,
    temperature_min: (plant.temperature_min as number) ?? null,
    temperature_max: (plant.temperature_max as number) ?? null,
    soil: (plant.soil as string) ?? null,
    cycle: (plant.cycle as string) ?? null,
    matchScore: (plant.match_score as number) ?? 0,
    whyRecommended: buildWhyRecommended(plant, labels),
  }));
};