
import { connectDB, getDB } from "../../core/config/db";
import {
    sendLeadCreationEmailTOAdmin,
    sendLeadCreationEmailToProfessional,
    sendLeadCreationEmailToUser,
    sendLeadsEmailToSuppliers,
    sendProfessionalWelcomeEmail
} from "../../core/services/emailService";
import { csvUser } from "../../interface/auth";
import {
    AdminProfessionalProfileResponse,
    GetProfessionalsParams,
    GetProfessionalsResponse,
    InsertResult,
    PartnerProfile,
    professionalProfileResponse,
    ProfessionalProfileResponse,
    RequestingUser
} from "../../interface/professional";
import bcrypt from "bcryptjs";
import { getSignedFileUrl } from "../../core/services/s3UploadService";
import { UpdateProfessionalProfileRequest } from "../../interface/partnerProfile";
import * as fastCsv from "fast-csv";
import fs from "fs";

// export const createProfessionalsService = async (
//     professionals: csvUser[]
// ): Promise<InsertResult> => {
//     if (!professionals.length) return { inserted: 0, failed: [] };

//     const client = await connectDB();
//     const values: (string | number | null)[] = [];
//     const placeholders: string[] = [];
//     const failed: { row: number; error: string }[] = [];

//     for (let i = 0; i < professionals.length; i++) {

//         const p = professionals[i];
//         if (!p) continue;
//         try {
//             /** 
//               * Converts a value to a number, or returns null if conversion is not possible.
//               *
//               * Rules:
//               * - Returns `null` if the value is `null`, `undefined`, or an empty string.
//               * - Converts other values using `Number(val)`.
//               * - Returns `null` if the result of `Number(val)` is `NaN`.
//               *
//               * @function toNumberOrNull
//               * @param {unknown} val - The value to convert to a number.
//               * @returns {number | null} The numeric value, or `null` if conversion fails.
//               *
//               * @example
//               * toNumberOrNull("42"); // returns 42
//               * toNumberOrNull("");   // returns null
//               * toNumberOrNull("abc"); // returns null
//               * toNumberOrNull(null);  // returns null
//               */
//             const toNumberOrNull = (val: unknown): number | null => {
//                 if (val == null || val === "") return null;// eslint-disable-line eqeqeq
//                 const n = Number(val);
//                 return isNaN(n) ? null : n;
//             };

//             const assessment = toNumberOrNull(p.assessment);
//             const num_avaliacoes = toNumberOrNull(p.num_avaliacoes);
//             const latitude = toNumberOrNull(p.latitude);
//             const longitude = toNumberOrNull(p.longitude);

//             if (isNaN(assessment!) && assessment !== null) {
//                 throw new Error(`Invalid assessment value: "${p.assessment}"`);
//             }
//             if (isNaN(num_avaliacoes!) && num_avaliacoes !== null) {
//                 throw new Error(`Invalid num_avaliacoes value: "${p.num_avaliacoes}"`);
//             }
//             if (isNaN(latitude!) && latitude !== null) {
//                 throw new Error(`Invalid latitude value: "${p.latitude}"`);
//             }
//             if (isNaN(longitude!) && longitude !== null) {
//                 throw new Error(`Invalid longitude value: "${p.longitude}"`);
//             }

//             const b = values.length;
//             placeholders.push(`(
//         gen_random_uuid(),
//         $${b + 1},  $${b + 2},  $${b + 3},  $${b + 4},
//         $${b + 5},  $${b + 6},  $${b + 7},  $${b + 8},
//         $${b + 9},  $${b + 10}, $${b + 11}, $${b + 12},
//         $${b + 13}, $${b + 14}, $${b + 15}, $${b + 16},
//         $${b + 17}
//       )`);

//             values.push(
//                 p.company_name ?? null,
//                 p.region ?? null,
//                 p.email ?? null,
//                 p.category ?? null,
//                 p.description ?? null,
//                 p.city ?? null,
//                 p.state ?? null,
//                 p.telefone ?? null,
//                 p.whatsapp ?? null,
//                 p.website ?? null,
//                 p.instagram ?? null,
//                 p.address ?? null,
//                 assessment,
//                 num_avaliacoes,
//                 p.verified_source ?? null,
//                 latitude,
//                 longitude
//             );
//         } catch (err) {
//             failed.push({
//                 row: i + 1,
//                 error: err instanceof Error ? err.message : String(err),
//             });
//         }
//     }

//     if (!placeholders.length) {
//         return { inserted: 0, failed };
//     }

//     try {
//         await client.query("BEGIN");

//         const result = await client.query(
//             `INSERT INTO professional_profiles (
//         id, company_name,region, email, category, description,
//         city, state, telefone, whatsapp, website,
//         instagram, address, assessment, num_avaliacoes,
//         verified_source, latitude, longitude
//       ) VALUES ${placeholders.join(",")}`,
//             values
//         );

//         await client.query("COMMIT");
//         return { inserted: result.rowCount ?? 0, failed };

//     } catch (err) {
//         await client.query("ROLLBACK").catch((e) => console.error("Rollback failed:", e));
//         throw new Error(`Insert failed: ${err instanceof Error ? err.message : String(err)}`);
//     }
// };

/**
 * Generates a secure random password.
 * 
 * Ensures:
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * 
 * Then shuffles characters for randomness.
 *
 * @param length - Desired password length (default: 12)
 * @returns Generated password string
 */
function generatePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';

    const allChars = lowercase + numbers + symbols;

    let password = '';

    // Ensure at least one of each type
    // password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}



/**
 * Retrieves paginated professional profiles from database.
 *
 * Returns:
 * - Professional details
 * - Trial period information
 * - Founder information
 * - Coverage details
 * - Total count for pagination
 *
 * @param limit - Number of records to fetch
 * @param offset - Number of records to skip
 * 
 * @returns Object containing:
 *  - professionals: formatted professional list
 *  - totalCount: total number of professional profiles in DB
 */
