import { getDB } from "../../core/config/db";
import {
    AddUserPlantInput,
    AdminPlant,
    CareNotificationInput,
    CareUpdateFields,
    FlatUpdateUserPlantInput,
    PaginatedUserPlants,
    PlantDetailsResponse,
    PlantResponse,
    UpdateUserPlantInput,
    UserPlant
} from "../../interface/myPlants";
import { PaginatedPlants } from "../../interface/plants";
import { parse } from "@fast-csv/parse";
import config from "../../core/config/env";
import fs from "fs";
import { Transform, TransformCallback } from "stream";
import { pipeline } from "stream/promises";
import pg from "pg";
import copyFrom from "pg-copy-streams";

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
    search?: string
): Promise<PaginatedPlants> => {
    const pool = getDB();
    const offset = (page - 1) * limit;
    const TABLE = "plant_table_final";

    const searchValue = search?.trim() ?? "";

    // ── Search condition ───────────────────────────────────────────────────────
    // Searches both common_name and scientific_name
    const searchCondition = search
        ? `AND (
            unaccent(common_name)      ILIKE unaccent($2)
            OR unaccent(scientific_name) ILIKE unaccent($2)
            OR to_tsvector('simple', unaccent(COALESCE(common_name, '')))
                 @@ plainto_tsquery('simple', unaccent($1))
            OR to_tsvector('simple', unaccent(COALESCE(scientific_name, '')))
                 @@ plainto_tsquery('simple', unaccent($1))
            OR unaccent(COALESCE(common_name, ''))      % unaccent($1)
            OR unaccent(COALESCE(scientific_name, ''))  % unaccent($1)
          )`
        : "";

    // ── Relevance score ────────────────────────────────────────────────────────
    const relevanceScore = search
        ? `CASE
            WHEN unaccent(common_name)      ILIKE unaccent($2) THEN 300
            WHEN unaccent(scientific_name)  ILIKE unaccent($2) THEN 280
            WHEN to_tsvector('simple', unaccent(COALESCE(common_name, '')))
                   @@ plainto_tsquery('simple', unaccent($1))  THEN 150
            WHEN to_tsvector('simple', unaccent(COALESCE(scientific_name, '')))
                   @@ plainto_tsquery('simple', unaccent($1))  THEN 130
            WHEN unaccent(COALESCE(common_name, ''))      % unaccent($1) THEN 80
            WHEN unaccent(COALESCE(scientific_name, ''))  % unaccent($1) THEN 60
            ELSE 0
          END`
        : `0::integer`;

    const searchParams = search ? [searchValue, `${searchValue}%`] : [];

    // ── Total count ────────────────────────────────────────────────────────────
    const totalQuery = `
        SELECT COUNT(*)
        FROM ${TABLE}
        WHERE id IS NOT NULL
        ${searchCondition}
    `;

    const totalResult = await pool.query(totalQuery, searchParams);
    const totalCount = Number(totalResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // ── Main query ─────────────────────────────────────────────────────────────
    const limitPh = `$${search ? 3 : 1}`;
    const offsetPh = `$${search ? 4 : 2}`;
    const params = search
        ? [searchValue, `${searchValue}%`, limit, offset]
        : [limit, offset];

    const dataQuery = `
        SELECT
            id,
            common_name,
            scientific_name,
            image_original_url,
            family,
            type,
            cycle,
            watering,
            indoor,
            medicinal,
            edible_fruit,
            ${relevanceScore} AS relevance
        FROM ${TABLE}
        WHERE id IS NOT NULL
        ${searchCondition}
        ORDER BY
            (${relevanceScore}) DESC,
            id ASC
        LIMIT  ${limitPh}
        OFFSET ${offsetPh}
    `;

    const result = await pool.query(dataQuery, params);

    return {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        plants: result.rows,
    };
};

/**
 * Retrieves detailed information about a plant by its ID.
 *
 * @param {string} plantId - UUID of the plant.
 * @param {string} userId - UUID of the authenticated user, used to check if the plant is already added to their collection.
 * @param lang
 * @throws {Error} If plant is not found or database query fails.
 * @returns {Promise<void>} Plant details object.
 * @throws {Error} If plant is not found or database query fails.
 */
export const getPlantDetailsByIdService = async (
    plantId: string,
    userId: string
): Promise<PlantResponse> => {
    try {
        const pool = getDB();
        const TABLE = "plant_table_final";

        const id = parseInt(plantId, 10);
        if (isNaN(id)) throw new Error("Invalid plant ID — must be a number");

        const result = await pool.query(
            `SELECT
                id,
                common_name,
                scientific_name,
                other_name,
                family,
                genus,
                species_epithet,
                origin,
                type,
                cycle,
                watering,
                watering_benchmark_value,
                watering_benchmark_unit,
                sunlight,
                soil,
                hardiness_min,
                hardiness_max,
                dimension_type,
                dimension_min_value,
                dimension_max_value,
                dimension_unit,
                growth_rate,
                maintenance,
                care_level,
                care_guides_url,
                pruning_month,
                propagation,
                attracts,
                pest_susceptibility,
                plant_anatomy,
                drought_tolerant,
                salt_tolerant,
                thorny,
                invasive,
                tropical,
                indoor,
                flowers,
                flowering_season,
                cones,
                fruits,
                edible_fruit,
                harvest_season,
                leaf,
                edible_leaf,
                seeds,
                cuisine,
                medicinal,
                poisonous_to_humans,
                poisonous_to_pets,
                description,
                image_original_url,
                image_regular_url,
                image_medium_url,
                image_small_url,
                image_thumbnail,
                image_license
            FROM ${TABLE}
            WHERE id = $1`,
            [id]
        );

        const userPlantResult = await pool.query(
            `SELECT * FROM user_plants WHERE plant_id = $1 AND user_id = $2`,
            [id, userId]
        );

        const userPlant = userPlantResult.rows[0];

        if (result.rows.length === 0) throw new Error("Plant not found");

        return {
            plant: result.rows[0],
            AlreadyAdded: !!userPlant,
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
};
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

    const query2 = `
        SELECT * from user_plants where plant_id = $1 and user_id = $2`;

    const result2 = await pool.query(query2, [plant_id, userId]);
    if (result2.rows.length > 0) {
        throw new Error("user already has this plant added");
    }
    // ── Verify plant species exists ───────────────────────────────────────────
    // const species = await pool.query(
    //     `SELECT id FROM plant_care WHERE id = $1`,
    //     [plant_id]
    // );

    // if (!species.rows.length) {
    //     throw new Error("Plant species not found");
    // }

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
): Promise<PaginatedUserPlants> => {

    const pool = await getDB();

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;



    const searchValue = search?.trim() ?? "";           // ✅ trimmed once
    const isSearch = searchValue.length > 0;         // ✅ safe guard

    const fromClause = `
        FROM  user_plants up
        JOIN  plant_table_final  pc ON pc.id = up.plant_id
        WHERE up.user_id = $1
    `;

    // const commonNameExpr = `COALESCE(scientific_name, common_name, other_name)`;

    // ── Search condition ───────────────────────────────────────────────────────
    const searchCondition = search
        ? `AND (
            unaccent(common_name)      ILIKE unaccent($2)
            OR unaccent(scientific_name) ILIKE unaccent($2)
            OR to_tsvector('simple', unaccent(COALESCE(common_name, '')))
                 @@ plainto_tsquery('simple', unaccent($1))
            OR to_tsvector('simple', unaccent(COALESCE(scientific_name, '')))
                 @@ plainto_tsquery('simple', unaccent($1))
            OR unaccent(COALESCE(common_name, ''))      % unaccent($1)
            OR unaccent(COALESCE(scientific_name, ''))  % unaccent($1)
          )`
        : "";

    // ── Relevance score ────────────────────────────────────────────────────────
    const relevanceScore = search
        ? `CASE
            WHEN unaccent(common_name)      ILIKE unaccent($2) THEN 300
            WHEN unaccent(scientific_name)  ILIKE unaccent($2) THEN 280
            WHEN to_tsvector('simple', unaccent(COALESCE(common_name, '')))
                   @@ plainto_tsquery('simple', unaccent($1))  THEN 150
            WHEN to_tsvector('simple', unaccent(COALESCE(scientific_name, '')))
                   @@ plainto_tsquery('simple', unaccent($1))  THEN 130
            WHEN unaccent(COALESCE(common_name, ''))      % unaccent($1) THEN 80
            WHEN unaccent(COALESCE(scientific_name, ''))  % unaccent($1) THEN 60
            ELSE 0
          END`
        : `0::integer`;// ← was "0", now explicitly cast so PG treats it as a value not a position
    // const searchParams = search ? [searchValue, `${searchValue}%`] : [];

    // ✅ searchValue used consistently, not raw search
    const baseParams: (string | number)[] = isSearch
        ? [userId, searchValue, `%${searchValue}%`]
        : [userId];

    const limitIdx = isSearch ? 4 : 2;
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
            up.id,
            pc.id                     AS plant_id,
            common_name               AS common_name,
            pc.family                 As family,
            pc.genus                  AS genus,
            pc.scientific_name          AS scientific_name,
            pc.other_name              AS other_name,
            pc.medicinal                AS medicinal,
            pc.edible_fruit            AS edible_fruit,
            pc.flowers                 AS flowers,
            pc.indoor                 AS indoor,
            pc.image_original_url     AS image_original_url,
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
    userPlantId: string
): Promise<PlantDetailsResponse | null> => {
    const pool = await getDB();

    const query = `
        SELECT 
            up.*,
            p.*
        FROM user_plants up
        JOIN plant_table_final p ON up.plant_id = p.id
        WHERE up.user_id = $1 AND up.plant_id = $2
    `;

    const result = await pool.query(query, [userId, userPlantId]);
    if (result.rows.length === 0) return null;




    const row = result.rows[0];

    // Map the combined row to the expected response shape
    return {
        user_plant_id: row.plant_id,   // or row.user_plant_id if that column exists
        plant: {
            plant_id: row.plant_id,
            scientific_name: row.scientific_name,
            common_name: row.common_name,
            other_name: row.other_name,
            family: row.family,
            genus: row.genus,
            plant_type: row.type,
            growth_habit: row.growth_habit,
            edible: row.edible,
            edible_part: row.edible_part,
            vegetable: row.vegetable,
            species_epithet: row.species_epithet,
            description: row.description,
            author: row.authority,
            subspecies: row.subspecies,
            cultivar: row.cultivar,
            variety: row.variety,          // ✅ fixed typo: was "varity"
            origin: row.origin,
            type: row.type,
            cycle: row.cycle,
            watering: row.watering,
            watering_benchmark_value: row.watering_benchmark_value,
            watering_benchmark_unit: row.watering_benchmark_unit,
            sunlight: row.sunlight,
            hardiness_min: row.hardiness_min,
            hardiness_max: row.hardiness_max,
            dimension_type: row.dimension_type,
            dimension_min_value: row.dimension_min_value,
            dimension_max_value: row.dimension_max_value,
            dimension_unit: row.dimension_unit,
            growth_rate: row.growth_rate,
            maintenance: row.maintenance,
            care_level: row.care_level,
            soil: row.soil,
            pruning_month: row.pruning_month,
            propagation: row.propagation,
            attracts: row.attracts,
            pest_susceptibility: row.pest_susceptibility,
            plant_anatomy: row.plant_anatomy,
            drought_tolerant: row.drought_tolerant,
            salt_tolerant: row.salt_tolerant,
            thorny: row.thorny,            // ✅ fixed
            invasive: row.invasive,
            tropical: row.tropical,
            indoor: row.indoor,
            flowers: row.flowers,
            flowering_season: row.flowering_season,
            cones: row.cones,
            fruits: row.fruits,
            edible_fruit: row.edible_fruit,
            harvest_season: row.harvest_season,
            leaf: row.leaf,
            edible_leaf: row.edible_leaf,
            seeds: row.seeds,
            cuisine: row.cuisine,
            medicinal: row.medicinal,      // ✅ fixed
            poisonous_to_humans: row.poisonous_to_humans,
            poisonous_to_pets: row.poisonous_to_pets,
            care_guides_url: row.care_guides_url,
            image_original_url: row.image_original_url,
            image_regular_url: row.image_regular_url,
            image_medium_url: row.image_medium_url,
            image_small_url: row.image_small_url,
            image_thumbnail: row.image_thumbnail,
            image_license: row.image_license,
        },
        reminder: {
            watering_notification_enabled: row.watering_notification_enabled,
            watering_reminder_frequency: row.watering_reminder_frequency,
            watering_preferred_time: row.watering_preferred_time,
            next_watered_at: row.next_watered_at,
            last_watered_at: row.last_watered_at,

            fertilizer_notification_enabled: row.fertilizer_notification_enabled,
            fertilizer_reminder_frequency: row.fertilizer_reminder_frequency,
            fertilizer_preferred_time: row.fertilizer_preferred_time,
            next_fertilized_at: row.next_fertilized_at,
            last_fertilized_at: row.last_fertilized_at,

            puring_notification_enabled: row.pruning_notification_enabled, // typo "puring" fixed to pruning? Keep original field name
            pruning_reminder_frequency: row.pruning_reminder_frequency,
            next_pruned_at: row.next_pruned_at,
            last_pruned_at: row.last_pruned_at,

            generic_notification_enabled: row.generic_notification_enabled,
            generic_care_reminder_frequency: row.generic_care_reminder_frequency,
            last_generic_care_at: row.last_generic_care_at,
            next_generic_care_at: row.next_generic_care_at,
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
        `SELECT id FROM user_plants WHERE plant_id = $1 AND user_id = $2`,
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
        WHERE plant_id = $${paramIndex++} AND user_id = $${paramIndex++}
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
// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
    totalRows: number;
    insertedRows: number;
    skippedRows: number;
    errorRows: number;
    durationMs: number;
}

/**
 * Creates and returns a new PostgreSQL client instance.
 *
 * The client configuration is loaded from environment-based config values.
 *
 * @function createClient
 * @returns {pg.Client} Configured PostgreSQL client instance.
 */
function createClient(): pg.Client {
    return new pg.Client({
        host: config.POSTGRE_HOST,
        port: Number(config.POSTGRE_PORT),
        database: config.POSTGRE_DATABASE,
        user: config.POSTGRE_USER,
        password: config.POSTGRE_PASSWORD,
        ssl: false,
    });
}
/**
 * Escapes and formats a value for PostgreSQL COPY TSV import.
 *
 * Converts empty, undefined, or "null" values into PostgreSQL NULL (`\N`)
 * and escapes special characters such as tabs, newlines, and backslashes.
 *
 * @function escapeCopy
 * @param {string | undefined} val - Raw string value from CSV.
 * @returns {string} Escaped TSV-safe string or PostgreSQL NULL marker.
 */
function escapeCopy(val: string | undefined): string {
    if (!val || val.trim() === "" || val.trim().toLowerCase() === "null") return "\\N";
    return val.trim()
        .replace(/\\/g, "\\\\")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}

/**
 * Converts a string value into a PostgreSQL-compatible boolean string.
 *
 * Accepted truthy values:
 * - "true", "1", "yes"
 *
 * Accepted falsy values:
 * - "false", "0", "no"
 *
 * Invalid or empty values return PostgreSQL NULL (`\N`).
 *
 * @function toBoolCopy
 * @param {string | undefined} val - Raw boolean-like string value.
 * @returns {string} "true", "false", or PostgreSQL NULL marker.
 */
function toBoolCopy(val: string | undefined): string {
    if (!val) return "\\N";
    const v = val.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return "true";
    if (v === "false" || v === "0" || v === "no") return "false";
    return "\\N";
}

/**
 * Converts a raw CSV row object into a PostgreSQL COPY-compatible TSV row.
 *
 * The column order must exactly match the PostgreSQL COPY statement.
 * Returns `null` if the required `id` field is missing.
 *
 * @function rowToTsv
 * @param {Record<string, string>} raw - Parsed CSV row object.
 * @returns {string | null} TSV-formatted row string or null if invalid.
 */
function rowToTsv(raw: Record<string, string>): string | null {
    const id = escapeCopy(raw["id"]);
    if (id === "\\N") return null; // id is required

    return [
        id,                                          // id
        escapeCopy(raw["common_name"]),              // common_name
        escapeCopy(raw["scientific_name"]),          // scientific_name
        escapeCopy(raw["other_name"]),               // other_name
        escapeCopy(raw["family"]),                   // family
        escapeCopy(raw["genus"]),                    // genus
        escapeCopy(raw["species_epithet"]),          // species_epithet
        escapeCopy(raw["hybrid"]),                   // hybrid
        escapeCopy(raw["authority"]),                // authority
        escapeCopy(raw["subspecies"]),               // subspecies
        escapeCopy(raw["cultivar"]),                 // cultivar
        escapeCopy(raw["variety"]),                  // variety
        escapeCopy(raw["origin"]),                   // origin
        escapeCopy(raw["type"]),                     // type
        escapeCopy(raw["cycle"]),                    // cycle
        escapeCopy(raw["watering"]),                 // watering
        escapeCopy(raw["watering_benchmark_value"]), // watering_benchmark_value
        escapeCopy(raw["watering_benchmark_unit"]),  // watering_benchmark_unit
        escapeCopy(raw["sunlight"]),                 // sunlight
        escapeCopy(raw["hardiness_min"]),            // hardiness_min
        escapeCopy(raw["hardiness_max"]),            // hardiness_max
        escapeCopy(raw["dimension_type"]),           // dimension_type
        escapeCopy(raw["dimension_min_value"]),      // dimension_min_value
        escapeCopy(raw["dimension_max_value"]),      // dimension_max_value
        escapeCopy(raw["dimension_unit"]),           // dimension_unit
        escapeCopy(raw["growth_rate"]),              // growth_rate
        escapeCopy(raw["maintenance"]),              // maintenance
        escapeCopy(raw["care_level"]),               // care_level
        escapeCopy(raw["soil"]),                     // soil
        escapeCopy(raw["pruning_month"]),            // pruning_month
        escapeCopy(raw["propagation"]),              // propagation
        escapeCopy(raw["attracts"]),                 // attracts
        escapeCopy(raw["pest_susceptibility"]),      // pest_susceptibility
        escapeCopy(raw["plant_anatomy"]),            // plant_anatomy
        toBoolCopy(raw["drought_tolerant"]),         // drought_tolerant
        toBoolCopy(raw["salt_tolerant"]),            // salt_tolerant
        toBoolCopy(raw["thorny"]),                   // thorny
        toBoolCopy(raw["invasive"]),                 // invasive
        toBoolCopy(raw["tropical"]),                 // tropical
        toBoolCopy(raw["indoor"]),                   // indoor
        toBoolCopy(raw["flowers"]),                  // flowers
        escapeCopy(raw["flowering_season"]),         // flowering_season
        toBoolCopy(raw["cones"]),                    // cones
        toBoolCopy(raw["fruits"]),                   // fruits
        toBoolCopy(raw["edible_fruit"]),             // edible_fruit
        escapeCopy(raw["harvest_season"]),           // harvest_season
        toBoolCopy(raw["leaf"]),                     // leaf
        toBoolCopy(raw["edible_leaf"]),              // edible_leaf
        toBoolCopy(raw["seeds"]),                    // seeds
        toBoolCopy(raw["cuisine"]),                  // cuisine
        toBoolCopy(raw["medicinal"]),                // medicinal
        toBoolCopy(raw["poisonous_to_humans"]),      // poisonous_to_humans
        toBoolCopy(raw["poisonous_to_pets"]),        // poisonous_to_pets
        escapeCopy(raw["description"]),              // description
        escapeCopy(raw["care_guides_url"]),          // care_guides_url
        escapeCopy(raw["image_original_url"]),       // image_original_url
        escapeCopy(raw["image_regular_url"]),        // image_regular_url
        escapeCopy(raw["image_medium_url"]),         // image_medium_url
        escapeCopy(raw["image_small_url"]),          // image_small_url
        escapeCopy(raw["image_thumbnail"]),          // image_thumbnail
        escapeCopy(raw["image_license"]),            // image_license
    ].join("\t") + "\n";
}

/**
 * Converts a raw CSV row object into a PostgreSQL COPY-compatible TSV row.
 *
 * The column order must exactly match the PostgreSQL COPY statement.
 * Returns `null` if the required `id` field is missing.
 *
 * @function rowToTsv
 * @param {Record<string, string>} raw - Parsed CSV row object.
 * @param {string} filePath - The file path of the CSV being imported (used for error logging).
 * @returns {string | null} TSV-formatted row string or null if invalid.
 */
export async function importPlantsService(filePath: string): Promise<ImportResult> {
    const startedAt = Date.now();
    let totalRows = 0;
    let errorRows = 0;
    let client: pg.Client | null = null;

    try {
        client = createClient();
        await client.connect();

        await client.query(`DROP TABLE IF EXISTS plant_table_import`);

        await client.query(`
            CREATE TEMP TABLE plant_table_import
                (LIKE plant_table_final INCLUDING DEFAULTS)
        `);

        const copyStream = client.query(
            copyFrom.from(`
                COPY plant_table_import (
                    id, common_name, scientific_name, other_name,
                    family, genus, species_epithet, hybrid, authority,
                    subspecies, cultivar, variety, origin, type, cycle,
                    watering, watering_benchmark_value, watering_benchmark_unit,
                    sunlight, hardiness_min, hardiness_max,
                    dimension_type, dimension_min_value, dimension_max_value, dimension_unit,
                    growth_rate, maintenance, care_level, soil,
                    pruning_month, propagation, attracts, pest_susceptibility, plant_anatomy,
                    drought_tolerant, salt_tolerant, thorny, invasive, tropical, indoor,
                    flowers, flowering_season, cones, fruits, edible_fruit, harvest_season,
                    leaf, edible_leaf, seeds, cuisine, medicinal,
                    poisonous_to_humans, poisonous_to_pets,
                    description, care_guides_url,
                    image_original_url, image_regular_url, image_medium_url,
                    image_small_url, image_thumbnail, image_license
                ) FROM STDIN WITH (FORMAT text, NULL '\\N')
            `)
        );

        const rowTransform = new Transform({
            writableObjectMode: true,
            readableObjectMode: false,

            /**
             * Transforms a parsed CSV row object into a tab-separated line for COPY.
             * @param raw - Parsed CSV row as key-value pairs
             * @param _enc - Encoding (unused)
             * @param cb - Stream transform callback
             * @returns void
             */
            transform(raw: Record<string, string>, _enc: BufferEncoding, cb: TransformCallback): void {
                totalRows++;
                const line = rowToTsv(raw);
                if (!line) {
                    errorRows++;
                    return cb();
                }
                cb(null, line);
            },
        });

        await pipeline(
            fs.createReadStream(filePath, { highWaterMark: 512 * 1024 }),
            parse({ headers: true, trim: true, discardUnmappedColumns: true }),
            rowTransform,
            copyStream,
        );

        const result = await client.query(`
            INSERT INTO plant_table_final
                SELECT * FROM plant_table_import
            ON CONFLICT (id) DO NOTHING
        `);

        const insertedRows = result.rowCount ?? 0;
        const skippedRows = totalRows - errorRows - insertedRows;

        return {
            totalRows,
            insertedRows,
            skippedRows,
            errorRows,
            durationMs: Date.now() - startedAt,
        };
    } finally {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        if (client) {
            try { await client.query(`DROP TABLE IF EXISTS plant_table_import`); } catch { /* ignore */ }
            try { await client.end(); } catch { /* ignore */ }
        }
    }
}

/**
 * Retrieves paginated plant records for admin users.
 *
 * Supports:
 * - Pagination
 * - Optional search filtering
 *
 * Database:
 * - Reads data from `plant_table_final`
 *
 * Pagination:
 * - `page` starts from 1
 * - `limit` defines number of records per page
 * - `offset` is calculated internally
 *
 * @param page Current page number
 * @param limit Number of records per page
 * @param search Optional search keyword for filtering plants
 *
 * @returns Promise resolving to an array of admin plant records
 *
 * @throws Error Throws database/query execution errors
 */
export const getAllPlantsAdminService = async (
    page: number,
    limit: number,
   
): Promise<AdminPlant[]> => {
    const pool = await getDB();
    const offset = (page - 1) * limit;

    const query = `
        SELECT *
        FROM plant_table_final     
        LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);

    return result.rows.map((row) => ({
        plant_id: row.id,
        scientific_name: row.scientific_name,
        common_name: row.common_name,
        other_name: row.other_name,
        family: row.family,
        genus: row.genus,
        species_epithet: row.species_epithet,
        hybrid: row.hybrid,
        plant_type: row.type,
        growth_habit: row.growth_habit,
        author: row.authority,
        edible: row.edible,
        edible_part: row.edible_part,
        vegetable: row.vegetable,
        subspecies: row.subspecies,
        cultivar: row.cultivar,
        variety: row.variety,
        origin: row.origin,
        type: row.type,
        cycle: row.cycle,
        watering: row.watering,
        watering_benchmark_value: row.watering_benchmark_value,
        watering_benchmark_unit: row.watering_benchmark_unit,
        sunlight: row.sunlight,
        hardiness_min: row.hardiness_min,
        hardiness_max: row.hardiness_max,
        dimension_type: row.dimension_type,
        dimension_min_value: row.dimension_min_value,
        dimension_max_value: row.dimension_max_value,
        dimension_unit: row.dimension_unit,
        growth_rate: row.growth_rate,
        maintenance: row.maintenance,
        care_level: row.care_level,
        soil: row.soil,
        pruning_month: row.pruning_month,
        propagation: row.propagation,
        attracts: row.attracts,
        pest_susceptibility: row.pest_susceptibility,
        plant_anatomy: row.plant_anatomy,
        drought_tolerant: row.drought_tolerant,
        salt_tolerant: row.salt_tolerant,
        thorny: row.thorny,
        invasive: row.invasive,
        tropical: row.tropical,
        indoor: row.indoor,
        flowers: row.flowers,
        flowering_season: row.flowering_season,
        cones: row.cones,
        fruits: row.fruits,
        edible_fruit: row.edible_fruit,
        harvest_season: row.harvest_season,
        leaf: row.leaf,
        edible_leaf: row.edible_leaf,
        seeds: row.seeds,
        cuisine: row.cuisine,
        medicinal: row.medicinal,
        poisonous_to_humans: row.poisonous_to_humans,
        poisonous_to_pets: row.poisonous_to_pets,
        description: row.description,
        care_guides_url: row.care_guides_url,
        image_original_url: row.image_original_url,
        image_regular_url: row.image_regular_url,
        image_medium_url: row.image_medium_url,
        image_small_url: row.image_small_url,
        image_thumbnail: row.image_thumbnail,
        image_license: row.image_license,
    }));
};

