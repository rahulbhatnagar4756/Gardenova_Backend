import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { createUserDto } from "../../dto/userDto";
import { FacebookIdTokenPayload, FacebookUser, IRole, IUser, IUserOAuth } from "../../interface/user";
import { getDB } from "../../core/config/db";
import JwksClient from "jwks-rsa";
import jwt, { JwtHeader } from "jsonwebtoken";
import { AppleJwtPayload } from "../../interface/auth";

/**
 * Hash password helper
 * @param password - The password to hash
 * @returns A promise that resolves to the hashed password or undefined if no password is provided
 */
async function hashPassword(password?: string): Promise<string | undefined> {
  if (!password) return undefined;
  return bcrypt.hash(password, 12);
}

/**
 * Update a user's password and clear password reset fields
 * @param userId - ID of the user
 * @param hashedPassword - New hashed password
 */
export async function updateUserPassword(
  userId: string,
  hashedPassword: string
): Promise<void> {
  const client = await getDB();

  const query = `
    UPDATE users
    SET password = $1,
        password_reset_token = NULL,
        password_reset_expires = NULL,
        updated_at = NOW()
    WHERE id = $2;
  `;

  await client.query(query, [hashedPassword, userId]);
}

/**
 * Reset a user's password reset token and expiry
 * @param userId - ID of the user
 */
export async function resetPasswordResetFields(userId: string): Promise<void> {
  const client = await getDB();

  const query = `
    UPDATE users
    SET password_reset_token = NULL,
        password_reset_expires = NULL,
        updated_at = NOW()
    WHERE id = $1;
  `;

  await client.query(query, [userId]);
}

/**
 * Update a user's password reset token and expiry
 * @param userId - ID of the user
 * @param hashedToken - Hashed password reset token
 * @param resetTokenExpiry - Expiry date/time for the token
 */
export async function updatePasswordResetToken(
  userId: string,
  hashedToken: string,
  resetTokenExpiry: Date
): Promise<void> {
  const client = await getDB();

  const query = `
    UPDATE users
    SET password_reset_token = $1,
        password_reset_expires = $2,
        updated_at = NOW()
    WHERE id = $3;
  `;

  await client.query(query, [hashedToken, resetTokenExpiry, userId]);
}

/**
 * Get a role by its ID
 * @param roleId - ID of the role
 * @returns Role object or null if not found
 */