export const getAllProfessionalProfilesDb = async (
    limit: number,
    offset: number
): Promise<{
    professionals: ProfessionalProfileResponse[];
    totalCount: number;
}> => {
    const client = await getDB();

    // Fetch professionals with pagination
    const result = await client.query(
        `SELECT
            p.id,
            p.business_name AS company_name,
            p.email,
            p.category,
            p.description,
            p.image_url,
            p.city,
            p.state,
            p.address,
            p.latitude,
            p.longitude,
            p.website,
            p.rating,
            p.phone,
            p.created_at::varchar AS created_at,
            p.updated_at::varchar AS updated_at,
            p.user_id ,
            p.is_founder
        FROM professional p
        LEFT JOIN users u
        ON p.user_id = u.id
        ORDER BY p.created_at ASC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    // Get total count
    const countResult = await client.query(
        `SELECT COUNT(*) FROM professional`
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Map rows to response
    const professionals = await Promise.all(
        result.rows.map(async (row) => ({
            id: row.id,
            companyName: row.company_name,
            email: row.email,
            category: row.category,
            image_url: row.image_url
                ? row.image_url.startsWith("http")
                    ? row.image_url
                    : (await getSignedFileUrl(row.image_url)) ?? row.image_url
                : null,
            description: row.description,

            location: {
                city: row.city,
                state: row.state,
                address: row.address,
                latitude: row.latitude,
                longitude: row.longitude,
            },

            contact: {
                telefone: row.phone, // ✅ fixed
                whatsapp: row.whatsapp,
                website: row.website,
                instagram: row.instagram,
            },

            ratings: row.rating,
            verifiedSource: row.verified_source,
            is_founder: row.is_founder,
            createdAt: row.created_at,
            updatedAt: row.updated_at,

            registered: !!row.user_id,
        }))
    );

    return { professionals, totalCount };
};
/**
 * Retrieves a professional profile by its unique ID.
 *
 * This function:
 * - Queries the `professional_profiles` table.
 * - Maps database fields (snake_case) into a structured
 *   `ProfessionalProfileResponse` object (camelCase).
 *
 * Returned Object Structure:
 * - Basic Info: id, companyName, email, category, description
 * - Location: city, state, address, latitude, longitude
 * - Contact: telefone, whatsapp, website, instagram
 * - Ratings: assessment, numAvaliacoes
 * - Metadata: verifiedSource, createdAt, updatedAt
 *
 * @async
 * @function getProfessionalDataById
 *
 * @param {string} id - UUID of the professional profile.
 *
 * @returns {Promise<ProfessionalProfileResponse | null>}
 * Returns:
 * - ProfessionalProfileResponse object if found
 * - null if no record exists with the given ID
 *
 * @throws {Error} Propagates database errors if the query fails.
 */
export const getProfessionalDataById = async (id: string): Promise<ProfessionalProfileResponse | null> => {
    const client = await getDB();

    const result = await client.query(
        `SELECT * from professional_profiles where id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    return {
        id: row.id,
        companyName: row.company_name,
        email: row.email,
        category: row.category,
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
    };
}


/**
 * Registers a professional user and their associated professional account.
 *
 * Workflow:
 * 1. Connects to the database and starts a transaction.
 * 2. Fetches and locks the founder configuration to determine founder eligibility.
 * 3. Ensures the professional's email is unique in the `users` table.
 * 4. Resolves the "Professional" role ID.
 * 5. Creates the user in the `users` table and generates a password.
 * 6. Updates founder counter atomically if the user qualifies as a founder.
 * 7. Creates the professional account in `professional_accounts`.
 * 8. Commits the transaction.
 * 9. Sends a mandatory welcome email after user creation.
 *
 * Error Handling & Safety:
 * - Rolls back the transaction if any DB step fails before commit.
 * - Logs critical errors for operational awareness if email sending fails post-commit.
 * - Ensures partial data does not leave the system in an inconsistent state.
 *
 * Notes:
 * - If the welcome email fails after commit, the user is still registered,
 *   but manual intervention is required to resend credentials.
 * - Transaction rollback is only attempted if it was started and uncommitted.
 *
 * @async
 * @function registerProfessionalService
 *
 * @param {string} professionalId - UUID of the professional profile to register.
 * @param {ProfessionalProfileResponse} professional - Professional profile data.
 *
 * @returns {Promise<{ success: boolean; message: string }>}
 * Returns an object indicating success or failure, including a message:
 * - `success: true` if registration completes (with or without email failure warning).
 * - `success: false` if any critical error occurs during registration.
 */
export const registerProfessionalService = async (
    professionalId: string,
    professional: ProfessionalProfileResponse
): Promise<{ success: boolean; message: string }> => {

    let client;
    let transactionStarted = false;
    let userCreated = false;
    let generatedPassword: string | null = null;

    // ─── Connect to DB ─────────────────────────────────────────────────────────
    try {
        client = await connectDB();
    } catch (connectionError) {
        console.error("Database connection failed:", connectionError);
        return {
            success: false,
            message: "Unable to connect to the database. Please try again later.",
        };
    }

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        // ─── 1. Fetch founder config ───────────────────────────────────────────
        const founderConfigResult = await client.query<{
            id: number;
            founder_counter: number;
            founder_limit: number;
        }>(
            `SELECT id, founder_counter, founder_limit 
             FROM founder_config 
             LIMIT 1 
             FOR UPDATE`
        );

        const founderConfigRow = founderConfigResult.rows[0];
        if (!founderConfigRow) {
            throw new Error(
                "Founder config not found in database. Please create it first."
            );
        }

        const {
            founder_counter: currentFounderCounter,
            founder_limit: founderLimit,
        } = founderConfigRow;

        // ─── 2. Email uniqueness check ─────────────────────────────────────────
        const emailCheck = await client.query(
            `SELECT id FROM users WHERE email = $1`,
            [professional.email]
        );

        if (emailCheck.rows.length > 0) {
            throw new Error("Email already exists");
        }

        // ─── 3. Resolve Professional role ─────────────────────────────────────
        const roleResult = await client.query<{ id: number }>(
            `SELECT id FROM roles WHERE name = 'Professional' LIMIT 1`
        );

        const roleRow = roleResult.rows[0];
        if (!roleRow) {
            throw new Error(
                "Professional role not found in database. Please create it first."
            );
        }

        const professionalRoleId = roleRow.id;

        // ─── 4. Create user ────────────────────────────────────────────────────
        generatedPassword = generatePassword();
        // console.log(`Generated password for ${professional.email}: ${generatedPassword}`); // Log generated password for debugging (remove in production!)
        const hashedPassword = await bcrypt.hash(generatedPassword, 12);

        const userResult = await client.query<{ id: number }>(
            `INSERT INTO users (
                name,
                email,
                password,
                role_id,
                phone_number,
                is_email_verified,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id`,
            [
                professional.companyName,
                professional.email,
                hashedPassword,
                professionalRoleId,
                professional.contact?.telefone ?? null,
            ]
        );

        const userRow = userResult.rows[0];
        if (!userRow) {
            throw new Error("Failed to create user. Please try again.");
        }

        const userId = userRow.id;
        userCreated = true; // ← mark user as created so email is enforced

        // ─── 5. Determine founder status (atomic counter update) ──────────────
        const isFounder = currentFounderCounter < founderLimit;
        // let founderNumber: number | null = null;

        if (isFounder) {
            const updatedCounterResult = await client.query<{
                founder_counter: number;
            }>(
                `UPDATE founder_config
                 SET founder_counter = founder_counter + 1
                 WHERE id = (SELECT id FROM founder_config LIMIT 1)
                 RETURNING founder_counter`
            );

            const updatedRow = updatedCounterResult.rows[0];
            if (!updatedRow) {
                throw new Error("Failed to update founder counter. Please try again.");
            }

            // founderNumber = updatedRow.founder_counter;
        }

        // ─── 6. Create professional account ───────────────────────────────────
        await client.query(
            `INSERT INTO professional_accounts (
                user_id,
                professional_profile_id,
                subscription_plan_id,
                is_founder,
                is_first_login,
                trial_start_date,
                trial_end_date,
                plan
            )
            VALUES ($1, $2, null, $3, true, CURRENT_TIMESTAMP, null, 'trial')`,
            [userId, professionalId, isFounder]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        // ─── 7. Send welcome email — mandatory if user was created ─────────────
        // Even if something below throws, user exists in DB so email must be sent
        try {
            await sendProfessionalWelcomeEmail({
                email: professional.email!,
                name: professional.companyName!,
                password: generatedPassword,
                trialEndDate: "Your trial period will begin after your first login.",
            });
        } catch (emailError) {
            // User is registered — do NOT rollback or return failure.
            // Log a critical alert so ops team can manually resend credentials.
            console.error(
                `[CRITICAL] Professional registered (ID: ${professionalId}) but welcome email failed to send to ${professional.email}. Manual intervention required.`,
                emailError
            );

            // Return success but include a warning so the caller is aware
            return {
                success: true,
                message:
                    "Professional registered successfully, but the welcome email failed to send. Please resend credentials manually.",
            };
        }

        return { success: true, message: "Professional registered successfully" };

    } catch (error) {

        // ─── Rollback only if transaction is still open ────────────────────────
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "[CRITICAL] ROLLBACK failed — database may be in an inconsistent state:",
                    rollbackError
                );
            }
        }

        // ─── If user was created but account insert failed, log for ops ────────
        if (userCreated) {
            console.error(
                `[CRITICAL] User record was created for ${professional.email} but professional_accounts insert failed. Manual cleanup required.`
            );
        }

        return {
            success: false,
            message: error instanceof Error ? error.message : String(error),
        };

    }
};



/**
 * Handles professional user login, including first login trial setup and trial status checks.
 *
 * Workflow:
 * 1. Connects to the database and fetches the professional account by `userId`.
 * 2. If the account is logging in for the first time (`is_first_login = true`):
 *    - Sets a 30-day trial period starting from the current date.
 *    - Updates `is_first_login`, `trial_start_date`, and `trial_end_date`.
 * 3. If the account is on a trial plan:
 *    - Checks if the trial has expired.
 *    - Returns remaining trial days if still active.
 * 4. Returns status for active paid accounts.
 *
 * Logging:
 * - Logs critical errors and warnings with `userId` context for operational monitoring.
 *
 * @async
 * @function handleProfessionalLogin
 *
 * @param {string} userId - UUID of the professional user logging in.
 *
 * @returns {Promise<{ success: boolean; message: string; accountStatus?: string }>}
 * - `success`: indicates whether login is allowed.
 * - `message`: user-facing login message.
 * - `accountStatus`: one of `"trial_started"`, `"trial_active"`, `"trial_expired"`, `"active"`.
 *
 * @throws {Error} If the professional account cannot be found or database errors occur.
 *
 * Example Usage:
 * ```ts
 * const result = await handleProfessionalLogin("user-uuid");
 * if (!result.success && result.accountStatus === "trial_expired") {
 *     // Prompt user to upgrade
 * }
 * ```
 */
