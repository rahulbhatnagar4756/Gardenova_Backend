import { getDB } from "../../core/config/db";
import { csvUser } from "../../interface/auth";
import { GetProfessionalsParams, InsertResult, ProfessionalProfileResponse } from "../../interface/professional";
import { SuppliersResponse } from "../../interface/suppliers";

/**
 * Service to create multiple supplier records in bulk.
 *
 * This function:
 * 1. Validates and converts CSV supplier data into proper types.
 * 2. Converts numeric fields (`assessment`, `num_avaliacoes`, `latitude`, `longitude`) safely using `toNumberOrNull`.
 * 3. Accumulates valid rows for bulk insertion and tracks invalid rows in the `failed` array.
 * 4. Executes a single bulk insert query within a database transaction.
 * 5. Returns the number of successfully inserted rows and information about failed rows.
 *
 * @async
 * @function createSuppliersService
 * @param {csvUser[]} suppliers - Array of supplier objects parsed from CSV.
 * @returns {Promise<InsertResult>} An object containing:
 *   - `inserted` (number): The number of successfully inserted rows.
 *   - `failed` (Array<{ row: number, error: string }>): Details of rows that failed validation or insertion.
 *
 * @throws {Error} Throws if the database insert operation fails after all validations.
 *
 * @example
 * const csvData: csvUser[] = [
 *   { company_name: "Acme", email: "acme@example.com", assessment: "4.5", ... },
 *   { company_name: "Beta", email: "beta@example.com", assessment: "abc", ... },
 * ];
 * const result = await createSuppliersService(csvData);
 * console.log(result.inserted); // e.g., 1
 * console.log(result.failed);   // e.g., [{ row: 2, error: 'Invalid assessment value: "abc"' }]
 */
