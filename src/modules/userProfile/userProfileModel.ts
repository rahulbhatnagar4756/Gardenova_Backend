import { getDB } from "../../core/config/db";
import { IUserProfile } from "../../interface/userProfile";
import { updateUserProfileValidation } from "./userProfileValidations";

/**
 * Fetches a user profile record by its ID.
 *
 * @param profileId - The unique identifier of the user profile to fetch.
 * @returns A promise that resolves to the user profile object if found, or `null` if not found.
 */
export async function getUserProfileById(
  profileId: string
): Promise<IUserProfile | null> {
  const client = await getDB();
  const result = await client.query<IUserProfile>(
    "SELECT * FROM userprofiles WHERE id = $1",
    [profileId]
  );
  return result.rows[0] || null;
}

/**
 * Updates an existing user profile with validation.
 * @param profileId - UUID of the profile to update
 * @param data - Unvalidated input data
 * @param userId - ID of the user making the update (for auditing or related updates)
 * @returns Updated profile record or null if not found
 */
export async function updateValidatedUserProfile(
  profileId: string,
  data: unknown,
  userId: string
): Promise<IUserProfile | null> {
  const client = await getDB();

  try {
    const { error: validationError, value: parsedData } =
      updateUserProfileValidation.validate(data, {
        abortEarly: false,
        stripUnknown: true,
      });

    if (validationError) {
      throw new Error(validationError.details.map((d) => d.message).join(", "));
    }

    // ── Profile table update ───────────────────────────────────────────────
    const profileFieldMap: Record<string, string> = {
      profile_image: "profileImage",
      date_of_birth: "dateOfBirth",
      gender: "gender",
      bio: "bio",
      street: "street",
      city: "city",
      state: "state",
      country: "country",
      zip_code: "zipCode",
      occupation: "occupation",
      company: "company",
    };

    const profileSetClauses: string[] = [];
    const profileValues: unknown[] = [];
    let paramIndex = 1;

    for (const [column, dtoKey] of Object.entries(profileFieldMap)) {
      if (parsedData[dtoKey] !== undefined) {
        profileSetClauses.push(`${column} = $${paramIndex++}`);
        profileValues.push(parsedData[dtoKey]);
      }
    }

    let updatedRow: IUserProfile | null = null;

    if (profileSetClauses.length > 0) {
      profileSetClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      profileValues.push(profileId);

      const profileQuery = `
        UPDATE userprofiles
        SET ${profileSetClauses.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING
          id, user_id, profile_image, date_of_birth, gender, bio,
          street, city, state, country, zip_code,
          occupation, company, updated_at;
      `;

      const result = await client.query<IUserProfile>(profileQuery, profileValues);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      updatedRow = {
        ...row,
        updated_at:
          row?.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : row?.updatedAt,
      } as unknown as IUserProfile;
    }

    // ── Users table update ─────────────────────────────────────────────────
    if (parsedData.contactNumber !== undefined || parsedData.name !== undefined) {
      const userSetClauses: string[] = [];
      const userValues: unknown[] = [];
      let userParamIndex = 1;

      if (parsedData.contactNumber !== undefined) {
        userSetClauses.push(`phone_number = $${userParamIndex++}`);
        userValues.push(parsedData.contactNumber);
      }

      if (parsedData.name !== undefined) {
        userSetClauses.push(`name = $${userParamIndex++}`);
        userValues.push(parsedData.name);
      }

      userSetClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      userValues.push(userId);

      const userQuery = [
        "UPDATE users",
        "SET " + userSetClauses.join(", "),
        "WHERE id = $" + userParamIndex,
      ].join(" ");

      // console.log("USER QUERY =>", userQuery);
      // console.log("USER VALUES =>", userValues);

      await client.query(userQuery, userValues);
    }

    return updatedRow;
  } catch (err) {
    throw err;
  }
}
// eslint-disable-next-line
/**
 * @function getProfessionalProfileById
 * @description
 * Retrieves the stored profile image key for a professional user
 * from the `professional_accounts` table using the user ID.
 *
 * @async
 * @param {string} profileId - The user ID associated with the professional account.
 *
 * @returns {Promise<string | null>}
 * Returns:
 * - `string` → The profile image key stored in the database.
 * - `null` → If no professional account or profile image is found.
 *
 * @throws {Error} If the database query fails.
 */
export async function getProfessionalProfileById(
  profileId: string
): Promise<string | null> {
  const client = await getDB();
  const result = await client.query(
    "SELECT profile_image FROM professional_accounts WHERE user_id = $1",
    [profileId]
  );
  return result.rows[0] || null;
}

interface IEmailVerification {
  code: string;
  expiresAt: Date;
}
/**
 * Saves an email verification code for a user in the database.
 *
 * This function inserts a new verification record into the
 * `email_verifications` table with:
 * - User ID
 * - Verification code
 * - Expiration timestamp
 * - Initial usage status (`is_used = false`)
 *
 * @async
 * @function saveEmailVerificationCode
 *
 * @param {string} userId - Unique identifier of the user.
 * @param {IEmailVerification} body - Verification payload containing
 * the OTP code and expiration time.
 *
 * @returns {Promise<void>} Resolves when the verification code is saved.
 *
 * @throws Will throw an error if the database insert operation fails.
 *
 * @example
 * await saveEmailVerificationCode(userId, {
 *   code: "4831",
 *   expiresAt: new Date(Date.now() + 10 * 60 * 1000),
 * });
 */
export const saveEmailVerificationCode = async (userId: string, body: IEmailVerification): Promise<void> => {
  const client = await getDB();
  await client.query(
    `INSERT INTO email_verifications (user_id, code,expires_at,is_Used) VALUES ($1, $2, $3,$4)`,
    [userId, body.code, body.expiresAt, false]
  );
}