export const handleProfessionalLogin = async (
    userId: string
): Promise<{ success: boolean; message: string; accountStatus?: string }> => {

    let client;

    try {
        client = await getDB();
    } catch (connectionError) {
        console.error("[handleProfessionalLogin] Database connection failed:", {
            userId,
            error: connectionError instanceof Error ? connectionError.message : String(connectionError),
        });
        throw new Error("Unable to connect to the database. Please try again later.");
    }

    try {
        // ─── 1. Fetch professional account ────────────────────────────────────
        const accountResult = await client.query<{
            id: number;
            is_firstlogin: boolean;
            trial_start_date: Date | null;
            trial_end_date: Date | null;
            plan: string;
        }>(
            `SELECT id, is_firstlogin, trial_start_date, trial_expires, subscription_plan as plan  
             FROM professional
             WHERE user_id = $1
             LIMIT 1`,
            [userId]
        );

        const account = accountResult.rows[0];
        if (!account) {
            console.error("[handleProfessionalLogin] Professional account not found:", { userId });
            throw new Error("Professional account not found.");
        }

        const now = new Date();

        // ─── 2. Handle first login — set trial dates ───────────────────────────
        if (account.is_firstlogin) {
            const trialEndDate = new Date(now);
            trialEndDate.setDate(trialEndDate.getDate() + 90);

            await client.query(
                `UPDATE professional
                 SET 
                    is_firstLogin = false,
                    trial_start_date = $1,
                    trial_expires = $2,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [now, trialEndDate, userId]
            );

            // console.error("[handleProfessionalLogin] First login — trial period started:", {
            //     userId,
            //     trialStartDate: now,
            //     trialEndDate,
            // });

            return {
                success: true,
                message: "Welcome! Your trial period has started.",
                accountStatus: "trial_started",
            };
        }

        // ─── 3. Check trial expiry ─────────────────────────────────────────────
        if (account.plan === "trial" && account.trial_end_date) {
            const trialExpired = now > new Date(account.trial_end_date);

            if (trialExpired) {
                // console.warn("[handleProfessionalLogin] Trial expired — blocking login:", {
                //     userId,
                //     trialEndDate: account.trial_end_date,
                // });

                return {
                    success: false,
                    message: "Your trial period has expired. Please upgrade your plan to continue.",
                    accountStatus: "trial_expired",
                };
            }

            // Trial still active — calculate days remaining
            const msRemaining = new Date(account.trial_end_date).getTime() - now.getTime();
            const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

            return {
                success: true,
                message: `Trial active. ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`,
                accountStatus: "trial_active",
            };
        }

        // ─── 4. Active paid plan ───────────────────────────────────────────────
        return {
            success: true,
            message: "Login successful.",
            accountStatus: "active",
        };

    } catch (error) {
        console.error("[handleProfessionalLogin] Unexpected error:", {
            userId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }

};


const enToPtMap: Record<string, string> = {
    "landscaping & gardening": "Jardinagem e Paisagismo",
    "flower shops": "Floricultura",
    "swimming pools": "Piscinas",
    "outdoor flooring": "Pisos e Revestimentos",
    "irrigation": "Irrigação",
    "outdoor lighting": "Iluminacao Externa",
    "lawn & turf": "Grama e Gramados",
    "bbq & outdoor kitchen": "Churrasqueiras",
    "decks & pergolas": "Decks e Pergolados",
    "nurseries & seedlings": "Viveiros e Mudas",
    "pest control": "Controle de Pragas",
};

// reverse map (PT → EN)


/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * The Haversine formula accounts for Earth's curvature and returns
 * the shortest distance over the Earth's surface.
 *
 * @function haversineDistance
 *
 * @param {number} lat1 - Latitude of the first point in decimal degrees
 * @param {number} lon1 - Longitude of the first point in decimal degrees
 * @param {number} lat2 - Latitude of the second point in decimal degrees
 * @param {number} lon2 - Longitude of the second point in decimal degrees
 *
 * @returns {number} Distance between the two points in kilometers (km)
 *
 * @example
 * const distance = haversineDistance(
 *   12.9716, 77.5946,   // Bangalore
 *   12.2958, 76.6394    // Mysore
 * );
 * console.log(distance); // ~126 km
 */
// function haversineDistance(
//     lat1: number,
//     lon1: number,
//     lat2: number,
//     lon2: number
// ): number {
//     const R = 6371;
//     /**
//  * Converts degrees to radians.
//  *
//  * JavaScript trigonometric functions (Math.sin, Math.cos, etc.)
//  * expect angles in radians, not degrees.
//  *
//  * @param {number} deg - Angle in degrees
//  * @returns {number} Angle converted to radians
//  *
//  * @example
//  * const radians = toRad(180);
//  * console.log(radians); // 3.141592653589793 (π)
//  */
//     const toRad = (deg: number): number => (deg * Math.PI) / 180;

//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);

//     const a =
//         Math.sin(dLat / 2) ** 2 +
//         Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c;
// }

// ----------------------------
// Subscription plan priority
// Adjust names to match your DB values
// ----------------------------
// const PLAN_PRIORITY: Record<string, number> = {
//     Diamante: 4,
//     Gold: 3,
//     Talk: 2,
//     trial: 0,
// };

/**
 * Returns the numeric priority of a subscription plan.
 *
 * Plans with higher priority values are ranked higher
 * when sorting professionals.
 *
 * @param {string | null} planName - The name of the subscription plan
 * @returns {number} Numeric priority value.
 *                   Returns -1 if plan is null or not found.
 *
 * @example
 * getPlanPriority("premium"); // 3
 * getPlanPriority(null); // -1
 */
// function getPlanPriority(planName: string | null): number {
//     if (!planName) return -1;
//     return PLAN_PRIORITY[planName.toLowerCase()] ?? -1;
// }

/**
 * Fetches professionals from the database and sorts them by:
 *   1️ Distance from user (ascending)
 *   2️ Subscription plan priority (descending)
 *   3️ Rating (descending)
 *
 * Steps:
 *   - Apply optional category filter
 *   - Fetch professionals with valid coordinates
 *   - Calculate Haversine distance in memory
 *   - Sort using multi-level comparator
 *   - Apply pagination
 *
 *  Note:
 * Sorting and distance calculation currently happen in memory.
 * For large datasets, this should be moved to SQL for better performance.
 *
 * @param {GetProfessionalsParams} params - Filtering and pagination parameters
 * @param {number} params.userLat - User latitude
 * @param {number} params.userLng - User longitude
 * @param {string} [params.category] - Optional category filter
 * @param {number} params.limit - Maximum number of records to return
 * @param {number} params.offset - Pagination offset
 *
 * @returns {Promise<GetProfessionalsResponse>} Sorted and paginated professionals list
 */
export async function fetchSortedProfessionals(
    params: GetProfessionalsParams
): Promise<GetProfessionalsResponse> {
    const { userLat, userLng, category, limit, offset, userId } = params;

    let final_category = category?.trim();
    if (final_category) {
        final_category = enToPtMap[final_category.toLowerCase()] ?? final_category;
    }

    const client = await connectDB();

    const conditions: string[] = [
        "pp.latitude IS NOT NULL",
        "pp.longitude IS NOT NULL",
    ];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Distance params always first
    values.push(userLat); const latParam = paramIndex++;  // $1
    values.push(userLng); const lngParam = paramIndex++;  // $2

    if (final_category) {
        values.push(final_category);
        conditions.push(`LOWER(pp.category) = LOWER($${paramIndex++})`);
    }
    if (userId) {
        values.push(userId);
        conditions.push(`pp.user_id != $${paramIndex++}`);
    }

    // Total count (before pagination)
    values.push(limit); const limitParam = paramIndex++; // second to last
    values.push(offset); const offsetParam = paramIndex++; // last

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const query = `
        WITH base AS (
            SELECT
                pp.id,
                pp.user_id           AS userid,
                pp.business_name,
                pp.legal_name,
                pp.category,
                pp.description,
                pp.city,
                pp.state,
                pp.address,
                pp.latitude,
                pp.longitude,
                pp.phone,
                pp.whatsapp,
                pp.website,
                pp.is_verified,
                pp.image_url,
                pp.rating,
                -- Haversine distance in KM directly in SQL
                (
                    6371 * acos(
                        LEAST(1.0, 
                            cos(radians($${latParam}))
                            * cos(radians(pp.latitude::float))
                            * cos(radians(pp.longitude::float) - radians($${lngParam}))
                            + sin(radians($${latParam}))
                            * sin(radians(pp.latitude::float))
                        )
                    )
                ) AS distance_km,
                COUNT(*) OVER () AS total_count
            FROM professional AS pp
            INNER JOIN users u ON pp.user_id = u.id
            ${whereClause}
        )
        SELECT *
        FROM base
        ORDER BY
            ROUND(distance_km::numeric, 2) ASC,       -- 1. Distance (rounded to ~10m tolerance)
           
            rating DESC NULLS LAST                     -- 3. Rating
        LIMIT  $${limitParam}
        OFFSET $${offsetParam}
    `;

    const result = await client.query(query, values);

    const total = result.rows.length > 0
        ? parseInt(result.rows[0].total_count)
        : 0;

    const data = await Promise.all(
        result.rows.map(async (pro) => ({
            id: pro.id,
            userid: pro.userid,
            company_name: pro.business_name,
            legal_name: pro.legal_name,
            category: pro.category,
            description: pro.description,
            image_url: pro.image_url
                ? pro.image_url.startsWith("http")
                    ? pro.image_url
                    : (await getSignedFileUrl(pro.image_url)) ?? pro.image_url
                : null,
            city: pro.city,
            state: pro.state,
            address: pro.address,
            contact: {
                telefone: pro.phone,
                whatsapp: pro.whatsapp,
                website: pro.website,
                instagram: pro.instagram,
            },
            rating: pro.rating,
            num_avaliacoes: pro.num_avaliacoes,
            verified_source: pro.verified_source,
            subscription: {
                plan_name: pro.subscription_plan ?? "free",
                highlight_in_result: pro.highlight_in_result ?? false,
                verification_badge: pro.verification_badge ?? false,
            },
            distance_km: parseFloat(parseFloat(pro.distance_km).toFixed(2)),
        }))
    );

    return {
        total,
        limit,
        offset,
        user_location: { lat: userLat, lng: userLng },
        data,
    };
}

// eslint-disable-next-line
/**
 * @function professionalProfileById
 * Retrieves a professional user's complete profile details by user ID.
 * 
 * This function:
 * 1. Fetches basic user information (name, email) from the `users` table.
 * 2. Retrieves professional account details from the `professional_accounts` table.
 * 3. Fetches the subscription plan name (if available).
 * 4. Generates a signed URL for the stored profile image.
 * 
 * @async
 * @param {string} id - The unique identifier of the user.
 * 
 * @returns {Promise<professionalProfileResponse>} 
 * Returns a structured professional profile response object containing:
 * - `name` (string): User's full name
 * - `email` (string): User's email address
 * - `imageUrl` (string | null): Signed URL of profile image (if exists)
 * - `subscriptionPlan` (string): Name of the subscription plan or "trial"
 * - `trialStartDate` (Date | null): Trial start date
 * - `trialEndDate` (Date | null): Trial end date
 * 
 * @throws {Error} 
 * - Throws an error if the user does not exist.
 * - Throws an error if the professional profile does not exist.
 * - Throws an error if any database operation fails.
 */
export const professionalProfileById = async (id: string): Promise<professionalProfileResponse> => {
    const client = await getDB();

    const usertableResult = await client.query(
        `SELECT name,email,isdeleted from users where id = $1`,
        [id]
    );

    if (usertableResult.rows.length === 0) {
        throw new Error("User not found for ID: " + id);
    }

    const result = await client.query(
        `SELECT image_url, category,phone, subscription_plan,address,description ,trial_expires,trial_start_date,city,state from professional where user_id = $1`,
        [id]
    );

    const row = result.rows[0];
    if (!row) {
        throw new Error("Professional profile not found for user ID: " + id);
    }

    return {
        name: usertableResult.rows[0].name,
        email: usertableResult.rows[0].email,
        profileImage: await getSignedFileUrl(row.image_url) ?? row.image_url ?? null,
        accountStatus: usertableResult.rows[0].isdeleted ? "deleted" : "active",
        subscriptionPlan: row.subscription_plan || "trial",
        startDate: row.trial_start_date,
        endDate: row.trial_expires,
        address: {
            city: row.city,
            state: row.state,
            street: row.address,
        },
        phone: row.phone,
        category: row.category,
        description: row.description,
    };

}


/**
 * Creates a new lead storing multiple professional IDs
 * in partner_profile_ids (UUID[] column).
 *
 * @param {string[]} professionalIds - Array of professional UUIDs.
 * @param {string} userId - UUID of the user creating the lead.
 * @param {string} userEmail - Email of the user creating the lead (for notifications).
 * @param {string} userName - Name of the user creating the lead (for notifications).
 * @param {string} description - Description of the lead.
 * @param {string} category - Category of the lead.
 * @param {string} size - Size of the lead.
 * @returns {Promise<void>}
 * @throws {Error} If insertion fails.
 */
export const leadCreatedByProfessionalService = async (
    professionalIds: string[],
    userId: string,
    userEmail: string,
    userName: string,
    description: string,
    category: string,
    size: string
): Promise<void> => {
    if (!professionalIds.length) {
        throw new Error("No professional IDs provided");
    }

    const client = await getDB();

    try {
        await client.query("BEGIN");

        for (const professionalId of professionalIds) {
            // Check for duplicate lead
            // const { rows: existing } = await client.query<{ id: string }>(
            //     `SELECT id FROM leads_schema
            //      WHERE user_id = $1
            //        AND partner_profile_ids = $2
            //        AND is_deleted = false
            //      LIMIT 1`,
            //     [userId, professionalId]
            // );

            // if (existing.length > 0) {
            //     throw new Error(
            //         `Lead already exists for professional`
            //     );
            // }

            // Insert lead + fetch professional email in parallel
            await client.query(
                `INSERT INTO leads_schema
         (partner_profile_ids, user_id, leads_status, is_deleted,description,category,size)
         VALUES ($1, $2, 'new', false, $3, $4, $5)`,
                [professionalId, userId, description, category, size]
            );

            // ✅ Then fetch email separately
            const professionalEmailResult = await client.query<{ email: string }>(
                `SELECT email FROM users WHERE id = $1`,
                [professionalId]
            );

            const professionalEmail = professionalEmailResult.rows[0]?.email;

            if (!professionalEmail) {
                console.error(`No email found for professional: ${professionalId}. Lead created, skipping emails.`);
                // throw new Error(`Professional email not found for ID: ${professionalId}`);
                continue; // ✅ Safe now — insert already staged for commit
            }



            // Send all notification emails in parallel
            await Promise.all([
                sendLeadCreationEmailToProfessional({
                    professionalEmail,
                    subject: "New Lead Created",
                    userEmail,
                    userName,
                    description,
                    category,
                    size,
                }),
                sendLeadCreationEmailToUser({
                    userEmail,
                    subject: "Lead Created Successfully",
                    professionalEmail,
                    description,
                    category,
                    size,
                }),
                sendLeadCreationEmailTOAdmin({
                    subject: "New Lead Created",
                    userEmail,
                    professionalEmail,
                    description,
                    category,
                    size,
                }),
            ]);
        }

        await client.query("COMMIT");
    } catch (error: unknown) {
        await client.query("ROLLBACK");

        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;

        console.error("Error creating lead:", {
            message,
            stack,
            userId,
            professionalIds,
        });

        throw error instanceof Error ? error : new Error("Failed to create lead");
    }
};





/**
 * Retrieves all leads associated with a specific user and returns
 * detailed partner profile information for each lead.
 *
 * The function performs the following operations:
 * 1. Fetches all lead records for the given user from the `leads_Schema` table.
 * 2. Extracts all `partner_profile_ids` linked to those leads.
 * 3. Retrieves the roles of those users from the `users` table.
 * 4. Maps role IDs to role names using the `roles` table.
 * 5. Retrieves the requesting user's professional profile and description.
 * 6. For each partner profile:
 *    - If the role is `professional`, it fetches company and location details
 *      from the `professional_profiles` table.
 *    - If the role is `user`, it fetches basic user details from the `users` table.
 * 7. Constructs a unified `PartnerProfile` response containing the partner details
 *    and the requesting user's information.
 *
 * @async
 * @param searchQuery
 * @function getAllLeadsForUser
 * @param {string} userId - The unique identifier of the user whose leads are being retrieved.
 * @returns {Promise<PartnerProfile[]>} A promise that resolves to an array of partner profile objects,
 * each containing role-specific details and information about the requesting user.
 *
 * @throws {Error} Throws an error if any database query fails.
 */
export const getAllLeadsForUser = async (
    userId: string,
    searchQuery?: string
): Promise<PartnerProfile[]> => {
    const client = await getDB();

    const result = await client.query(
        `SELECT id, user_id, leads_status, created_at, updated_at, description, category, size
         FROM leads_schema
         WHERE partner_profile_ids = $1 AND is_deleted = false 
         ORDER BY created_at DESC`,
        [userId]
    );

    if (result.rows.length === 0) return [];

    // ✅ Map creatorId -> ARRAY of leads (not a single lead)
    const leadsMetaMap = new Map<string, Array<{ leads_status: string; created_at: string; lead_id: string; description: string; category: string; size: string }>>();
    for (const lead of result.rows) {
        const existing = leadsMetaMap.get(lead.user_id) ?? [];
        existing.push({
            leads_status: lead.leads_status,
            created_at: lead.created_at,
            lead_id: lead.id,
            description: lead.description,
            category: lead.category,
            size: lead.size,
        });
        leadsMetaMap.set(lead.user_id, existing);
    }

    const allCreatorIds: string[] = [...leadsMetaMap.keys()];

    // Get role_id for each creator
    const rolesResult = await client.query(
        `SELECT id, role_id FROM users WHERE id = ANY($1)`,
        [allCreatorIds]
    );

    const roleIdMap = new Map<string, string>(
        rolesResult.rows.map((u) => [u.id, u.role_id])
    );

    const allRoleIds = [...new Set(rolesResult.rows.map((u) => u.role_id))];

    const roleNamesResult = await client.query(
        `SELECT id, name FROM roles WHERE id = ANY($1)`,
        [allRoleIds]
    );

    const roleNameMap = new Map<string, string>(
        roleNamesResult.rows.map((role) => [role.id, role.name])
    );

    const myAccount = await client.query(
        `SELECT id FROM professional WHERE user_id = $1`,
        [userId]
    );
    const myProfileId: string | null = myAccount.rows[0]?.id ?? null;

    const myCategory = await client.query(
        `SELECT category FROM professional WHERE id = $1`,
        [myProfileId]
    );

    const search = searchQuery?.trim().toLowerCase() ?? "";
    const response: PartnerProfile[] = [];

    for (const creatorId of allCreatorIds) {
        const creatorLeads = leadsMetaMap.get(creatorId) ?? []; // ✅ array of leads
        const role_id = roleIdMap.get(creatorId) ?? null;
        const roleName = role_id ? roleNameMap.get(role_id) : null;

        if (roleName === "Professional") {
            const professionalAccount = await client.query(
                `SELECT id FROM professional WHERE user_id = $1`,
                [creatorId]
            );
            const professionalProfileId: string | null =
                professionalAccount.rows[0]?.id ?? null;

            const professionalProfile = await client.query(
                `SELECT business_name, city, email, state, address, phone, whatsapp, website, latitude, longitude
                 FROM professional WHERE id = $1`,
                [professionalProfileId]
            );
            const profile = professionalProfile.rows[0];

            if (search) {
                const searchableText = [profile?.business_name, profile?.city, profile?.state, profile?.address]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!searchableText.includes(search)) continue;
            }

            // ✅ Push one entry PER lead
            for (const leadMeta of creatorLeads) {
                const requestingUser: RequestingUser = {
                    userId,
                    professionalProfileId: myProfileId,
                    description: leadMeta.description ?? null,
                    category: myCategory.rows[0]?.category ?? null,
                    size: leadMeta.size ?? null,
                };

                response.push({
                    userId: creatorId,
                    role: "professional",
                    company_name: profile?.business_name ?? null,
                    leads_status: leadMeta.leads_status,
                    lead_id: leadMeta.lead_id,
                    created_at: leadMeta.created_at,
                    location: {
                        city: profile?.city ?? null,
                        state: profile?.state ?? null,
                        address: profile?.address ?? null,
                        latitude: profile?.latitude ?? null,
                        longitude: profile?.longitude ?? null,
                    },
                    telefone: profile?.phone ?? null,
                    whatsapp: profile?.whatsapp ?? null,
                    email: profile?.email ?? null,
                    website: profile?.website ?? null,
                    requestingUser,
                });
            }

        } else if (roleName === "User") {
            const userResult = await client.query(
                `SELECT name, email, phone_number FROM users WHERE id = $1`,
                [creatorId]
            );
            const userProfile = await client.query(
                `SELECT city, state, street FROM userprofiles WHERE user_id = $1`,
                [creatorId]
            );
            const user = userResult.rows[0];

            if (search) {
                const searchableText = [user?.name, user?.email]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!searchableText.includes(search)) continue;
            }

            // ✅ Push one entry PER lead
            for (const leadMeta of creatorLeads) {
                const requestingUser: RequestingUser = {
                    userId,
                    professionalProfileId: myProfileId,
                    description: leadMeta.description ?? null,
                    category: myCategory.rows[0]?.category ?? null,
                    size: leadMeta.size ?? null,
                };

                response.push({
                    userId: creatorId,
                    role: "user",
                    name: user?.name ?? null,
                    email: user?.email ?? null,
                    location: {
                        city: userProfile.rows[0]?.city ?? null,
                        state: userProfile.rows[0]?.state ?? null,
                        address: userProfile.rows[0]?.street ?? null,
                        latitude: null,
                        longitude: null,
                    },
                    phone_number: user?.phone_number ?? null,
                    leads_status: leadMeta.leads_status,
                    lead_id: leadMeta.lead_id,
                    created_at: leadMeta.created_at,
                    requestingUser,
                });
            }
        }
    }

    return response;
};