export async function getRoleById(roleId: string): Promise<IRole | null> {
  const client = await getDB();

  const query = `
    SELECT id, name
    FROM roles
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await client.query(query, [roleId]);
  return result.rows[0] || null;
}

/**
 * Create a new user profile for a given user ID
 * @param userId - ID of the user
 * @returns void
 */
export async function createUserProfile(userId: string): Promise<void> {
  const client = await getDB();

  const query = `
    INSERT INTO userprofiles (user_id, created_at, updated_at)
    VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `;

  await client.query(query, [userId]);
}

/**
 * Get a role by its name
 * @param roleName - Name of the role
 * @returns Role object or null if not found
 */
export async function getRoleByName(roleName: string): Promise<IRole | null> {
  const client = await getDB();

  const query = `
    SELECT id, name
    FROM roles
    WHERE name = $1
    LIMIT 1;
  `;

  const result = await client.query(query, [roleName]);
  return result.rows[0] || null;
}

/**
 * Compare password helper
 * @param candidatePassword - The plain text password to compare
 * @param hashedPassword - The hashed password to compare against
 * @returns A promise that resolves to true if the passwords match, false otherwise
 */
export async function comparePassword(
  candidatePassword: string,
  hashedPassword?: string
): Promise<boolean> {
  if (!hashedPassword) return false;
  return bcrypt.compare(candidatePassword, hashedPassword);
}

/**
 * Creates a validated user in PostgreSQL
 * Uses Zod DTO for validation and strips extra fields.
 * @param data - The user data to validate and insert
 * @returns A promise that resolves to the created user object
 */
export async function createValidatedUser(data: unknown): Promise<IUser> {
  try {
    // Validate input using Zod schema
    const parsedData = createUserDto.parse(data);

    const client = getDB();

    // Hash password if provided
    const hashedPassword = await hashPassword(parsedData.password);

    const query = `
      INSERT INTO users (
        name,
        email,
        password,
        firebase_uid,
        role_id,
        phone_number,
        is_email_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, firebase_uid, role_id, phone_number,
                is_email_verified, created_at, updated_at;
    `;

    const values = [
      parsedData.name,
      parsedData.email,
      hashedPassword ?? null,
      parsedData.firebaseUid ?? null,
      parsedData.roleId,
      parsedData.phoneNumber ?? null,
      parsedData.isEmailVerified ?? false,
    ];

    const result = await client.query(query, values);
    const user = result.rows[0];

    return user as IUser;
  } catch (err) {
    if (err instanceof ZodError) {
      throw err; // handled by controller
    }
    throw err; // database or runtime error
  }
}

/**
 * Finds user by email (for login)
 * @param email - The email address of the user to find
 * @returns A promise that resolves to the user object if found, or null if not found
 */
export async function findUserByEmail(email: string): Promise<IUser | null> {
  const client = await getDB();

  const query = `
    SELECT *
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;

  const result = await client.query(query, [email]);
  return result.rows[0] || null;
}

/**
 * Find a user using email or phone number.
 * Returns the user and identifies which field matched (email or phone).
 *
 * @param {string} email - Email to check for existing user.
 * @param {string} phoneNumber - Phone number to check for existing user.
 * @returns {Promise<{ user: IUser | null; conflictField?: "email" | "phone" }>}
 * An object containing the found user (if any) and the matched conflict field.
 */
export async function findUserByEmailOrPhone(
  email: string,
  phoneNumber: string
): Promise<{ user: IUser | null; conflictField?: "email" | "phone" }> {
  const client = await getDB();

  const query = `
    SELECT *
    FROM users
    WHERE email = $1 OR phone_number = $2
    LIMIT 1;
  `;

  const result = await client.query(query, [email, phoneNumber]);
  const user = result.rows[0];

  if (!user) return { user: null };

  // Determine what field caused conflict
  if (user.email === email) {
    return { user, conflictField: "email" };
  }

  if (user.phone_number === phoneNumber) {
    return { user, conflictField: "phone" };
  }

  return { user: null };
}

/**
 * Finds a user by either email or Firebase UID.
 * @param email - The user's email address
 * @param firebaseUid - The Firebase UID from Google sign-in
 * @returns A promise that resolves to the user object if found, or null if not found
 */
export async function findUserByEmailOrFirebaseUid(
  email: string,
  firebaseUid: string
): Promise<IUser | null> {
  const client = await getDB();

  const query = `
    SELECT 
      id,
      name,
      email,
      password,
      firebase_uid,
      role_id,
      phone_number,
      is_email_verified,
      profile_picture,
      created_at,
      updated_at
    FROM users
    WHERE email = $1 OR firebase_uid = $2
    LIMIT 1;
  `;

  const result = await client.query(query, [email, firebaseUid]);
  return result.rows[0] || null;
}

/**
 * Finds a user by their unique ID.
 * @param userId - The unique identifier of the user to find.
 * @returns A promise that resolves to the user object if found, or null if not found.
 */
export async function findUserById(userId: string): Promise<IUser | null> {
  const client = await getDB();

  const query = `
    SELECT *
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await client.query(query, [userId]);
  return result.rows[0] || null;
}

/**
 * Validates password for login
 * @param email - The email address of the user
 * @param password - The plain text password to validate
 * @returns A promise that resolves to the user object (without password) if credentials are valid, or null if invalid or user not found
 */
export async function validateUserCredentials(
  email: string,
  password: string
): Promise<IUser | null> {
  const client = await getDB();

  const query = `
    SELECT *
    FROM users
    WHERE email = $1;
  `;

  const result = await client.query(query, [email]);
  const user = result.rows[0];
  if (!user || !user.password) return null;

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) return null;

  delete user.password;
  return user;
}

/**
 * Finds a role by its name.
 *
 * @param roleName - The name of the role to look up (e.g., "admin", "user").
 * @returns {Promise<IRole | null>} A promise that resolves to the role object if found, or null if not found.
 */
export async function findRoleByName(roleName: string): Promise<IRole | null> {
  const client = await getDB();

  const query = `
    SELECT 
      id,
      name,
      description,
      created_at,
      updated_at
    FROM roles
    WHERE name = $1
    LIMIT 1;
  `;

  const result = await client.query(query, [roleName]);
  return result.rows[0] || null;
}

/**
 * Creates a new user record using OAuth provider data (Google, Facebook, or Apple).
 *
 * This method is called when a user signs in for the first time through an OAuth
 * provider. It stores the essential profile details along with provider-specific
 * flags to indicate the source of authentication.
 *
 * @param name - Full name of the user returned by the OAuth provider.
 * @param email - Email address verified by the OAuth provider.
 * @param uid - Unique identifier from the OAuth provider (Google UID, Facebook ID, Apple sub ID).
 * @param roleId - Role assigned to the user during registration.
 * @param isVerified - Indicates whether the user's email is verified.
 * @param isGoogleToken - True if the user authenticated via Google.
 * @param isFacebookToken - True if the user authenticated via Facebook.
 * @param isAppleToken - True if the user authenticated via Apple.
 * @returns Promise resolving to the created OAuth user record.
 */
export async function createUserFromOAuth(
  name: string,
  email: string,
  uid: string,
  roleId: string,
  isVerified: boolean,
  isGoogleToken: boolean,
  isFacebookToken: boolean,
  isAppleToken: boolean
): Promise<IUserOAuth> {
  const db = await getDB();

  // Determine which UID column to use
  let uidColumn = "";
  if (isGoogleToken) uidColumn = "google_uid";
  else if (isFacebookToken) uidColumn = "facebook_uid";
  else if (isAppleToken) uidColumn = "apple_uid";
  else throw new Error("No OAuth provider flag provided");

  // Build dynamic SQL using the selected UID column
  const query = `
    INSERT INTO users (name, email, ${uidColumn}, role_id, is_email_verified, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id, name, email, role_id, is_email_verified;
  `;

  const result = await db.query(query, [name, email, uid, roleId, isVerified]);

  return result.rows[0];
}

/**
 * Creates a new user profile entry and stores the user's profile image URL.
 *
 * This method is typically called after OAuth login when a new user is created
 * and their profile picture needs to be saved. Only the basic profile data
 * (user ID and image link) is stored here.
 *
 * @param userId - The unique identifier of the user.
 * @param pictureLink - URL of the user's profile image from the OAuth provider.
 * @returns Promise resolving when the profile record is created.
 */
export async function createUserProfileWithImage(
  userId: string,
  pictureLink: string
): Promise<void> {
  const db = await getDB();
  const query = `
    INSERT INTO userprofiles (user_id, profile_image, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW());
  `;
  await db.query(query, [userId, pictureLink]);
}

/**
 * Updates OAuth-related information for an existing user, such as provider UID
 * and authentication flags (Google, Facebook, Apple).
 *
 * This method is used when an existing user logs in again using an OAuth provider.
 * It ensures their provider UID and authentication source indicators remain updated.
 *
 * @param userId - The user's internal database ID.
 * @param uid - The OAuth provider's unique identifier (e.g., Google UID, Facebook ID, Apple sub ID).
 * @param isGoogleToken - True if the user authenticated via Google.
 * @param isFacebookToken - True if the user authenticated via Facebook.
 * @param isAppleToken - True if the user authenticated via Apple.
 * @returns Promise resolving when the user OAuth data is updated.
 */
export async function updateUserFromOAuth(
  userId: string,
  uid: string | undefined,
  isGoogleToken: boolean,
  isFacebookToken: boolean,
  isAppleToken: boolean
): Promise<void> {
  if (!uid) return; // nothing to update

  const db = await getDB();

  let uidColumn = "";

  if (isGoogleToken) uidColumn = "google_uid";
  else if (isFacebookToken) uidColumn = "facebook_uid";
  else if (isAppleToken) uidColumn = "apple_uid";
  else throw new Error("No OAuth provider flag provided");

  const query = `
    UPDATE users
    SET ${uidColumn} = $1,
        updated_at = NOW()
    WHERE id = $2
  `;

  await db.query(query, [uid, userId]);
}


/**
 * JWKS client configured to fetch Apple public signing keys.
 * Used to verify the signature of Apple identity tokens (JWT).
 */
const client = JwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});
/**
 * Retrieves the Apple public signing key based on the JWT header `kid`.
 * This function is used as a dynamic key resolver for `jsonwebtoken.verify`.
 *
 * @param {object} header - Decoded JWT header containing the `kid` (Key ID).
 * @param {Function} callback - Callback function invoked with the public key
 * or an error if the key cannot be retrieved.
 */
function getAppleSigningKey(header: JwtHeader, callback: (err: Error | null, key?: string) => void): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }

    if (!key) {
      return callback(new Error("Signing key not found"));
    }

    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verifies an Apple identity token (JWT).
 * The token is validated using Apple's public keys, ensuring:
 * - The signature is valid (RS256)
 * - The issuer is Apple
 * - The audience matches the configured Apple client ID
 *
 * @param appleIdToken - Apple identity token received from Apple Sign-In.
 * @returns Decoded token payload if valid.
 */
export function verifyAppleIdToken(
  appleIdToken: string
): Promise<AppleJwtPayload> {
  return new Promise((resolve, reject) => {
    const _decoded = jwt.decode(appleIdToken, { complete: true }) as
      | { header: JwtHeader; payload: AppleJwtPayload }
      | null;

    jwt.verify(
      appleIdToken,
      getAppleSigningKey,
      {
        algorithms: ["RS256"],
        issuer: "https://appleid.apple.com",
        audience: process.env.APPLE_CLIENT_ID,
      },
      (err, verified) => {
        if (err) return reject(err);

        if (!verified || typeof verified === "string") {
          return reject(new Error("Invalid Apple ID token payload"));
        }

        resolve(verified as AppleJwtPayload);
      }
    );
  });
}

/**
 * Finds a user in the database by their Apple UID.
 *
 * @param appleId - The unique Apple identifier (`sub`) for the user.
 * @returns The user object if found, or `null` if no user exists.
 */
export async function findUserByAppleId(appleId: string): Promise<IUser | null> {
  const db = await getDB();
  const query = `SELECT * FROM users WHERE apple_uid = $1`;
  const result = await db.query(query, [appleId]);
  return result.rows[0] || null;
}



/**
 * Initializes a JWKS (JSON Web Key Set) client for Facebook.
 *
 * This client fetches and caches Facebook's public RSA keys, which are used
 * to verify the signature of Facebook ID tokens (JWTs).
 *
 * Keys are retrieved from Facebook’s official OpenID Connect JWKS endpoint
 * and cached in memory to reduce network calls and improve performance.
 */
const facebookJwksClient = JwksClient({
  jwksUri: "https://www.facebook.com/.well-known/oauth/openid/jwks/",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
});

/**
 * Retrieves the appropriate Facebook public signing key based on the `kid`
 * (Key ID) found in the JWT header.
 *
 * This function is used internally by the `jsonwebtoken.verify` method
 * to dynamically resolve the correct public key for signature validation.
 *
 * @param header - Decoded JWT header containing the `kid`
 * @param callback - Callback function invoked with the resolved public key
 *                   or an error if the key cannot be retrieved
 * @returns void
 */
const getFacebookSigningKey = (
  header: JwtHeader,
  callback: (err: Error | null, key?: string) => void
):void  => {
  if (!header.kid) {
    return callback(new Error("Missing kid in Facebook ID token"));
  }

  facebookJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key!.getPublicKey());
  });
};

/**
 * Verifies a Facebook ID token (JWT).
 *
 * The token is validated using Facebook’s public keys, ensuring:
 * - The signature is valid (RS256)
 * - The issuer (`iss`) is Facebook
 * - The audience (`aud`) matches the configured Facebook App ID
 * - The token is not expired
 *
 * This method performs full cryptographic verification and should be used
 * only for authentication (not for Graph API access).
 *
 * @param idToken - Facebook ID token received from the client
 * @returns A promise resolving to a normalized Facebook user object
 *          containing the user’s unique Facebook ID and optional profile data
 *
 * @throws Error if the token is invalid, expired, or fails verification
 */
export function verifyFacebookIdToken(
  idToken: string
): Promise<FacebookUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getFacebookSigningKey,
      {
        algorithms: ["RS256"],
        issuer: "https://www.facebook.com",
        audience: process.env.FACEBOOK_APP_ID,
      },
      (err, decoded) => {
        if (err) return reject(err);

        if (!decoded || typeof decoded === "string") {
          return reject(new Error("Invalid Facebook ID token payload"));
        }

        const payload = decoded as FacebookIdTokenPayload;

        if (!payload.sub) {
          return reject(new Error("Facebook ID token missing sub"));
        }

        const user: FacebookUser = {
          id: payload.sub,
          ...(payload.email && { email: payload.email }),
          ...(payload.name && { name: payload.name }),
          ...(payload.picture && { picture: payload.picture }),
        };

        resolve(user);
      }
    );
  });
}