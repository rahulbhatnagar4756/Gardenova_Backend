import crypto from "crypto";
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
 * Builds the encoded JWT payload shared by access tokens.
 *
 * @param {object} input - User identity fields.
 * @param {string} [input.userEmail] - User email.
 * @param {string} [input.userPhone] - User phone.
 * @param {string} input.role - User role.
 * @param {string} input.userId - User id.
 * @returns {Record<string, string>} Encoded JWT payload.
 */
function buildEncodedJwtPayload(input: {
  userEmail?: string;
  userPhone?: string;
  role: string;
  userId: string;
}): Record<string, string> {
  const payload: Record<string, string> = {
    role: Buffer.from(input.role).toString("base64"),
    userId: Buffer.from(input.userId).toString("base64"),
  };

  if (input.userEmail) {
    payload.userEmail = Buffer.from(input.userEmail).toString("base64");
  }
  if (input.userPhone) {
    payload.userPhone = Buffer.from(input.userPhone).toString("base64");
  }

  return payload;
}

/**
 * Generates a short-lived access JWT for a user.
 *
 * @param {string} userEmail - User email.
 * @param {string} role - User role.
 * @param {string} userId - User id.
 * @returns {string} Signed access token.
 */
export const generateAccessToken = (
  userEmail: string,
  role: string,
  userId: string
): string => {
  const options: SignOptions = {
    expiresIn: toExpiresIn(config.JWT_EXPIRE),
    algorithm: "HS512",
  };

  return jwt.sign(
    buildEncodedJwtPayload({ userEmail, role, userId }),
    jwtSecret,
    options
  );
};

/**
 * Generates a short-lived access JWT for phone-based auth.
 *
 * @param {string} userPhone - User phone number.
 * @param {string} role - User role.
 * @param {string} userId - User id.
 * @returns {string} Signed access token.
 */
export const generatePhoneAccessToken = (
  userPhone: string,
  role: string,
  userId: string
): string => {
  const options: SignOptions = {
    expiresIn: toExpiresIn(config.JWT_EXPIRE),
    algorithm: "HS512",
  };

  return jwt.sign(
    buildEncodedJwtPayload({ userPhone, role, userId }),
    jwtSecret,
    options
  );
};

/**
 * Generates a JWT token for a user.
 * Kept for backward compatibility with existing callers.
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
): string => generateAccessToken(userEmail, role, userId);

/**
 * Creates a random opaque refresh token.
 *
 * @returns {string} Raw refresh token.
 */
export const generateOpaqueRefreshToken = (): string =>
  crypto.randomBytes(48).toString("hex");

/**
 * Hashes a refresh token for secure DB storage.
 *
 * @param {string} refreshToken - Raw refresh token.
 * @returns {string} SHA-256 hash.
 */
export const hashRefreshToken = (refreshToken: string): string =>
  crypto.createHash("sha256").update(refreshToken).digest("hex");

/**
 * Parses a duration string into milliseconds.
 *
 * @param {string} value - Duration like `30d`, `15m`, or seconds as number string.
 * @returns {number} Milliseconds.
 */
export function parseDurationToMs(value: string): number {
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) return asNumber * 1000;

  const match = value.match(/^(\d+)(ms|s|m|h|d|w|y)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  } as const;
  const unit = match[2] as keyof typeof multipliers;

  return amount * multipliers[unit];
}

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
): string => generatePhoneAccessToken(userPhone, role, userId);