// export const getAllLeadsForUser = async (
//     userId: string,         // This is the professional's user_id
//     searchQuery?: string
// ): Promise<PartnerProfile[]> => {
//     const client = await getDB();

//     // Fetch all leads WHERE partner_profile_ids = my userId
//     // (i.e., leads created FOR me by others)
//     const result = await client.query(
//         `SELECT id, user_id, leads_status, created_at, updated_at,description,category,size
//          FROM leads_schema
//          WHERE partner_profile_ids = $1 AND is_deleted = false 
//          ORDER BY created_at DESC`,
//         [userId]
//     );

//     if (result.rows.length === 0) return [];

//     // Build a map: creatorUserId -> { leads_status, created_at, lead_id }
//     // user_id in leads_schema = the person who CREATED the lead
//     const leadsMetaMap = new Map<string, { leads_status: string; created_at: string; lead_id: string,description:string,category: string,size:string }>();
//     for (const lead of result.rows) {
//         leadsMetaMap.set(lead.user_id, {
//             leads_status: lead.leads_status,
//             created_at: lead.created_at,
//             lead_id: lead.id,
//             description: lead.description,
//             category: lead.category,
//             size: lead.size,
//         });
//     }

//     const allCreatorIds: string[] = [...leadsMetaMap.keys()];

//     // Get role_id for each creator
//     const rolesResult = await client.query(
//         `SELECT id, role_id FROM users WHERE id = ANY($1)`,
//         [allCreatorIds]
//     );

//     const roleIdMap = new Map<string, string>(
//         rolesResult.rows.map((u) => [u.id, u.role_id])
//     );

//     const allRoleIds = [...new Set(rolesResult.rows.map((u) => u.role_id))];

//     // Get role names
//     const roleNamesResult = await client.query(
//         `SELECT id, name FROM roles WHERE id = ANY($1)`,
//         [allRoleIds]
//     );

//     const roleNameMap = new Map<string, string>(
//         roleNamesResult.rows.map((role) => [role.id, role.name])
//     );

//     // Get MY (the professional's) profile info for context
//     const myAccount = await client.query(
//         `SELECT id FROM professional WHERE user_id = $1`,
//         [userId]
//     );

//     const myProfileId: string | null =
//         myAccount.rows[0]?.id ?? null;

//     const myCategory = await client.query(
//         `SELECT category FROM professional WHERE id = $1`,
//         [myProfileId]
//     );

