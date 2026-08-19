import config from "../../core/config/env";
import {
  generateAccessToken,
  generateOpaqueRefreshToken,
  generatePhoneAccessToken,
  hashRefreshToken,
  parseDurationToMs,
} from "../../core/utils/usableMethods";
import { IUser } from "../../interface/user";
import {
  revokeRefreshTokenByHash,
  saveRefreshToken,
} from "./authRepository";

export interface AuthTokenPair {
  /** Short-lived access JWT */
  token: string;
  refreshToken: string;
}

/**
 * Issues a new access + refresh token pair for a user.
 *
 * @param {IUser} user - Authenticated user row.
 * @param {string} roleName - Role name for JWT claims.
 * @returns {Promise<AuthTokenPair>} Token pair.
 */
export async function issueAuthTokens(
  user: IUser,
  roleName: string
): Promise<AuthTokenPair> {
  const accessToken = user.email
    ? generateAccessToken(user.email.toLowerCase(), roleName, user.id!)
    : generatePhoneAccessToken(user.phone_number!, roleName, user.id!);

  const refreshToken = generateOpaqueRefreshToken();
  const expiresAt = new Date(
    Date.now() + parseDurationToMs(config.JWT_REFRESH_EXPIRE)
  );

  await saveRefreshToken(user.id!, refreshToken, expiresAt);

  return {
    token: accessToken,
    refreshToken,
  };
}

/**
 * Rotates a refresh token and returns a new access + refresh pair.
 *
 * @param {string} refreshToken - Raw refresh token from client.
 * @param {IUser} user - User linked to the refresh token.
 * @param {string} roleName - Role name for JWT claims.
 * @returns {Promise<AuthTokenPair>} New token pair.
 */
export async function rotateAuthTokens(
  refreshToken: string,
  user: IUser,
  roleName: string
): Promise<AuthTokenPair> {
  await revokeRefreshTokenByHash(hashRefreshToken(refreshToken));
  return issueAuthTokens(user, roleName);
}
