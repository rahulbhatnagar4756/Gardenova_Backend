import { getDB } from "../../core/config/db";
import { AddUserPlantInput, CareNotificationInput, CareUpdateFields, FlatUpdateUserPlantInput, PaginatedUserPlants, PlantDetailsResponse, PlantResponse, UpdateUserPlantInput, UserPlant } from "../../interface/myPlants";
import { PaginatedPlants } from "../../interface/plants";



// /**
//  * Retrieves paginated plant species from the database.
//  *
//  * @param {number} page - Current page number.
//  * @param {number} limit - Number of records per page.
//  * @param lang
//  * @param search
//  * @returns {Promise<PaginatedPlants>} Paginated plant result including
//  * current page, total pages, total count, and plant list.
//  */
// export const getAllPlantsService = async (
//     page: number,
//     limit: number,
//     lang: string,
//     search?: string
// ): Promise<PaginatedPlants> => {
//     const pool = await getDB();

//     const safePage  = Math.max(1, page);
//     const safeLimit = Math.min(100, Math.max(1, limit));
//     const offset    = (safePage - 1) * safeLimit;

//     const isPT          = lang?.toLowerCase().startsWith("pt");
//     const commonNameCol = isPT
//         ? `COALESCE(pc.common_name_pt, pc.common_name)`
//         : `pc.common_name`;
//     const nameCol      = isPT ? `pc.common_name_pt` : `pc.common_name`;
//     const tsvectorLang = isPT ? `'portuguese'`       : `'english'`;

//     // ── Base JOIN ─────────────────────────────────────────────────────────────
//     const joinClause = `
//         FROM  all_plants  ap
//         LEFT  JOIN plant_care pc ON ap.scientific_name = pc.scientific_name
//     `;

//     // ── Search condition ──────────────────────────────────────────────────────
//     // $1 = exact | $2 = starts-with (search%) | $3 = contains (%search%)
//     const searchCondition = search
//         ? `WHERE (
//             to_tsvector(${tsvectorLang}, unaccent(COALESCE(${nameCol}, '')))         @@ plainto_tsquery(${tsvectorLang}, unaccent($1)) OR
//             to_tsvector('simple',        unaccent(COALESCE(pc.scientific_name, ''))) @@ plainto_tsquery('simple',        unaccent($1)) OR
//             unaccent(${nameCol})          % unaccent($1) OR
//             unaccent(pc.scientific_name)  % unaccent($1) OR
//             unaccent(${nameCol})          ILIKE unaccent($3) OR
//             unaccent(pc.scientific_name)  ILIKE unaccent($3)
//         )`
//         : "";

//     // ── Relevance score ───────────────────────────────────────────────────────
//     const relevanceScore = search
//         ? `(
//             -- Exact match (highest)
//             CASE WHEN unaccent(${nameCol})         ILIKE unaccent($1) THEN 100 ELSE 0 END +
//             CASE WHEN unaccent(pc.scientific_name) ILIKE unaccent($1) THEN 100 ELSE 0 END +

//             -- Starts with
//             CASE WHEN unaccent(${nameCol})         ILIKE unaccent($2) THEN  75 ELSE 0 END +
//             CASE WHEN unaccent(pc.scientific_name) ILIKE unaccent($2) THEN  75 ELSE 0 END +

//             -- Contains anywhere
//             CASE WHEN unaccent(${nameCol})         ILIKE unaccent($3) THEN  50 ELSE 0 END +
//             CASE WHEN unaccent(pc.scientific_name) ILIKE unaccent($3) THEN  50 ELSE 0 END +

//             -- Full-text match
//             CASE WHEN to_tsvector(${tsvectorLang}, unaccent(COALESCE(${nameCol}, '')))         @@ plainto_tsquery(${tsvectorLang}, unaccent($1)) THEN 10 ELSE 0 END +
//             CASE WHEN to_tsvector('simple',        unaccent(COALESCE(pc.scientific_name, ''))) @@ plainto_tsquery('simple',        unaccent($1)) THEN 10 ELSE 0 END +

//             -- Fuzzy / trigram (lowest)
//             CASE WHEN unaccent(${nameCol})         % unaccent($1) THEN 5 ELSE 0 END +
//             CASE WHEN unaccent(pc.scientific_name) % unaccent($1) THEN 5 ELSE 0 END
//         )`
//         : "0";

//     // $1 = search | $2 = search% | $3 = %search%
//     const baseParams: (string | number)[] = search
//         ? [search, `${search.trim()}%`, `%${search.trim()}%`]
//         : [];

//     // param indices shift depending on whether search is present
//     const limitIdx  = search ? 4 : 1;
//     const offsetIdx = search ? 5 : 2;

//     // ── Total count ───────────────────────────────────────────────────────────
//     const totalResult = await pool.query(
//         `SELECT COUNT(*)::int AS count
//          ${joinClause}
//          ${searchCondition}`,
//         baseParams
//     );

//     const totalCount = totalResult.rows[0]?.count ?? 0;
//     const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / safeLimit);