//     const requestingUser: RequestingUser = {
//         userId,
//         professionalProfileId: myProfileId,
//         description: result.rows[0]?.description ?? null,
//         category: myCategory.rows[0]?.category ?? null,
//         size: result.rows[0]?.size ?? null,
//     };

//     const search = searchQuery?.trim().toLowerCase() ?? "";
//     const response: PartnerProfile[] = [];

//     for (const creatorId of allCreatorIds) {
//         const leads_status = leadsMetaMap.get(creatorId)?.leads_status ?? null;
//         const created_at = leadsMetaMap.get(creatorId)?.created_at ?? null;
//         const lead_id = leadsMetaMap.get(creatorId)?.lead_id ?? null;
//         const role_id = roleIdMap.get(creatorId) ?? null;
//         const roleName = role_id ? roleNameMap.get(role_id) : null;

//         if (roleName === "Professional") {
//             // Creator is a professional — fetch their profile
//             const professionalAccount = await client.query(
//                 `SELECT id FROM professional WHERE user_id = $1`,
//                 [creatorId]
//             );

//             const professionalProfileId: string | null =
//                 professionalAccount.rows[0]?.id ?? null;

//             const professionalProfile = await client.query(
//                 `SELECT business_name, city,email, state, address, phone, whatsapp, website, latitude, longitude
//                  FROM professional WHERE id = $1`,
//                 [professionalProfileId]
//             );

//             const profile = professionalProfile.rows[0];

//             if (search) {
//                 const searchableText = [profile?.company_name, profile?.city, profile?.state, profile?.address]
//                     .filter(Boolean)
//                     .join(" ")
//                     .toLowerCase();
//                 if (!searchableText.includes(search)) continue;
//             }

//             response.push({
//                 userId: creatorId,
//                 role: "professional",
//                 company_name: profile?.business_name ?? null,
//                 leads_status,
//                 lead_id,
//                 created_at,
//                 location: {
//                     city: profile?.city ?? null,
//                     state: profile?.state ?? null,
//                     address: profile?.address ?? null,
//                     latitude: profile?.latitude ?? null,
//                     longitude: profile?.longitude ?? null,
//                 },
//                 telefone: profile?.phone ?? null,
//                 whatsapp: profile?.whatsapp ?? null,
//                 email: profile?.email ?? null,
//                 website: profile?.website ?? null,
//                 requestingUser,
//             });

//         } else if (roleName === "User") {
//             // Creator is a regular user — fetch their basic info
//             const userResult = await client.query(
//                 `SELECT name, email, phone_number FROM users WHERE id = $1`,
//                 [creatorId]
//             );

//             const userProfile = await client.query(
//                 `SELECT city, state,street FROM userprofiles WHERE user_id = $1`,
//                 [creatorId]
//             );

//             const user = userResult.rows[0];

//             if (search) {
//                 const searchableText = [user?.name, user?.email]
//                     .filter(Boolean)
//                     .join(" ")
//                     .toLowerCase();
//                 if (!searchableText.includes(search)) continue;
//             }

//             response.push({
//                 userId: creatorId,
//                 role: "user",
//                 name: user?.name ?? null,
//                 email: user?.email ?? null,
//                 location: {
//                     city: userProfile.rows[0]?.city ?? null,
//                     state: userProfile.rows[0]?.state ?? null,
//                     address: userProfile.rows[0]?.street ?? null,
//                     latitude: null,
//                     longitude: null,
//                 },
//                 phone_number: user?.phone_number ?? null,
//                 leads_status,
//                 lead_id,
//                 created_at,
//                 requestingUser,
//             });
//         }
//     }

//     return response;
// };
// export const getAllLeadsForUser = async (
//     userId: string,
//     searchQuery?: string
// ): Promise<PartnerProfile[]> => {
//     const client = await getDB();

//     // Fetch all leads for this user
//     const result = await client.query(
//         `SELECT id, partner_profile_ids, leads_status, created_at, updated_at
//          FROM leads_schema
//          WHERE user_id = $1 AND is_deleted = false`,
//         [userId]
//     );

//     // ✅ Build a map: profileId -> { leads_status, created_at } from leads_schema
//     const leadsMetaMap = new Map<string, { leads_status: string; created_at: string; lead_id: string }>();
//     for (const lead of result.rows) {
//         if (lead.partner_profile_ids) {
//             leadsMetaMap.set(lead.partner_profile_ids, {
//                 leads_status: lead.leads_status,
//                 created_at: lead.created_at,
//                 lead_id: lead.id,  // ✅ store the lead id
//             });
//         }
//     }

//     const allPartnerProfileIds: string[] = [...leadsMetaMap.keys()];
//     if (allPartnerProfileIds.length === 0) return [];

//     // Get role_id for each partner profile (user)
//     const rolesResult = await client.query(
//         `SELECT id, role_id FROM users WHERE id = ANY($1)`,
//         [allPartnerProfileIds]
//     );

//     const roleIdMap = new Map<string, string>(
//         rolesResult.rows.map((u) => [u.id, u.role_id])
//     );

//     const allRoleIds = [...new Set(rolesResult.rows.map((u) => u.role_id))];

//     // Get role names
//     const roleNamesResult = await client.query(
//         `SELECT id, name FROM roles WHERE id = ANY($1)`,
//         [allRoleIds]
//     );

//     const roleNameMap = new Map<string, string>(
//         roleNamesResult.rows.map((role) => [role.id, role.name])
//     );

//     // Get requesting user's professional profile
//     const requestingUserAccount = await client.query(
//         `SELECT professional_profile_id FROM professional_accounts WHERE user_id = $1`,
//         [userId]
//     );

//     const requestingUserProfileId: string | null =
//         requestingUserAccount.rows[0]?.professional_profile_id ?? null;

//     const requestingUserDescription = await client.query(
//         `SELECT description FROM professional_profiles WHERE id = $1`,
//         [requestingUserProfileId]
//     );

//     const requestingUser: RequestingUser = {
//         userId,
//         professionalProfileId: requestingUserProfileId,
//         description: requestingUserDescription.rows[0]?.description ?? null,
//     };

//     // Build search filter
//     const search = searchQuery?.trim().toLowerCase() ?? "";

//     const response: PartnerProfile[] = [];

//     for (const profileId of allPartnerProfileIds) {
//         // ✅ Pull leads_status and created_at from leadsMetaMap
//         const leads_status = leadsMetaMap.get(profileId)?.leads_status ?? null;
//         const created_at = leadsMetaMap.get(profileId)?.created_at ?? null;
//         const lead_id = leadsMetaMap.get(profileId)?.lead_id ?? null;
//         const role_id = roleIdMap.get(profileId) ?? null;
//         const roleName = role_id ? roleNameMap.get(role_id) : null;

//         if (roleName === "Professional") {
//             const professionalAccount = await client.query(
//                 `SELECT professional_profile_id FROM professional_accounts WHERE user_id = $1`,
//                 [profileId]
//             );

//             const professionalProfileId: string | null =
//                 professionalAccount.rows[0]?.professional_profile_id ?? null;

//             const professionalProfile = await client.query(
//                 `SELECT company_name, city, state, address,telefone,whatsapp,website, latitude, longitude
//                  FROM professional_profiles WHERE id = $1`,
//                 [professionalProfileId]
//             );

//             const profile = professionalProfile.rows[0];

//             if (search) {
//                 const searchableText = [profile?.company_name, profile?.city, profile?.state, profile?.address]
//                     .filter(Boolean)
//                     .join(" ")
//                     .toLowerCase();
//                 if (!searchableText.includes(search)) continue;
//             }

//             response.push({
//                 userId: profileId,
//                 role: "professional",
//                 company_name: profile?.company_name ?? null,
//                 leads_status, 
//                 lead_id,  // ✅ from leads_schema
//                 created_at,
//                 // ✅ from leads_schema
//                 location: {
//                     city: profile?.city ?? null,
//                     state: profile?.state ?? null,
//                     address: profile?.address ?? null,
//                     latitude: profile?.latitude ?? null,
//                     longitude: profile?.longitude ?? null,
//                 },
//                 telefone: profile?.telefone ?? null,
//                 whatsapp: profile?.whatsapp ?? null,
//                 website: profile?.website ?? null,
//                 requestingUser,
//             });

//         } else if (roleName === "User") {
//             const userResult = await client.query(
//                 `SELECT name, email,phone_number FROM users WHERE id = $1`,
//                 [profileId]
//             );

//             const user = userResult.rows[0];

//             if (search) {
//                 const searchableText = [user?.name, user?.email]
//                     .filter(Boolean)
//                     .join(" ")
//                     .toLowerCase();
//                 if (!searchableText.includes(search)) continue;
//             }

//             response.push({
//                 userId: profileId,
//                 role: "user",
//                 name: user?.name ?? null,
//                 email: user?.email ?? null,
//                 phone_number: user?.phone_number ?? null,
//                 leads_status,
//                 lead_id,   // ✅ from leads_schema
//                 created_at,     // ✅ from leads_schema
//                 requestingUser,
//             });
//         }
//     }

//     return response;
// };

/**
 * Retrieves a professional profile from the database by its ID.
 *
 * Queries the `professional_profiles` table for the row matching the given `id`.
 * Returns a structured `ProfessionalProfileResponse` object including company info,
 * location, contact details, ratings, and verification status.
 *
 * @async
 * @function getProfessionalProfileByIdService
 * @param {string} id - The unique identifier of the professional profile to retrieve.
 *
 * @throws {Error} Throws an error if no professional profile is found with the given ID.
 *
 * @returns {Promise<ProfessionalProfileResponse>} - A promise that resolves to an object containing:
 *   - id: string
 *   - companyName: string | null
 *   - email: string | null
 *   - category: string | null
 *   - description: string | null
 *   - location: {
 *       city: string | null,
 *       state: string | null,
 *       address: string | null,
 *       latitude: number | null,
 *       longitude: number | null
 *     }
 *   - contact: {
 *       telefone: string | null,
 *       whatsapp: string | null,
 *       website: string | null,
 *       instagram: string | null
 *     }
 *   - ratings: {
 *       assessment: number | null,
 *       numAvaliacoes: number
 *     }
 *   - verifiedSource: string | null
 *   - createdAt: Date
 *   - updatedAt: Date
 *
 * @example
 * const profile = await getProfessionalProfileByIdService("12345");
 * console.log(profile.companyName);
 */
