import jwt, { SignOptions, Secret } from "jsonwebtoken";
import config from "../config/env";

if (!config.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

const jwtSecret: Secret = config.JWT_SECRET;

/**
 * Converts a string or undefined into a valid JWT `expiresIn` value.
 *
 * @param {string | undefined} value - The expiration value. Can be a number (seconds) or a duration string like "15m", "1h", "7d".
 * @returns {NonNullable<SignOptions["expiresIn"]>} The converted expiration suitable for JWT signing.
 * @throws {Error} Throws an error if the value is invalid.
 */
function toExpiresIn(
  value: string | undefined
): NonNullable<SignOptions["expiresIn"]> {
  if (!value) return "1h";
  const n = Number(value);
  if (!Number.isNaN(n)) return n;
  if (/^[0-9]+(ms|s|m|h|d|w|y)$/.test(value)) {
    return value as unknown as NonNullable<SignOptions["expiresIn"]>;
  }
  throw new Error(
    `Invalid JWT_EXPIRE: ${value}. Use seconds or duration like 15m, 1h, 7d.`
  );
}

/**
 * Generates a JWT token for a user.
 *
 * @param {string} userEmail - The email of the user for whom the token is generated.
 * @param {string} role - The role of the user (e.g., "admin", "user").
 * @param {string }userId - The user id
 * @returns {string} The signed JWT token.
 */
export const generateToken = (
  userEmail: string,
  role: string,
  userId: string
): string => {
  const options: SignOptions = {
    expiresIn: toExpiresIn(config.JWT_EXPIRE),
    algorithm: "HS512",
  };
  // Encode each parameter to base64
  const encodedEmail = Buffer.from(userEmail).toString("base64");
  const encodedRole = Buffer.from(role).toString("base64");
  const encodedUserId = Buffer.from(userId).toString("base64");

  return jwt.sign(
    {
      userEmail: encodedEmail,
      role: encodedRole,
      userId: encodedUserId,
    },
    jwtSecret,
    options
  );
};

/**
 * Downloads a remote image and converts it into a Buffer.
 *
 * @param {string} imageUrl - Public URL of the image to download.
 * @returns {Promise<Buffer>} - A buffer containing the downloaded image data.
 */
export async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
/**
 * Generates a JWT token for phone-based authentication.
 *
 * The function encodes the user's phone number, role, and user ID using Base64
 * before adding them to the JWT payload. The generated token is signed using
 * the HS512 algorithm and includes an expiration time configured through JWT settings.
 *
 * @param {string} userPhone - The user's phone number to include in the token.
 * @param {string} role - The user's role or access level.
 * @param {string} userId - The unique identifier of the user.
 *
 * @returns {string} A signed JWT token containing the encoded user information.
 *
 * @example
 * const token = generatePhoneToken("+1234567890", "user", "12345");
 */
export const generatePhoneToken = (
  userPhone: string,
  role: string,
  userId: string
): string => {
  const options: SignOptions = {
    expiresIn: toExpiresIn(config.JWT_EXPIRE),
    algorithm: "HS512",
  };

  const encodedPhone  = Buffer.from(userPhone).toString("base64");
  const encodedRole   = Buffer.from(role).toString("base64");
  const encodedUserId = Buffer.from(userId).toString("base64");

  return jwt.sign(
    {
      userPhone: encodedPhone,
      role:      encodedRole,
      userId:    encodedUserId,
    },
    jwtSecret,
    options
  );
};