//     // ── Data ──────────────────────────────────────────────────────────────────
//     const plantsResult = await pool.query(
//         `SELECT
//             pc.id,
//             pc.scientific_name,
//             ${commonNameCol}                AS common_name,
//             pc.family,
//             pc.genus,
//             pc.image_url,
//             pc.created_at,
//             pc.updated_at,
//             ${relevanceScore}               AS relevance
//          ${joinClause}
//          ${searchCondition}
//          ORDER BY relevance DESC, pc.id ASC
//          LIMIT  $${limitIdx}
//          OFFSET $${offsetIdx}`,
//         [...baseParams, safeLimit, offset]
//     );

//     return {
//         currentPage: safePage,
//         totalPages,
//         totalCount,
//         limit: safeLimit,
//         plants: plantsResult.rows,
//     };
// };


/**
 * Retrieves paginated plant species from the database.
 *
 * @param {number} page - Current page number.
 * @param {number} limit - Number of records per page.
 * @param lang
 * @param search
 * @returns {Promise<PaginatedPlants>} Paginated plant result including
 * current page, total pages, total count, and plant list.
 */
export const getAllPlantsService = async (
    page: number,
    limit: number,
    lang: string,
    search?: string
): Promise<PaginatedPlants> => {
    const pool = await getDB();
    const offset = (page - 1) * limit;

    const isPT = lang?.toLowerCase().startsWith("pt");

    // ✅ Select correct column
    const nameCol = isPT ? "pc.common_name_pt" : "pc.common_name";

    const searchValue = search?.trim() || "";

    // ✅ SEARCH CONDITION
    const searchCondition = search
        ? `
    WHERE (
      unaccent(pc.scientific_name) ILIKE unaccent($2)
      OR unaccent(${nameCol}) ILIKE unaccent($2)

      OR to_tsvector('simple', unaccent(COALESCE(pc.scientific_name,''))) @@ plainto_tsquery('simple', unaccent($1))
      OR to_tsvector('simple', unaccent(COALESCE(${nameCol},''))) @@ plainto_tsquery('simple', unaccent($1))

      OR unaccent(pc.scientific_name) % unaccent($1)
      OR unaccent(${nameCol}) % unaccent($1)
    )
  `
        : "";

    // ✅ RELEVANCE SCORE
    const relevanceScore = search
        ? `
    CASE
      WHEN unaccent(pc.scientific_name) ILIKE unaccent($2) THEN 300
      WHEN unaccent(${nameCol}) ILIKE unaccent($2) THEN 300

      WHEN to_tsvector('simple', unaccent(COALESCE(pc.scientific_name,''))) @@ plainto_tsquery('simple', unaccent($1)) THEN 150
      WHEN to_tsvector('simple', unaccent(COALESCE(${nameCol},''))) @@ plainto_tsquery('simple', unaccent($1)) THEN 150

      WHEN unaccent(pc.scientific_name) % unaccent($1) THEN 80
      WHEN unaccent(${nameCol}) % unaccent($1) THEN 80

      ELSE 0
    END
  `
        : "0";

    const joinClause = `
    FROM all_plants ap
    LEFT JOIN plant_care pc ON ap.scientific_name = pc.scientific_name
  `;

    // ✅ PARAMS
    const params = search
        ? [searchValue, `${searchValue}%`, limit, offset]
        : [limit, offset];

    // ✅ TOTAL COUNT
    const totalQuery = `
    SELECT COUNT(*) 
    ${joinClause}
    ${searchCondition}
  `;

    const totalResult = await pool.query(
        totalQuery,
        search ? [searchValue, `${searchValue}%`] : []
    );

    const totalCount = Number(totalResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // ✅ MAIN QUERY
    const dataQuery = `
    SELECT
      pc.id,
      pc.scientific_name,
      ${nameCol} AS common_name,
      pc.family,
      pc.genus,
      pc.image_url,
      pc.created_at,
      pc.updated_at,
      ${relevanceScore} AS relevance

    ${joinClause}
    ${searchCondition}

    ORDER BY relevance DESC, pc.scientific_name ASC
    LIMIT $${search ? 3 : 1}
    OFFSET $${search ? 4 : 2}
  `;

    const plantsResult = await pool.query(dataQuery, params);

    return {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        plants: plantsResult.rows,
    };
};





/**
 * Retrieves detailed information about a plant by its ID.
 *
 * @param {string} plantId - UUID of the plant.
 * @param lang
 * @throws {Error} If plant is not found or database query fails.
 * @returns {Promise<void>} Plant details object.
 * @throws {Error} If plant is not found or database query fails.
 */
export const getPlantDetailsByIdService = async (
    plantId: string,
    lang: string        //  added
): Promise<PlantResponse> => {
    try {
        const pool = await getDB();

        const id = Number(plantId);
        if (isNaN(id)) throw new Error("Invalid plant ID");

        const isPT = lang.startsWith("pt");

        // Language-aware common_name column
        const commonNameCol = isPT
            ? `COALESCE(pc.common_name_pt, pc.common_name)`
            : `pc.common_name`;

        const result = await pool.query(
            `SELECT scientific_name FROM plant_care WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) throw new Error("Plant not found");

        const plantDetailsResult = await pool.query(
            `SELECT
                pc.id AS plant_id,
                ${commonNameCol} AS common_name,   -- 👈 language-aware
                pc.scientific_name,
                pc.family,
                pc.genus,
                pc.watering,
                pc.sunlight,
                pc.care_level,
                pc.growth_rate,
                pc.indoor,
                pc.temperature_min,
                pc.temperature_max,
                pc.humidity_min,
                pc.humidity_max,
                pc.light_min,
                pc.light_max,
                pc.soil_moisture_min,
                pc.soil_moisture_max,
                pc.poisonous_to_humans,
                pc.poisonous_to_pets,
                pc.drought_tolerant,
                pc.tropical,
                pc.medical,
                pc.edible,
                pc.soil,
                pc.fertilizer,
                pc.pruning,
                pc.cycle,
                pc.pest,
                pc.diseases,
                pc.origin,
                pc.category,
                pc.climate,
                pc.color,
                pc.blooming,
                pc.description,
                pc.image_url,
                pc.source
            FROM plant_care pc
            
            WHERE pc.scientific_name = $1`,
            [result.rows[0].scientific_name]
        );

        const fallbackResult = await pool.query(
            `SELECT id AS plant_id, common_name, scientific_name, family, genus, image_url
             FROM all_plants
             WHERE id = $1`,
            [id]
        );

        return {
            plant: plantDetailsResult.rows[0] ?? fallbackResult.rows[0],
            reminder: {
                watering_notification_enabled: false,
                watering_reminder_frequency: 0,
                watering_preferred_time: "09:00:00",

                fertilizer_notification_enabled: false,
                fertilizer_reminder_frequency: 0,
                fertilizer_preferred_time: "09:00:00",

                puring_notification_enabled: false,
                pruning_reminder_frequency: 0,

                generic_notification_enabled: false,
                generic_care_reminder_frequency: 0,
            },
        };
    } catch (err) {
        if (err instanceof Error) throw err;
        throw new Error("Failed to fetch plant details");
    }
}
/**
 * Calculates the date that is a specified number of days ahead of the current date.
 *
 * @param {number | null} days - The number of days to add to the current date. If `null`, the function will return `null`.
 * @returns {Date | null} - The resulting date after adding the specified number of days. If `days` is `null`, returns `null`.
 */
const calculateNextDate = (days: number | null): Date | null => {
    if (days === null || days === undefined) return null;
    const next = new Date();
    next.setDate(next.getDate() + days);
    return next;
};


/**
 * Adds a plant to a user's plant collection.
 *
 * @param {string} userId - UUID of the user.
 * @param {string} payload - UUID of the plant to add.
 * @returns {Promise<void>} Inserted user_plant record.
 * @throws {Error} If plant does not exist, already added,
 * or database operation fails.
 */
// service.ts
export const addPlantToUserService = async (
    userId: string,
    payload: AddUserPlantInput
): Promise<Record<string, unknown>> => {
    const pool = await getDB();

    const {
        plant_id,
        watering_notification_enabled,
        watering_preferred_time,
        watering_reminder_frequency,
        fertilizer_notification_enabled,
        fertilizer_preferred_time,
        fertilizer_reminder_frequency,
        pruning_notification_enabled,
        pruning_reminder_frequency,
        generic_notification_enabled,
        generic_care_reminder_frequency,
    } = payload;

    // ── Verify plant species exists ───────────────────────────────────────────
    const species = await pool.query(
        `SELECT id FROM plant_care WHERE id = $1`,
        [plant_id]
    );

    if (!species.rows.length) {
        throw new Error("Plant species not found");
    }

    // ── Calculate next care dates (null when notification disabled) ───────────
    const next_watered_at = calculateNextDate(
        watering_notification_enabled ? (watering_reminder_frequency ?? null) : null
    );

    const next_fertilized_at = calculateNextDate(
        fertilizer_notification_enabled ? (fertilizer_reminder_frequency ?? null) : null
    );

    const next_pruned_at = calculateNextDate(
        pruning_notification_enabled ? (pruning_reminder_frequency ?? null) : null
    );

    const next_generic_care_at = calculateNextDate(
        generic_notification_enabled ? (generic_care_reminder_frequency ?? null) : null
    );

    // ── Insert ────────────────────────────────────────────────────────────────
    try {
        const result = await pool.query(
            `
            INSERT INTO user_plants (
                user_id,
                plant_id,
                watering_notification_enabled,
                watering_preferred_time,
                watering_reminder_frequency,
                next_watered_at,
                fertilizer_notification_enabled,
                fertilizer_preferred_time,
                fertilizer_reminder_frequency,
                next_fertilized_at,
                pruning_notification_enabled,
                pruning_reminder_frequency,
                next_pruned_at,
                generic_notification_enabled,
                generic_care_reminder_frequency,
                next_generic_care_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING *
            `,
            [
                userId,
                plant_id,
                watering_notification_enabled ?? false,
                watering_preferred_time ?? "09:00:00",
                watering_reminder_frequency ?? 0,
                next_watered_at,
                fertilizer_notification_enabled ?? false,
                fertilizer_preferred_time ?? "09:00:00",
                fertilizer_reminder_frequency ?? 0,
                next_fertilized_at,
                pruning_notification_enabled ?? false,
                pruning_reminder_frequency ?? 0,
                next_pruned_at,
                generic_notification_enabled ?? false,
                generic_care_reminder_frequency ?? 0,
                next_generic_care_at,
            ]
        );

        return result.rows[0];
    } catch (err) {
        if (
            err instanceof Error &&
            err.message.includes("duplicate key value violates unique constraint")
        ) {
            throw new Error("Plant already added to user");
        }
        throw err;
    }
};


/**
 * Retrieves all plants associated with a specific user.
 *
 * @param {string} userId - UUID of the user.
 * @param {number} page - Current page number for pagination.
 * @param {number} limit - Number of records per page for pagination.
 * @param {string} [search] - Optional search term to filter plants by common name, scientific name, or description.
 * @returns {Promise<Record<string, unknown>[]>} List of plants added by the user.
 * @throws {Error} If database query fails.
 */
// ── Service ───────────────────────────────────────────────────────────────────
const USER_PLANT_SELECT = `
    up.id                               AS user_plant_id,
    pc.id                               AS plant_id,
    pc.common_name,
    pc.scientific_name,
    pc.family,
    pc.genus,
    pc.image_url,
    up.health_status,
    up.watering_notification_enabled,
    up.watering_preferred_time,
    up.watering_reminder_frequency,
    up.last_watered_at,
    up.last_watered_at,
    up.next_watered_at,
    up.fertilizer_notification_enabled,
    up.fertilizer_preferred_time,
    up.fertilizer_reminder_frequency,
    up.last_fertilized_at,
    up.next_fertilized_at,
    up.pruning_notification_enabled,
    up.pruning_reminder_frequency,
    up.last_pruned_at,
    up.next_pruned_at,
    up.generic_notification_enabled,
    up.generic_care_reminder_frequency,
    up.last_generic_care_at,
    up.next_generic_care_at,
    up.added_at,
    up.created_at,
    up.updated_at
`;
/**
 * Retrieves a paginated list of a user's plants with optional search.
 *
 * @param {string} userId - The UUID of the user whose plants are being retrieved.
 * @param {number} [page=1] - The page number for pagination (1-based). Minimum is 1.
 * @param {number} [limit=10] - The number of plants per page. Minimum 1, maximum 100.
 * @param {string} [search] - Optional search string to filter plants by `common_name` or `scientific_name`.
 *
 * @param lang
 * @returns {Promise<PaginatedUserPlants>} An object containing:
 *   - `currentPage`: The current page number
 *   - `totalPages`: Total number of pages available
 *   - `totalCount`: Total number of matching plants
 *   - `limit`: Number of plants per page
 *   - `plants`: Array of `UserPlant` objects for the current page
 *
 * @example
 * const result = await getUserPlantsService("d4e5f6a1-b2c3-4567-89ab-cdef01234567", 1, 10, "rose");
 * console.log(result.currentPage); // 1
 * console.log(result.totalPages);  // 5
 * console.log(result.plants);      // Array of UserPlant objects
 *
 * @remarks
 * - Applies search filtering using ILIKE on both `common_name` and `scientific_name`.
 * - Pagination is applied using LIMIT and OFFSET.
 * - The function automatically constrains `page` and `limit` to valid ranges.
 */
export const getUserPlantsService = async (
    userId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    lang?: string
): Promise<PaginatedUserPlants> => {

    const pool = await getDB();

    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    const isPT        = lang?.toLowerCase().startsWith("pt");
    const nameCol     = isPT ? "pc.common_name_pt" : "pc.common_name";
    const searchValue = search?.trim() ?? "";           // ✅ trimmed once
    const isSearch    = searchValue.length > 0;         // ✅ safe guard

    const fromClause = `
        FROM  user_plants up
        JOIN  plant_care  pc ON pc.id = up.plant_id
        WHERE up.user_id = $1
    `;

    // $1 = userId | $2 = searchValue | $3 = %searchValue%
    const searchCondition = isSearch
        ? `
        AND (
          unaccent(pc.scientific_name) ILIKE unaccent($3)
          OR unaccent(${nameCol}) ILIKE unaccent($3)

          OR to_tsvector('simple', unaccent(COALESCE(pc.scientific_name,''))) @@ plainto_tsquery('simple', unaccent($2))
          OR to_tsvector('simple', unaccent(COALESCE(${nameCol},''))) @@ plainto_tsquery('simple', unaccent($2))

          OR unaccent(pc.scientific_name) % unaccent($2)
          OR unaccent(${nameCol}) % unaccent($2)
        )
        `
        : "";

    const relevanceScore = isSearch
        ? `
        CASE
          WHEN unaccent(pc.scientific_name) ILIKE unaccent($3) THEN 300
          WHEN unaccent(${nameCol}) ILIKE unaccent($3) THEN 300

          WHEN to_tsvector('simple', unaccent(COALESCE(pc.scientific_name,''))) @@ plainto_tsquery('simple', unaccent($2)) THEN 150
          WHEN to_tsvector('simple', unaccent(COALESCE(${nameCol},''))) @@ plainto_tsquery('simple', unaccent($2)) THEN 150

          WHEN unaccent(pc.scientific_name) % unaccent($2) THEN 80
          WHEN unaccent(${nameCol}) % unaccent($2) THEN 80

          ELSE 0
        END
        `
        : "0";

    // ✅ searchValue used consistently, not raw search
    const baseParams: (string | number)[] = isSearch
        ? [userId, searchValue, `%${searchValue}%`]
        : [userId];

    const limitIdx  = isSearch ? 4 : 2;
    const offsetIdx = isSearch ? 5 : 3;

    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         ${fromClause}
         ${searchCondition}`,
        baseParams
    );

    const totalCount = countResult.rows[0]?.count ?? 0;
    const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / safeLimit);

    const dataResult = await pool.query<UserPlant>(
        `SELECT
            up.id                                   AS user_plant_id,
            pc.id                                   AS plant_id,
            ${nameCol}                              AS common_name,
            pc.scientific_name,
            pc.family,
            pc.genus,
            pc.image_url,
            up.health_status,
            up.watering_notification_enabled,
            up.watering_preferred_time,
            up.watering_reminder_frequency,
            up.last_watered_at,
            up.next_watered_at,
            up.fertilizer_notification_enabled,
            up.fertilizer_preferred_time,
            up.fertilizer_reminder_frequency,
            up.last_fertilized_at,
            up.next_fertilized_at,
            up.pruning_notification_enabled,
            up.pruning_reminder_frequency,
            up.last_pruned_at,
            up.next_pruned_at,
            up.generic_notification_enabled,
            up.generic_care_reminder_frequency,
            up.last_generic_care_at,
            up.next_generic_care_at,
            up.added_at,
            up.created_at,
            up.updated_at,
            ${relevanceScore}                       AS relevance
         ${fromClause}
         ${searchCondition}
         ORDER BY relevance DESC, up.created_at DESC
         LIMIT  $${limitIdx}
         OFFSET $${offsetIdx}`,
        [...baseParams, safeLimit, offset]
    );

    return {
        currentPage: safePage,
        totalPages,
        totalCount,
        limit: safeLimit,
        plants: dataResult.rows,
    };
};

/**
 * Retrieves detailed information for a specific user-owned plant.
 *
 * @async
 * @function getUserPlantByIdService
 *
 * @param lang
 * @param {string} userId - The unique identifier of the authenticated user.
 * @param {string} userPlantId - The unique identifier of the user’s plant record.
 *
 * @returns {Promise<Record<string, unknown> | null>}
 * Returns a promise that resolves to:
 * - An object containing merged user plant data and species data if found.
 * - `null` if the plant does not exist or does not belong to the user.
 *
 * @throws {Error} Throws an error if a database query failure occurs.
 *
 * @description
 * This service:
 * - Fetches plant data from the `user_plants` table.
 * - Joins with the `plant_species` table to include species metadata.
 * - Merges custom user schedules (water, fertilizer, pruning) with species defaults using COALESCE.
 * - Calculates overdue flags for watering, fertilizing, and pruning.
 * - Returns enriched plant details including:
 *   - User-specific settings and notifications
 *   - Species details (common name, scientific name, description, image)
 *   - Default schedule values for frontend comparison
 */
export const getUserPlantByIdService = async (
    userId: string,
    userPlantId: number,
    lang: string
): Promise<PlantDetailsResponse | null> => {

    const isPT        = lang?.toLowerCase().startsWith("pt");
    const nameCol     = isPT ? "pc.common_name_pt" : "pc.common_name";

    const pool = await getDB();

    const userPlantResult = await pool.query<UserPlant>(
        `SELECT ${USER_PLANT_SELECT}
         FROM   user_plants up
         JOIN   plant_care  pc ON pc.id = up.plant_id
         WHERE  up.plant_id = $1 AND up.user_id = $2`,
        [userPlantId, userId]
    );

    if (userPlantResult.rows.length === 0) return null;

    const userPlant = userPlantResult.rows[0];
    if (!userPlant) {
        throw new Error("User plant not found");
    };

    const plantDetailsResult = await pool.query(
        `SELECT
            pc.id AS plant_id,  
            ${nameCol} AS common_name,
            pc.scientific_name,
            pc.family,
            pc.genus,
            pc.watering,
            pc.sunlight,
            pc.care_level,
            pc.growth_rate,
            pc.indoor,
            pc.temperature_min,
            pc.temperature_max,
            pc.humidity_min,
            pc.humidity_max,
            pc.light_min,
            pc.light_max,
            pc.soil_moisture_min,
            pc.soil_moisture_max,
            pc.poisonous_to_humans,
            pc.poisonous_to_pets,
            pc.drought_tolerant,
            pc.tropical,
            pc.medical,
            pc.edible,
            pc.soil,
            pc.fertilizer,
            pc.pruning,
            pc.cycle,
            pc.pest,
            pc.diseases,
            pc.origin,
            pc.category,
            pc.climate,
            pc.color,
            pc.blooming,
            pc.description,
            pc.image_url,
            pc.source
        FROM plant_care pc
        JOIN all_plants ap ON ap.scientific_name = pc.scientific_name
        WHERE pc.scientific_name = $1`,
        [userPlant.scientific_name]
    );

    const fallbackResult = await pool.query(
        `SELECT id AS plant_id, common_name, scientific_name, family, genus, image_url
         FROM all_plants
         WHERE id = $1`,
        [userPlantId]
    );

    return {
        user_plant_id: userPlant.user_plant_id,
        plant: plantDetailsResult.rows[0] ?? fallbackResult.rows[0],
        reminder: {
            watering_notification_enabled: userPlant.watering_notification_enabled,
            watering_reminder_frequency: userPlant.watering_reminder_frequency,
            watering_preferred_time: userPlant.watering_preferred_time,
            next_watered_at: userPlant.next_watered_at,
            last_watered_at: userPlant.last_watered_at,
            fertilizer_notification_enabled: userPlant.fertilizer_notification_enabled,
            fertilizer_reminder_frequency: userPlant.fertilizer_reminder_frequency,
            fertilizer_preferred_time: userPlant.fertilizer_preferred_time,
            next_fertilized_at: userPlant.next_fertilized_at,
            last_fertilized_at: userPlant.last_fertilized_at,
            puring_notification_enabled: userPlant.pruning_notification_enabled,
            pruning_reminder_frequency: userPlant.pruning_reminder_frequency,
            next_pruned_at: userPlant.next_pruned_at,
            last_pruned_at: userPlant.last_pruned_at,
            generic_notification_enabled: userPlant.generic_notification_enabled,
            generic_care_reminder_frequency: userPlant.generic_care_reminder_frequency,
            last_generic_care_at: userPlant.last_generic_care_at,
            next_generic_care_at: userPlant.next_generic_care_at,
        },
    };
};


const CARE_TYPES_WITH_PREFERRED_TIME = new Set(["watering", "fertilizer"]);

/**
 * Validates a single care block object for a plant care type.
 *
 * Throws an error if validation fails based on the following rules:
 * 1. If `notification_enabled` is `true`:
 *    - `reminder_frequency` must be provided and greater than 0.
 *    - If the care type supports a preferred time (`CARE_TYPES_WITH_PREFERRED_TIME`),
 *      `preferred_time` must also be provided.
 *
 * @param {string} careType - The type of care (e.g., "watering", "fertilizer", "pruning", "generic").
 * @param {CareNotificationInput} block - The care block object containing `notification_enabled`,
 *                                         `reminder_frequency`, and optionally `preferred_time`.
 *
 * @throws {Error} If `notification_enabled` is true but `reminder_frequency` is missing or ≤ 0,
 *                 or if a preferred time is required but missing.
 *
 * @example
 * validateCareBlock("watering", {
 *   notification_enabled: true,
 *   reminder_frequency: 3,
 *   preferred_time: "08:00:00"
 * });
 *
 * // Throws an error if reminder_frequency is missing:
 * validateCareBlock("fertilizer", { notification_enabled: true });
 */
const validateCareBlock = (
    careType: string,
    block: CareNotificationInput
): void => {
    if (block.notification_enabled) {
        // eslint-disable-next-line eqeqeq
        if (block.reminder_frequency == null || block.reminder_frequency <= 0) {
            throw new Error(
                `${careType}: reminder_frequency is required and must be > 0 when notification is enabled`
            );
        }

        if (CARE_TYPES_WITH_PREFERRED_TIME.has(careType) && !block.preferred_time) {
            throw new Error(
                `${careType}: preferred_time is required when notification is enabled`
            );
        }
    }
};
/**
 * Validates the payload for updating a user's plant care notifications.
 *
 * Performs the following checks:
 * 1. Ensures the payload is not empty — at least one care type must be provided.
 * 2. Iterates over all care types (`watering`, `fertilizer`, `pruning`, `generic`) and
 *    calls `validateCareBlock` for each block that is defined.
 *
 * @param {UpdateUserPlantInput} payload - The update payload containing optional care blocks.
 *
 * @throws {Error} If:
 *   - The payload is empty (no care types provided).
 *   - Any care block fails validation (e.g., notification enabled but missing
 *     `reminder_frequency` or `preferred_time` for relevant care types).
 *
 * @example
 * // Valid payload
 * validateUpdateUserPlantInput({
 *   watering: { notification_enabled: true, reminder_frequency: 3, preferred_time: "08:00:00" },
 *   pruning: { notification_enabled: false, reminder_frequency: 0 }
 * });
 *
 * // Throws error: At least one care type must be provided
 * validateUpdateUserPlantInput({});
 *
 * // Throws error: watering: reminder_frequency is required and must be > 0 when notification is enabled
 * validateUpdateUserPlantInput({ watering: { notification_enabled: true } });
 */
export const validateUpdateUserPlantInput = (
    payload: UpdateUserPlantInput
): void => {
    if (!payload || !Object.keys(payload).length) {
        throw new Error("At least one care type must be provided");
    }

    const careTypes: Array<keyof UpdateUserPlantInput> = [
        "watering",
        "fertilizer",
        "pruning",
        "generic",
    ];

    for (const careType of careTypes) {
        const block = payload[careType];
        if (block !== undefined) {
            validateCareBlock(careType, block);
        }
    }
};
// ── updateUserPlantReminders.ts ────────────────────────────────────────

// ─── Helper: compute next_*_at from lastDoneAt + frequency (days) ─────────────
const nextColMap: Record<string, string> = {
    watering: "next_watered_at",
    fertilizer: "next_fertilized_at",
    pruning: "next_pruned_at",
    generic: "next_generic_care_at",
};
const reminderFreqColMap: Record<string, string> = {
    watering: "watering_reminder_frequency",
    fertilizer: "fertilizer_reminder_frequency",
    pruning: "pruning_reminder_frequency",
    generic: "generic_care_reminder_frequency",  // different from pattern
};


/**
 * Builds a normalized care update object from a CareNotificationInput block.
 *
 * This function prepares the fields for database update based on whether the
 * notification is enabled or not:
 * - If `notification_enabled` is `true`:
 *   - Uses the provided `preferred_time` or defaults to `"09:00:00"`.
 *   - Uses the provided `reminder_frequency` or defaults to `0`.
 *   - Calculates `next_at` using `calculateNextDate`.
 *   - Marks `recalculate_next` as `true`.
 * - If `notification_enabled` is `false`:
 *   - `preferred_time` is set to `null`.
 *   - `reminder_frequency` is set to `0`.
 *   - `next_at` is set to `null`.
 *   - `recalculate_next` is set to `false`.
 *
 * @param {CareNotificationInput} block - The input object for a care type.
 *
 * @returns {CareUpdateFields} An object containing normalized fields for updating:
 *   - `notification_enabled`: boolean
 *   - `preferred_time`: string | null
 *   - `reminder_frequency`: number
 *   - `next_at`: string | null (ISO string of next reminder date)
 *   - `recalculate_next`: boolean, indicates if next_at should be recalculated
 *
 * @example
 * buildCareFields({
 *   notification_enabled: true,
 *   preferred_time: "08:00:00",
 *   reminder_frequency: 3
 * });
 * // Returns:
 * // {
 * //   notification_enabled: true,
 * //   preferred_time: "08:00:00",
 * //   reminder_frequency: 3,
 * //   next_at: "2026-03-20T08:00:00.000Z",
 * //   recalculate_next: true
 * // }
 *
 * @example
 * buildCareFields({ notification_enabled: false });
 * // Returns:
 * // {
 * //   notification_enabled: false,
 * //   preferred_time: null,
 * //   reminder_frequency: 0,
 * //   next_at: null,
 * //   recalculate_next: false
 * // }
 */
const buildCareFields = (block: CareNotificationInput): CareUpdateFields => ({
    notification_enabled: block.notification_enabled,
    preferred_time: block.notification_enabled
        ? (block.preferred_time ?? "09:00:00")
        : null,
    reminder_frequency: block.notification_enabled
        ? (block.reminder_frequency ?? 0)
        : 0,
    next_at: block.notification_enabled
        ? calculateNextDate(block.reminder_frequency ?? null)
        : null,
    recalculate_next: block.notification_enabled,
});







/**
 * Updates the notification settings for a user's plant.
 *
 * This service performs the following steps:
 * 1. Validates the input payload using `validateUpdateUserPlantInput`.
 * 2. Checks that the `userPlantId` belongs to the specified `userId`.
 * 3. Dynamically builds SQL `SET` clauses for each care type included in the payload:
 *    - `watering`, `fertilizer`, `pruning`, `generic`
 *    - Updates `notification_enabled`, `preferred_time` (if applicable), and `reminder_frequency`.
 *    - Recalculates `next_*_at` only if the notification is being enabled.
 * 4. Executes the `UPDATE` query and returns the updated row.
 *
 * Rules:
 * - Only care types included in the payload are updated; others are left untouched.
 * - Toggling a notification off does **not** change the `next_*_at` column.
 *
 * @param {string} userId - The UUID of the user performing the update.
 * @param {string} userPlantId - The UUID of the user_plant record to update.
 * @param {UpdateUserPlantInput} payload - Object containing optional care type blocks to update.
 *
 * @returns {Promise<Record<string, unknown>>} The updated user_plant record.
 *
 * @throws {Error} If:
 *   - The payload is empty or invalid.
 *   - The specified `userPlantId` does not exist for the given `userId`.
 *
 * @example
 * const updatedPlant = await updateUserPlantService(
 *   "d4e5f6a1-b2c3-4567-89ab-cdef01234567",
 *   "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   {
 *     watering: { notification_enabled: true, reminder_frequency: 3, preferred_time: "08:00:00" },
 *     pruning: { notification_enabled: false, reminder_frequency: 0 }
 *   }
 * );
 * console.log(updatedPlant.next_watered_at); // ISO date string of next watering
 */
export const updateUserPlantService = async (
    userId: string,
    userPlantId: string,
    payload: UpdateUserPlantInput
): Promise<Record<string, unknown>> => {
    validateUpdateUserPlantInput(payload);

    const pool = await getDB();

    // ── Verify the user_plant record belongs to this user ─────────────────────
    const existing = await pool.query(
        `SELECT id FROM user_plants WHERE id = $1 AND user_id = $2`,
        [userPlantId, userId]
    );

    if (!existing.rows.length) {
        throw new Error("Plant not found for this user");
    }

    // ── Build dynamic SET clauses ─────────────────────────────────────────────
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [];
    let paramIndex = 1;
    /**
     * Appends SQL SET clauses and corresponding values for a specific care type.
     *
     * This helper is used to dynamically build the UPDATE query for the `user_plants` table.
     *
     * Behavior:
     * - Always updates `<prefix>_notification_enabled`.
     * - If the care type supports a preferred time (`CARE_TYPES_WITH_PREFERRED_TIME`), updates `<prefix>_preferred_time`.
     * - Always updates `<prefix>_reminder_frequency`.
     * - Updates the `next_*_at` column only if `recalculate_next` is `true` (i.e., when enabling the notification).
     * - When toggling OFF, `next_*_at` is left unchanged.
     *
     * @param {string} prefix - The care type prefix (`watering`, `fertilizer`, `pruning`, `generic`).
     * @param {CareUpdateFields} fields - The values to update for this care type.
     *
     * @example
     * appendFields("watering", {
     *   notification_enabled: true,
     *   preferred_time: "08:00:00",
     *   reminder_frequency: 3,
     *   next_at: "2025-03-20T08:00:00.000Z",
     *   recalculate_next: true
     * });
     * // Adds SET clauses for watering_notification_enabled, watering_preferred_time,
     * // watering_reminder_frequency, and next_watered_at (if recalculate_next is true)
     */
    const appendFields = (
        prefix: string,
        fields: CareUpdateFields,
    ): void => {
        setClauses.push(`${prefix}_notification_enabled = $${paramIndex++}`);
        values.push(fields.notification_enabled);

        if (CARE_TYPES_WITH_PREFERRED_TIME.has(prefix)) {
            setClauses.push(`${prefix}_preferred_time = $${paramIndex++}`);
            values.push(fields.preferred_time);
        }

        setClauses.push(`${reminderFreqColMap[prefix]} = $${paramIndex++}`);
        values.push(fields.reminder_frequency);

        // ── Only recalculate next_*_at when toggling ON ───────────────────────
        if (fields.recalculate_next) {
            setClauses.push(`${nextColMap[prefix]} = $${paramIndex++}`);
            values.push(fields.next_at);
        }
        // toggling OFF → next_*_at column is left untouched entirely
    };

    if (payload.watering !== undefined) {
        appendFields("watering", buildCareFields(payload.watering));
    }
    if (payload.fertilizer !== undefined) {
        appendFields("fertilizer", buildCareFields(payload.fertilizer));
    }
    if (payload.pruning !== undefined) {
        appendFields("pruning", buildCareFields(payload.pruning));
    }
    if (payload.generic !== undefined) {
        appendFields("generic", buildCareFields(payload.generic));
    }

    // ── Execute update ────────────────────────────────────────────────────────
    values.push(userPlantId, userId);

    const query = `
        UPDATE user_plants
        SET ${setClauses.join(", ")}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * Maps a flat structure of plant care settings to a nested structure.
 *
 * The function takes a flat object representing user preferences and settings
 * for plant care (such as watering, fertilizer, pruning, and generic care), and
 * converts it into a more nested structure for easier processing or storage.
 *
 * @param {FlatUpdateUserPlantInput} flat - The flat structure containing user plant care settings.
 * @returns {UpdateUserPlantInput} - The nested structure with plant care settings categorized by care type (watering, fertilizer, pruning, generic).
 *
 * @example
 * const flatInput = {
 *     watering_notification_enabled: true,
 *     watering_preferred_time: 'morning',
 *     watering_reminder_frequency: 2,
 *     fertilizer_notification_enabled: true,
 *     fertilizer_preferred_time: 'afternoon',
 *     fertilizer_reminder_frequency: 3,
 *     pruning_notification_enabled: true,
 *     pruning_reminder_frequency: 1,
 *     generic_notification_enabled: false,
 *     generic_care_reminder_frequency: 5,
 * };
 * 
 * const nestedOutput = mapFlatToNested(flatInput);
 * // nestedOutput will have a structure like:
 * // {
 * //   watering: { notification_enabled: true, preferred_time: 'morning', reminder_frequency: 2 },
 * //   fertilizer: { notification_enabled: true, preferred_time: 'afternoon', reminder_frequency: 3 },
 * //   pruning: { notification_enabled: true, reminder_frequency: 1 },
 * //   generic: { notification_enabled: false, reminder_frequency: 5 },
 * // }
 */
export function mapFlatToNested(flat: FlatUpdateUserPlantInput): UpdateUserPlantInput {
    const nested: UpdateUserPlantInput = {};

    if (flat.watering_notification_enabled !== undefined) {
        nested.watering = {
            notification_enabled: flat.watering_notification_enabled,
            preferred_time: flat.watering_preferred_time ?? null,
            reminder_frequency: flat.watering_reminder_frequency ?? 0,
        };
    }

    if (flat.fertilizer_notification_enabled !== undefined) {
        nested.fertilizer = {
            notification_enabled: flat.fertilizer_notification_enabled,
            preferred_time: flat.fertilizer_preferred_time ?? null,
            reminder_frequency: flat.fertilizer_reminder_frequency ?? 0,
        };
    }

    if (flat.pruning_notification_enabled !== undefined) {
        nested.pruning = {
            notification_enabled: flat.pruning_notification_enabled,
            reminder_frequency: flat.pruning_reminder_frequency ?? 0,
        };
    }

    if (flat.generic_notification_enabled !== undefined) {
        nested.generic = {
            notification_enabled: flat.generic_notification_enabled,
            // Note: your DB column is generic_care_reminder_frequency, not generic_reminder_frequency
            reminder_frequency: flat.generic_care_reminder_frequency ?? 0,
        };
    }

    return nested;
}