export const getProfessionalProfileByIdService = async (id: string): Promise<ProfessionalProfileResponse> => {
    const client = await getDB();
    const result = await client.query(
        `SELECT pp.id,
            pp.business_name AS company_name,
            pp.category,
            pp.city,
            pp.email,
            pp.state,
            pp.address,
            pp.latitude,
            pp.longitude,
            pp.phone,
            pp.whatsapp,
            pp.website,
           
           
          
            pp.is_verified,
            pp.image_url

         FROM professional pp
         WHERE pp.user_id = $1`,
        [id]
    );
    const row = result.rows[0];
    if (!row) {
        throw new Error("Professional profile not found for ID: " + id);
    }
    return {
        id: row.id,
        companyName: row.company_name,
        email: row.email ?? null,
        category: row.category ?? null,
        description: row.description ?? null,

        location: {
            city: row.city ?? null,
            state: row.state ?? null,
            address: row.address ?? null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
        },

        contact: {
            telefone: row.telefone ?? null,
            whatsapp: row.whatsapp ?? null,
            website: row.website ?? null,
            instagram: row.instagram ?? null,
        },

        ratings: {
            assessment: row.assessment ?? null,
            numAvaliacoes: row.num_avaliacoes ?? 0,
        },

        verifiedSource: row.verified_source ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Service function that sends leads to wholesalers by fetching the user and wholesaler details 
 * from the database and sending an email to the wholesalers.
 * 
 * @param {string} userId - The ID of the user who is sending the leads.
 * @param {string[]} wholesalerIds - A list of wholesaler IDs to whom the leads will be sent.
 * @returns {Promise<void>} A promise that resolves when the leads email has been successfully sent.
 * 
 * @throws {Error} Will throw an error if the user is not found or if there's an issue during the email sending process.
 */
export const leadForwholesalerService = async (userId: string, wholesalerIds: string[]): Promise<void> => {
    try {
        const client = await getDB();
        const userResult = await client.query(
            `SELECT name, email FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error("User not found");
        }

        const user = userResult.rows[0];

        // Fetch wholesaler emails
        const wholesalerResult = await client.query(
            `SELECT id, company_name, email FROM suppliers_table WHERE id = ANY($1::uuid[])`,
            [wholesalerIds]
        );

        await sendLeadsEmailToSuppliers(user, wholesalerResult.rows);
        return;
    } catch (error) {
        console.error("Error sending leads email to wholesalers:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId,
            wholesalerIds,
        });

        throw error instanceof Error ? error : new Error("Failed to send leads email to wholesalers");

    }
};

/**
 * Updates the professional profile in the database.
 * 
 * This function constructs an SQL update query based on the provided data in `updateData`.
 * It updates various fields such as company name, email, contact information, ratings, etc.
 * The function ensures that only non-undefined fields are included in the update query.
 * It also updates the `updated_at` timestamp to the current time.
 * 
 * @param {string} professionalId - The ID of the professional whose profile is being updated.
 * @param {UpdateProfessionalProfileRequest} updateData - The data to update the professional profile with. This object contains optional fields for the profile update.
 * 
 * @returns {Promise<void>} - Resolves to `void` when the update operation is successful.
 * 
 * @throws {Error} - Throws an error if no fields are provided for the update, if the professional profile cannot be found, or if any unexpected error occurs during the update process.
 */
export const updateProfessionalByAdminService = async (
    professionalId: Number,
    updateData: UpdateProfessionalProfileRequest
): Promise<void> => {
    const client = await getDB();

    try {
        const fields: string[] = [];
        const values: unknown[] = [];
        let index = 1;
        /**
         * Adds a field and its value to the SQL query's `SET` clause.
         * 
         * This helper function constructs the part of the SQL query that assigns a value to a column,
         * and it manages the placeholder (`$index`) for parameterized queries. The column name and its
         * corresponding value are pushed into the `fields` and `values` arrays, respectively, and the
         * index for the placeholder is incremented.
         * 
         * @param {string} column - The name of the column to update in the SQL query.
         * @param {unknown} value - The value to assign to the column in the SQL query.
         * 
         * @returns {void} - This function doesn't return a value. It modifies the `fields` and `values` arrays.
         */
        const addField = (column: string, value: unknown): void => {
            fields.push(`${column} = $${index}`);
            values.push(value);
            index++;
        };

        // Basic Info
        if (updateData.company_name !== undefined) addField("business_name", updateData.company_name);
        if (updateData.email !== undefined) addField("email", updateData.email);
        if (updateData.category !== undefined) addField("category", updateData.category);
        if (updateData.description !== undefined) addField("description", updateData.description);

        // Location
        if (updateData.city !== undefined) addField("city", updateData.city);
        if (updateData.state !== undefined) addField("state", updateData.state);
        if (updateData.address !== undefined) addField("address", updateData.address);

        // Contact
        if (updateData.telefone !== undefined) addField("phone", updateData.telefone);
        if (updateData.whatsapp !== undefined) addField("whatsapp", updateData.whatsapp);
        // if (updateData.website !== undefined) addField("website", updateData.website);
        // if (updateData.instagram !== undefined) addField("instagram", updateData.instagram);

        // Ratings
        if (updateData.assessment !== undefined) addField("assessment", updateData.assessment);
        if (updateData.num_avaliacoes !== undefined) addField("num_avaliacoes", updateData.num_avaliacoes);
        if (updateData.verified_source !== undefined) addField("verified_source", updateData.verified_source);

        // Always update timestamp
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        if (fields.length === 1) {
            throw new Error("No fields provided for update");
        }

        const query = `
      UPDATE professional
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING id
    `;

        values.push(professionalId);

        const result = await client.query(query, values);

        if (result.rowCount === 0) {
            throw new Error("Professional profile not found");
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error updating professional profile:", error.message);
            throw new Error(error.message);
        }

        console.error("Unknown error updating professional profile:", error);
        throw new Error("Failed to update professional profile");
    }
};

/**
 * Updates the rating of a professional's profile in the database.
 * 
 * This function updates the `assessment` field (rating) of a professional's profile 
 * based on the provided `professionalId`. It also updates the `updated_at` timestamp
 * to the current time. If the professional profile cannot be found, an error is thrown.
 * 
 * @param {string} professionalId - The ID of the professional whose rating is being updated.
 * @param {number} assessment - The new rating to set for the professional. This must be a number.
 * 
 * @returns {Promise<void>} - Resolves to `void` when the update operation is successful.
 * 
 * @throws {Error} - Throws an error if the professional profile cannot be found or if any unexpected error occurs.
 */
export const updateRatingByAdminService = async (
    professionalId: string,
    assessment: number,

): Promise<void> => {
    const client = await getDB();
    try {
        const result = await client.query(
            `UPDATE professional
                SET rating = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id`,
            [assessment, professionalId]
        );
        if (result.rowCount === 0) {
            throw new Error("Professional profile not found");
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error updating professional rating:", error.message);
            throw new Error(error.message);
        }
        console.error("Unknown error updating professional rating:", error);
        throw new Error("Failed to update professional rating");
    }
};


/**
 * Updates the status of a lead based on its current status.
 * The status cycles through the following values:
 * - 'new' -> 'contacted'
 * - 'contacted' -> 'closed'
 * - 'closed' -> 'new'
 * 
 * If the lead is not found, an error is thrown.
 * 
 * @param {string} id - The ID of the lead whose status needs to be updated.
 * @returns {Promise<void>} A promise that resolves when the lead's status is updated successfully.
 * @throws {Error} Throws an error if the lead is not found or the update fails.
 */
export async function updateLeadStatusService(id: string): Promise<void> {
    const client = await getDB();

    const query = `
    UPDATE leads_schema
    SET leads_status = CASE
        WHEN leads_status = 'new' THEN 'contacted'
        WHEN leads_status = 'contacted' THEN 'closed'
        WHEN leads_status = 'closed' THEN 'new'
        ELSE leads_status
    END,
    updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
        throw new Error("Lead not found");
    }
}

const BATCH_SIZE = 500;
const STATIC_PASSWORD = "GARDENOVA@123#";
const BCRYPT_ROUNDS = 12;

/**
 * Converts a given value to a number or returns null if conversion is not possible.
 *
 * This function:
 * - Returns `null` if the value is `null`, `undefined`, or an empty string
 * - Attempts to convert the value to a number using `Number()`
 * - Returns `null` if the result is `NaN`
 *
 * @param {unknown} val - The value to be converted to a number.
 * @returns {number | null} A valid number if conversion succeeds; otherwise, null.
 */
const toNumberOrNull = (val: unknown): number | null => {
    // eslint-disable-next-line eqeqeq
    if (val == null || val === "") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
};



/**
 * Inserts a batch of CSV users into the database using bulk operations.
 *
 * This function:
 * - Validates and transforms incoming CSV rows
 * - Inserts users into the `users` table (skipping duplicates)
 * - Resolves user IDs for all emails
 * - Inserts corresponding records into the `Professional` table
 * - Uses PostgreSQL `unnest` for efficient bulk inserts
 * - Wraps operations in a transaction (BEGIN / COMMIT / ROLLBACK)
 *
 * Error handling:
 * - Invalid rows (e.g., missing email) are tracked in `failed`
 * - If a transaction fails, all rows in the batch are marked as failed
 *
 * @async
 * @param {csvUser[]} batch - Array of parsed CSV user records.
 * @param {string} passwordHash - Pre-hashed password applied to all inserted users.
 * @returns {Promise<{ inserted: number; failed: { row: number; error: string }[] }>}
 * An object containing:
 * - `inserted`: number of successfully inserted professional records
 * - `failed`: list of failed rows with row number and error message
 */
async function insertBatch(
    batch: csvUser[],
    passwordHash: string
): Promise<{ inserted: number; failed: { row: number; error: string }[] }> {
    const client = await connectDB();
    const failed: { row: number; error: string }[] = [];

    // Validate rows and build typed arrays for unnest
    const emails: string[] = [];
    const rowNumbers: number[] = [];
    const business_name: (string | null)[] = [];
    const legal_name: (string | null)[] = [];
    const cnpj: (string | null)[] = [];
    const category: (string | null)[] = [];
    const phone: (string | null)[] = [];
    const whatsapp: (string | null)[] = [];
    const email: (string | null)[] = [];
    const website: (string | null)[] = [];
    const address: (string | null)[] = [];
    const neighborhood: (string | null)[] = [];
    const city: (string | null)[] = [];
    const state: (string | null)[] = [];
    const zip_code: (string | null)[] = [];
    const subscription_plan: (string | null)[] = [];
    const trial_expires: (Date | null)[] = [];
    const is_verified: (Boolean | null)[] = [];
    const is_active: (Boolean | null)[] = [];
    const source: (string | null)[] = [];
    const latitude: (number | null)[] = [];
    const longitude: (number | null)[] = [];
    /**
    * Parses a Brazilian date string (DD-MM-YYYY) into a JavaScript Date.
    *
    * @param {string | undefined} dateStr - Date string in DD-MM-YYYY format.
    * @returns {Date | null} Parsed Date object or null if invalid.
    */
    // function parseBrazilianDate(dateStr: string | undefined): Date | null {
    //     if (!dateStr) return null;
    //     const parts = dateStr.split('-');
    //     if (parts.length === 3) {
    //         const [day, month, year] = parts;
    //         return new Date(`${year}-${month}-${day}`);
    //     }
    //     return null;
    // }
    /**
     * Truncates a string to a specified maximum length.
     *
     * @param {string | null | undefined} val - Input string value.
     * @param {number} limit - Maximum allowed length.
     * @returns {string | null} Truncated string or null if input is empty.
     */
    function truncate(val: string | null | undefined, limit: number): string | null {
        if (!val) return null;
        return val.length > limit ? val.substring(0, limit) : val;
    }

    for (const p of batch) {
        if (!p.email) {
            failed.push({ row: p.__rowNumber ?? 0, error: "Missing email" });
            continue;
        }

        // const assessment = toNumberOrNull(p.assessment);
        // const num_avaliacoes = toNumberOrNull(p.num_avaliacoes);
        const lat = toNumberOrNull(p.latitude);
        const long = toNumberOrNull(p.longitude);

        emails.push(p.email);
        rowNumbers.push(p.__rowNumber ?? 0);
        business_name.push(truncate(p.business_name, 255));
        legal_name.push(truncate(p.legal_name, 255));
        cnpj.push(truncate(p.cnpj, 30));
        category.push(truncate(p.category, 100));
        phone.push(truncate(p.phone, 500));
        whatsapp.push(truncate(p.whatsapp, 30));
        email.push(truncate(p.email, 255));
        website.push(truncate(p.website, 255));
        address.push(truncate(p.address, 255));
        neighborhood.push(truncate(p.neighborhood, 100));
        city.push(truncate(p.city, 150));
        state.push(truncate(p.state, 10));
        zip_code.push(truncate(p.zip_code, 20));
        subscription_plan.push(truncate(p.subscription_plan, 50));
        source.push(truncate(p.source, 100));
        latitude.push(lat);
        longitude.push(long);
    }

    if (!emails.length) return { inserted: 0, failed };

    try {
        await client.query("BEGIN");

        // Step 1: bulk insert users — skip duplicates silently
        await client.query(
            `
            INSERT INTO users (id, name, email, password, role_id, created_at)
            SELECT
                gen_random_uuid(),
                unnest($1::text[]),
                unnest($2::text[]),
                $3,
                (SELECT id FROM roles WHERE name = 'Professional' LIMIT 1),
                NOW()
            ON CONFLICT (email) DO NOTHING
            `,
            [business_name.map(n => n ?? 'Unknown'), emails, passwordHash]
        );

        // Step 2: resolve user ids for ALL emails in this batch
        // (some may have existed before; ON CONFLICT skips them but we still need their id)
        const { rows: userRows } = await client.query<{ id: string; email: string }>(
            `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
            [emails]
        );

        const emailToUserId = new Map(userRows.map((r) => [r.email, r.id]));

        // Step 3: build parallel arrays for professional_profiles, matched by resolved user id
        const profUserIds: string[] = [];
        const Profbusiness_name: (string | null)[] = [];
        const proflegal_name: (string | null)[] = [];
        const profcnpj: (string | null)[] = [];
        const profCategory: (string | null)[] = [];
        const profPhone: (string | null)[] = [];
        const profWhatsapp: (string | null)[] = [];
        const profEmail: (string | null)[] = [];
        const profWebsite: (string | null)[] = [];
        const profAddress: (string | null)[] = [];
        const profNeighborhood: (string | null)[] = [];
        const profCity: (string | null)[] = [];
        const profState: (string | null)[] = [];
        const profZipCode: (string | null)[] = [];
        const profSubscription_plan: (string | null)[] = [];
        const proftrial_expires: (Date | null)[] = [];
        const profIs_verified: (Boolean | null)[] = [];
        const profIs_active: (Boolean | null)[] = [];
        const profSource: (string | null)[] = [];
        const profLatitudes: (number | null)[] = [];
        const profLongitudes: (number | null)[] = [];

        for (let i = 0; i < emails.length; i++) {
            const userId = emailToUserId.get(emails[i]!);
            if (!userId) {
                // Should not happen, but guard anyway
                failed.push({ row: rowNumbers[i]!, error: "User id not found after insert" });
                continue;
            }
            profUserIds.push(userId);
            Profbusiness_name.push(business_name[i]!);
            proflegal_name.push(legal_name[i]!);
            profcnpj.push(cnpj[i]!);
            profCategory.push(category[i]!);
            profPhone.push(phone[i]!);
            profWhatsapp.push(whatsapp[i]!);
            profEmail.push(email[i]!);
            profWebsite.push(website[i]!);
            profAddress.push(address[i]!);
            profNeighborhood.push(neighborhood[i]!);
            profCity.push(city[i]!);
            profState.push(state[i]!);
            profZipCode.push(zip_code[i]!);
            profSubscription_plan.push(subscription_plan[i]!);
            proftrial_expires.push(trial_expires[i]!);
            profIs_verified.push(is_verified[i]!);
            profIs_active.push(is_active[i]!);
            profSource.push(source[i]!);
            profLatitudes.push(latitude[i]!);
            profLongitudes.push(longitude[i]!);
        }

        if (!profUserIds.length) {
            await client.query("COMMIT");
            return { inserted: 0, failed };
        }

        // Step 4: bulk insert professional_profiles
        const { rowCount } = await client.query(
            `
            INSERT INTO Professional (
                user_id, business_name, legal_name, cnpj, category, phone,
                 whatsapp, email, website, address, neighborhood, city, state, zip_code, 
                 subscription_plan, trial_expires, is_verified, is_active,
                  source, latitude, longitude

            )
            SELECT
    unnest($1::uuid[]),
    unnest($2::text[]),
    unnest($3::text[]),
    unnest($4::text[]),
    unnest($5::text[]),
    unnest($6::text[]),
    unnest($7::text[]),
    unnest($8::text[]),
    unnest($9::text[]),
    unnest($10::text[]),
    unnest($11::text[]),
    unnest($12::text[]),
    unnest($13::text[]),
    unnest($14::text[]),
    unnest($15::text[]),
    unnest($16::date[]),        -- ✅ matches schema
    unnest($17::boolean[]),
    unnest($18::boolean[]),
    unnest($19::text[]),
    unnest($20::numeric[]),
    unnest($21::numeric[])
ON CONFLICT (user_id) DO NOTHING;
            `,
            [
                profUserIds,
                Profbusiness_name,
                proflegal_name,
                profcnpj,
                profCategory,
                profPhone,
                profWhatsapp,
                profEmail,
                profWebsite,
                profAddress,
                profNeighborhood,
                profCity,
                profState,
                profZipCode,
                profSubscription_plan,
                proftrial_expires,
                profIs_verified,
                profIs_active,
                profSource,
                profLatitudes,
                profLongitudes,
            ]
        );

        await client.query("COMMIT");
        return { inserted: rowCount ?? 0, failed };

    } catch (err) {


        if (err instanceof Error) {
            console.error("Error inserting batch:", err.message, {
                stack: err.stack,
                batchSize: batch.length,
                rowNumbers,
            });
        }

        await client.query("ROLLBACK").catch((e) => console.error("Rollback failed:", e));
        const batchFailed = rowNumbers.map((row) => ({
            row,
            error: `Batch transaction failed: ${err instanceof Error ? err.message : String(err)}`,
        }));
        return { inserted: 0, failed: [...failed, ...batchFailed] };
    }
}


/**
 * Imports professionals from a CSV file using streaming and batch processing.
 *
 * This function:
 * - Reads a CSV file as a stream to avoid loading the entire file into memory
 * - Cleans and normalizes incoming data (trimming, lowercasing, formatting headers)
 * - Validates required fields (e.g., email)
 * - Processes records in batches using `insertBatch`
 * - Handles backpressure by pausing/resuming the stream during batch inserts
 *
 * Features:
 * - BOM-safe header parsing
 * - Fault-tolerant batch processing (continues even if some rows fail)
 * - Tracks row numbers for accurate error reporting
 *
 * Error handling:
 * - Row-level validation errors are collected in `failed`
 * - Batch-level errors are caught and mapped to all rows in that batch
 * - Stream errors reject the entire import process
 *
 * @async
 * @param {string} filePath - Absolute path to the CSV file to be processed.
 * @returns {Promise<InsertResult>} Resolves with:
 * - `inserted`: total number of successfully inserted records
 * - `failed`: total number of failed rows
 *
 * @throws {Error} If CSV parsing fails or an unexpected stream error occurs.
 */
export const importProfessionalsFromCsv = async (
    filePath: string
): Promise<InsertResult> => {
    const passwordHash = await bcrypt.hash(STATIC_PASSWORD, BCRYPT_ROUNDS);

    let totalInserted = 0;
    const allFailed: { row: number; error: string }[] = [];
    let currentBatch: csvUser[] = [];
    let rowIndex = 0;



    /**
 * Streams a CSV file, cleans and validates each row, and processes them in batches.
 *
 * This function:
 * - Reads a CSV file via `fs.createReadStream` and `fast-csv` to avoid loading
 *   the entire file into memory.
 * - Normalizes headers (removes BOM, trims, lowercases, replaces spaces with underscores).
 * - Cleans and trims fields for each row.
 * - Tracks row numbers for accurate error reporting.
 * - Validates required fields (email) and pushes invalid rows into `allFailed`.
 * - Processes rows in batches using `insertBatch`.
 * - Implements backpressure by pausing/resuming the stream during batch inserts.
 *
 * @async
 * @param {string} filePath - Absolute path to the CSV file.
 * @param {string} passwordHash - Pre-hashed password used for inserted users.
 * @param {number} BATCH_SIZE - Maximum number of rows per batch.
 * @param {csvUser[]} currentBatch - Array used to accumulate rows before batch insert.
 * @param {number} rowIndex - Tracks the current CSV row number.
 * @param {number} totalInserted - Tracks total inserted records.
 * @param {{ row: number; error: string }[]} allFailed - Collects failed rows with error messages.
 * 
 * @returns {Promise<void>} Resolves when the CSV has been fully processed and all batches inserted.
 *
 * @throws {Error} If CSV parsing fails, a batch insert fails, or an unexpected stream error occurs.
 */
    await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath).pipe(

            fastCsv.parse<csvUser, csvUser>({
                /**
                 * CSV parser options.
                 *
                 * @param {string[]} raw - The original CSV header row as an array of strings.
                 *   Each string may contain BOM characters or whitespace.
                 * @returns {string[]} - The transformed header row with:
                 * @property {function(string[]): string[]} headers - Transforms CSV headers by:
                 *   1. Removing any BOM character (`\uFEFF`).
                 *   2. Trimming whitespace.
                 *   3. Converting to lowercase.
                 *   4. Replacing spaces with underscores for valid keys.
                 * @property {boolean} trim - Automatically trims whitespace from all cell values.
                 * @property {boolean} ignoreEmpty - Skips empty rows in the CSV.
                 */
                headers: (raw) =>
                    raw.map((h) =>
                        h
                            ?.replace(/^\uFEFF/, "") // 🔥 remove BOM
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                    ),
                trim: true,
                ignoreEmpty: true,

            })
        );


        try {
            let isProcessing = false;

            /**
                * Flushes the current batch of CSV rows to the database.
                *
                * This function:
                * - Uses `insertBatch` to insert the current batch.
                * - Updates `totalInserted` and `allFailed` arrays.
                * - Handles batch-level errors and assigns them to all rows in the batch.
                *
                * @async
                * @returns {Promise<void>} Resolves after the batch has been inserted.
                */
            const flushBatch = async (): Promise<void> => {
                if (currentBatch.length === 0) return;

                const batch = currentBatch;
                currentBatch = [];

                try {
                    isProcessing = true;

                    const result = await insertBatch(batch, passwordHash);
                    totalInserted += result.inserted;
                    allFailed.push(...result.failed);
                } catch (err) {
                    console.error("Batch insert failed:", err);

                    batch.forEach((row) => {
                        allFailed.push({
                            row: row.__rowNumber ?? 0,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    });
                } finally {
                    isProcessing = false;
                }
            };
            stream.on("data", (row: csvUser) => {
                // console.log("Row object:", row);
                // console.log("Row keys:", Object.keys(row));
                // console.log("Email direct access:", row.email);
                try {
                    rowIndex++;

                    const cleaned: csvUser = {
                        __rowNumber: rowIndex,
                    };

                    // 🔹 Clean fields
                    if (row.business_name?.trim()) cleaned.business_name = row.business_name.trim();
                    if (row.legal_name?.trim()) cleaned.legal_name = row.legal_name.trim();
                    if (row.email?.trim()) cleaned.email = row.email.toLowerCase().trim();
                    if (row.category?.trim()) cleaned.category = row.category.trim();
                    if (row.cnpj?.trim()) cleaned.cnpj = row.cnpj.trim();
                    if (row.city?.trim()) cleaned.city = row.city.trim().substring(0, 100)
                    if (row.state?.trim()) cleaned.state = row.state.trim();
                    if (row.phone?.trim()) cleaned.phone = row.phone.trim().substring(0, 50);
                    if (row.whatsapp?.trim()) cleaned.whatsapp = row.whatsapp.trim();
                    if (row.website?.trim()) cleaned.website = row.website.trim();
                    if (row.neighborhood?.trim()) cleaned.neighborhood = row.neighborhood.trim();
                    if (row.address?.trim()) cleaned.address = row.address.trim();
                    if (row.zip_code?.trim()) cleaned.zip_code = row.zip_code.trim();
                    if (row.subscription_plan !== undefined) cleaned.subscription_plan = row.subscription_plan;
                    if (row.trial_expires !== undefined) cleaned.trial_expires = row.trial_expires;
                    if (row.latitude !== undefined) cleaned.latitude = row.latitude;
                    if (row.longitude !== undefined) cleaned.longitude = row.longitude;
                    if (row.is_active !== undefined) cleaned.is_active = row.is_active;
                    if (row.is_verified !== undefined) cleaned.is_verified = row.is_verified;
                    if (row.source !== undefined) cleaned.source = row.source;

                    // ❌ Validation
                    if (!cleaned.email) {
                        allFailed.push({ row: rowIndex, error: "Missing email" });
                        return;
                    }

                    currentBatch.push(cleaned);
                    // 🔥 Backpressure control
                    if (currentBatch.length >= BATCH_SIZE && !isProcessing) {
                        stream.pause();

                        flushBatch()
                            .then(() => stream.resume())
                            .catch(reject);
                    }
                } catch (err) {
                    reject(err);
                }
            });

            stream.on("end", async () => {
                try {
                    await flushBatch();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            stream.on("error", (err) => {
                console.error("CSV Stream Error:", err);
                reject(
                    new Error(
                        `CSV parsing failed at row ${rowIndex}: ${err instanceof Error ? err.message : String(err)
                        }`
                    )
                );
            });
        } catch (err) {
            console.error("Unexpected error during CSV processing:", err);
            throw new Error(
                `Unexpected error during CSV processing at row ${rowIndex}: ${err instanceof Error ? err.message : String(err)
                }`
            );
        }
    });

    // ✅ Final return AFTER stream completes
    return {
        inserted: totalInserted,
        failed: allFailed.length,
    };
};

/**
 * Fetch a professional profile by ID for admin use
 *
 * Queries the database to retrieve a professional's full profile
 * using their unique ID. Throws an error if no profile is found.
 *
 * @async
 * @function getProfessionalProfileByIdByAdminService
 * @param {number} id - Unique identifier of the professional
 *
 * @returns {Promise<AdminProfessionalProfileResponse>} 
 * Returns a structured professional profile object including:
 * - Basic info (id, userId, companyName, legal_name, etc.)
 * - Contact details (phone, whatsapp, email)
 * - Location details (city, state, address, etc.)
 * - Subscription and status info (plan, rating, verification, etc.)
 *
 * @throws {Error} Will throw an error if the professional profile is not found
 */
export const getProfessionalProfileByIdByAdminService = async (id: Number): Promise<AdminProfessionalProfileResponse> => {
    const client = await getDB();
    const result = await client.query(
        `select * from professional where id = $1`,
        [id]
    );

    const row = result.rows[0];

    if (!row) {
        throw new Error("Professional profile not found");
    }

    return {
        id: row.id,
        userId: row.user_id,
        companyName: row.business_name,
        legal_name: row.legal_name,
        cnpj: row.cnpj,
        category: row.category,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
        website: row.website,
        description: row.description,
        location: {
            city: row.city,
            state: row.state,
            address: row.address,
            neighborhood: row.neighborhood,
            zip_code: row.zip_code,
        },
        contact: {
            telefone: row.phone,
            whatsapp: row.whatsapp,
        },
        subscription_plan: row.subscription_plan,
        ratings: row.rating,
        trial_expires: row.trial_expires,
        is_verified: row.is_verified,
        is_active: row.is_active,
        source: row.source,
        latitude: row.latitude,
        longitude: row.longitude,

        created_at: row.created_at,
        updated_at: row.updated_at,
    };

}



/**
 * Updates the founder status of a professional and maintains the founder counter in configuration.
 *
 * This function runs inside a database transaction and ensures:
 * - The professional exists before updating
 * - The founder configuration exists
 * - Founder limit is enforced when enabling founder status
 * - Counter is safely incremented/decremented
 * - No update occurs if the value is unchanged
 *
 * Behavior:
 * - If `isFounder` is `true`, it increments the founder counter (if within limit)
 * - If `isFounder` is `false`, it decrements the founder counter (minimum 0)
 * - If the value is unchanged, the function exits early without DB updates
 *
 * @param {number} id - Professional ID whose founder status should be updated
 * @param {boolean} isFounder - Desired founder status (true = founder, false = not founder)
 *
 * @throws {Error} If:
 * - Founder configuration is not found
 * - Professional profile is not found
 * - Founder limit has been reached
 * - Any database or transaction error occurs
 *
 * @returns {Promise<void>} Resolves when update is successfully committed
 */
export const updateFounderStatusService = async (
  id: number,
  isFounder: boolean
): Promise<void> => {
  const client = await getDB();

  try {
    await client.query("BEGIN");

    // 1. Get founder config
    const configRes = await client.query(
      `SELECT founder_counter, founder_limit 
       FROM founder_config 
       WHERE id = $1`,
      [1]
    );

    const config = configRes.rows[0];

    if (!config) {
      throw new Error("Founder configuration not found");
    }

    // 2. Get current professional state
    const partnerRes = await client.query(
      `SELECT is_founder FROM professional WHERE id = $1`,
      [id]
    );

    if (partnerRes.rowCount === 0) {
      throw new Error("Professional profile not found");
    }

    // ✅ Normalize values safely (handles boolean OR string)
    const currentValue =
      partnerRes.rows[0].is_founder === true ||
      partnerRes.rows[0].is_founder === "true";

    const nextValue = Boolean(isFounder);

    // 🚨 No change → exit safely (no counter update, no DB write)
    if (currentValue === nextValue) {
      await client.query("COMMIT");
      return;
    }

    // 3. If turning ON founder → enforce limit
    if (nextValue && config.founder_counter >= config.founder_limit) {
      throw new Error("Founder limit reached");
    }

    // 4. Update professional table
    await client.query(
      `UPDATE professional
       SET is_founder = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [nextValue, id]
    );

    // 5. Update counter safely
    if (nextValue) {
      // false → true
      await client.query(
        `UPDATE founder_config
         SET founder_counter = founder_counter + 1
         WHERE id = $1`,
        [1]
      );
    } else {
      // true → false
      await client.query(
        `UPDATE founder_config
         SET founder_counter = GREATEST(founder_counter - 1, 0)
         WHERE id = $1`,
        [1]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof Error) {
      console.error("Error updating founder status:", error.message);
      throw new Error(error.message);
    }

    console.error("Unknown error updating founder status:", error);
    throw new Error("Failed to update founder status");
  }
};