export const createSuppliersService = async (
    suppliers: csvUser[]
): Promise<InsertResult> => {
    if (!suppliers.length) return { inserted: 0, failed: [] };

    const client = await getDB();
    const values: (string | number | null)[] = [];
    const placeholders: string[] = [];
    const failed: { row: number; error: string }[] = [];

    for (let i = 0; i < suppliers.length; i++) {

        const p = suppliers[i];
        if (!p) continue;
        try {
            /** 
              * Converts a value to a number, or returns null if conversion is not possible.
              *
              * Rules:
              * - Returns `null` if the value is `null`, `undefined`, or an empty string.
              * - Converts other values using `Number(val)`.
              * - Returns `null` if the result of `Number(val)` is `NaN`.
              *
              * @function toNumberOrNull
              * @param {unknown} val - The value to convert to a number.
              * @returns {number | null} The numeric value, or `null` if conversion fails.
              *
              * @example
              * toNumberOrNull("42"); // returns 42
              * toNumberOrNull("");   // returns null
              * toNumberOrNull("abc"); // returns null
              * toNumberOrNull(null);  // returns null
              */
            const toNumberOrNull = (val: unknown): number | null => {
                if (val == null || val === "") return null;// eslint-disable-line eqeqeq
                const n = Number(val);
                return isNaN(n) ? null : n;
            };

            const assessment = toNumberOrNull(p.assessment);
            const num_avaliacoes = toNumberOrNull(p.num_avaliacoes);
            const latitude = toNumberOrNull(p.latitude);
            const longitude = toNumberOrNull(p.longitude);

            if (isNaN(assessment!) && assessment !== null) {
                throw new Error(`Invalid assessment value: "${p.assessment}"`);
            }
            if (isNaN(num_avaliacoes!) && num_avaliacoes !== null) {
                throw new Error(`Invalid num_avaliacoes value: "${p.num_avaliacoes}"`);
            }
            if (isNaN(latitude!) && latitude !== null) {
                throw new Error(`Invalid latitude value: "${p.latitude}"`);
            }
            if (isNaN(longitude!) && longitude !== null) {
                throw new Error(`Invalid longitude value: "${p.longitude}"`);
            }

            const b = values.length;
            placeholders.push(`(
        gen_random_uuid(),
        $${b + 1},  $${b + 2},  $${b + 3},  $${b + 4},
        $${b + 5},  $${b + 6},  $${b + 7},  $${b + 8},
        $${b + 9},  $${b + 10}, $${b + 11}, $${b + 12},
        $${b + 13}, $${b + 14}, $${b + 15}, $${b + 16},
        $${b + 17}
      )`);

            values.push(
                p.company_name ?? null,
                p.region ?? null,
                p.email ?? null,
                p.category ?? null,
                p.description ?? null,
                p.city ?? null,
                p.state ?? null,
                p.telefone ?? null,
                p.whatsapp ?? null,
                p.website ?? null,
                p.instagram ?? null,
                p.address ?? null,
                assessment,
                num_avaliacoes,
                p.verified_source ?? null,
                latitude,
                longitude
            );
        } catch (err) {
            failed.push({
                row: i + 1,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (!placeholders.length) {
        return { inserted: 0, failed };
    }

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `INSERT INTO suppliers_table (
            id, company_name,region, email, category, description,
            city, state, telefone, whatsapp, website,
            instagram, address, assessment, num_avaliacoes,
            verified_source, latitude, longitude
      ) VALUES ${placeholders.join(",")}`,
            values
        );

        await client.query("COMMIT");
        return { inserted: result.rowCount ?? 0, failed };

    } catch (err) {
        await client.query("ROLLBACK").catch((e) => console.error("Rollback failed:", e));
        throw new Error(`Insert failed: ${err instanceof Error ? err.message : String(err)}`);
    }
};



/**
 * Retrieves a paginated list of supplier profiles from the database.
 *
 * This function:
 * 1. Fetches supplier records from `suppliers_table` ordered by creation date.
 * 2. Applies pagination using `limit` and `offset`.
 * 3. Retrieves the total count of supplier records for pagination metadata.
 * 4. Maps database rows to a structured `ProfessionalProfileResponse` format,
 *    including nested `location`, `contact`, and `ratings` objects.
 *
 * @async
 * @function getAllSuppliersProfilesDb
 * @param {number} limit - Maximum number of supplier records to return.
 * @param {number} offset - Number of supplier records to skip for pagination.
 * @returns {Promise<{ professionals: ProfessionalProfileResponse[]; totalCount: number }>} 
 * An object containing:
 *   - `professionals`: Array of supplier profiles with detailed information.
 *   - `totalCount`: Total number of supplier records in the database.
 *
 * @throws {Error} If a database query fails.
 *
 * @example
 * const { professionals, totalCount } = await getAllSuppliersProfilesDb(10, 0);
 * console.log(professionals.length); // up to 10
 * console.log(totalCount); // total records in suppliers_table
 */
export const getAllSuppliersProfilesDb = async (
    limit: number,
    offset: number
): Promise<{
    professionals: ProfessionalProfileResponse[];
    totalCount: number;
}> => {
    const client = await getDB();

    const result = await client.query(
        `SELECT
            id,
            company_name,
            email,
            category,
            description,
            city,
            state,
            address,
            latitude,
            longitude,
            telefone,
            whatsapp,
            website,
            instagram,
            assessment,
            num_avaliacoes,
            verified_source,
            created_at,
            updated_at
        FROM suppliers_table
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const countResult = await client.query(
        `SELECT COUNT(*) FROM suppliers_table`
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const professionals = result.rows.map((row) => ({
        id: row.id,
        companyName: row.company_name,
        email: row.email,
        category: row.category,
        image_url: row.image_url,
        description: row.description,

        location: {
            city: row.city,
            state: row.state,
            address: row.address,
            latitude: row.latitude,
            longitude: row.longitude,
        },

        contact: {
            telefone: row.telefone,
            whatsapp: row.whatsapp,
            website: row.website,
            instagram: row.instagram,
        },

        ratings: {
            assessment: row.assessment,
            numAvaliacoes: row.num_avaliacoes,
        },

        verifiedSource: row.verified_source,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));

    return { professionals, totalCount };
};


/**
 * Fetches suppliers sorted by proximity to the user's location, optionally filtered by category.
 *
 * This function:
 * 1. Computes distance from the user's latitude and longitude to each supplier using the Haversine formula.
 * 2. Optionally filters suppliers by category.
 * 3. Applies pagination using `limit` and `offset`.
 * 4. Maps supplier records into a structured response including location, contact, ratings, subscription details, and distance.
 *
 * @async
 * @function fetchSortedSuppliers
 * @param {GetProfessionalsParams} params - Parameters for fetching suppliers:
 *   - `userLat` (number): Latitude of the user.
 *   - `userLng` (number): Longitude of the user.
 *   - `category` (string, optional): Supplier category to filter by.
 *   - `limit` (number, optional): Maximum number of records to return (default: 20).
 *   - `offset` (number, optional): Number of records to skip for pagination (default: 0).
 *
 * @returns {Promise<GetProfessionalsResponse>} An object containing:
 *   - `total`: Number of suppliers returned in this batch.
 *   - `limit`: Pagination limit used.
 *   - `offset`: Pagination offset used.
 *   - `user_location`: User's latitude and longitude.
 *   - `data`: Array of suppliers including:
 *       - `id`, `company_name`, `category`, `description`, `image_url`
 *       - `city`, `state`, `address`
 *       - `contact`: Nested object with `telefone`, `whatsapp`, `website`, `instagram`
 *       - `rating`, `num_avaliacoes`, `verified_source`
 *       - `subscription`: Nested object with `plan_name`, `highlight_in_result`, `verification_badge`
 *       - `distance_km`: Distance in kilometers from the user, rounded to 2 decimal places
 *
 * @throws {Error} If a database query fails.
 *
 * @example
 * const suppliers = await fetchSortedSuppliers({
 *   userLat: 40.7128,
 *   userLng: -74.0060,
 *   category: "IT",
 *   limit: 10,
 *   offset: 0
 * });
 * console.log(suppliers.data[0].distance_km); // e.g., 2.45
 */
export async function fetchSortedSuppliers(
    params: GetProfessionalsParams
): Promise<SuppliersResponse> {
    const { userLat, userLng, category, limit = 20, offset = 0 } = params;

    const client = await getDB();

    const values: (number | string)[] = [userLat, userLng, userLat, userLng];
    let categoryClause = "";

   if (category) {
    const normalized = category
        .trim()
        .toLowerCase()
        .replace(/e?s$/i, ""); // strips plural suffix

    values.push(`%${normalized}%`);
    categoryClause = `WHERE LOWER(category) ILIKE $${values.length}`;
}
    const query = `
        SELECT
            id,
            company_name,
            category,
            description,
            image_url,
            city,
            state,
            address,
            telefone,
            whatsapp,
            website,
            instagram,
            assessment      AS rating,
            num_avaliacoes,
            verified_source,
            (
                6371 * 2 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(latitude - $1) / 2), 2)
                        + COS(RADIANS($1))
                        * COS(RADIANS(latitude))
                        * POWER(SIN(RADIANS(longitude - $2) / 2), 2)
                    )
                )
            ) AS distance_km
        FROM suppliers_table
        ${categoryClause}
        ORDER BY
            POWER(SIN(RADIANS(latitude - $3) / 2), 2)
            + COS(RADIANS($3))
            * COS(RADIANS(latitude))
            * POWER(SIN(RADIANS(longitude - $4) / 2), 2)
        ASC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2};
    `;

    values.push(limit, offset);

    const result = await client.query(query, values);

    return {
        total: result.rowCount ?? 0,
        limit,
        offset,
        user_location: { lat: userLat, lng: userLng },
        data: result.rows.map((pro) => ({
            id: pro.id,
            company_name: pro.company_name,
            category: pro.category,
            description: pro.description,
            image_url: pro.image_url,
            city: pro.city,
            state: pro.state,
            address: pro.address,
            contact: {
                telefone: pro.telefone,
                whatsapp: pro.whatsapp,
                website: pro.website,
                instagram: pro.instagram,
            },
            rating: pro.rating,
            num_avaliacoes: pro.num_avaliacoes,
            verified_source: pro.verified_source,
            distance_km: parseFloat(parseFloat(pro.distance_km).toFixed(2)),
        })),
    };
}