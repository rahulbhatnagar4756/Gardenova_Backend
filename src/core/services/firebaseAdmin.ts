import config from "../config/env";
import { jwtDecode } from "jwt-decode";
import { TokenPayload } from "google-auth-library";
import axios from "axios";
import * as crypto from "crypto";

/**
 * Decodes a Google Access token WITHOUT verifying audience or signature.
 *
 * @param googleAccessToken Google OAuth Access Token
 * @returns Decoded payload (unsafe decode)
 */
export const decodeGoogleAccessToken = (
  googleAccessToken: string
): TokenPayload | null => {
  try {
    const payload = jwtDecode<TokenPayload>(googleAccessToken);
    return payload ?? null;
  } catch (err) {
    console.error("Failed to decode Google token", err);
    return null;
  }
};

/**
 * Verifies Facebook access token and fetches user info.
 *
 * @param {string} userAccessToken - Facebook user access token
 * @returns {Promise<{ id: string; email: string; name: string; picture: string } | null>}
 *          Returns user info if token is valid, otherwise null.
 */
export const verifyFacebookToken = async (
  userAccessToken: string
): Promise<{
  id: string;
  email: string;
  name: string;
  picture: string;
} | null> => {
  try {
    // Validate token
    const fbToken = `${config.FB_APP_ID}|${config.FB_APP_SECRET}`;
    const debugRes = await axios.get(
      `https://graph.facebook.com/debug_token?input_token=${userAccessToken}&access_token=${fbToken}`
    );

    if (!debugRes.data.data.is_valid) return null;

    // Generate appsecret_proof
    const appSecretProof = crypto
      .createHmac("sha256", config.FB_APP_SECRET)
      .update(userAccessToken)
      .digest("hex");

    // Get user info
    const userRes = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${userAccessToken}&appsecret_proof=${appSecretProof}`
    );

    return {
      id: userRes.data.id,
      email: userRes.data.email,
      name: userRes.data.name,
      picture: userRes.data.picture.data.url,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("Facebook validation failed:", err.response?.data);
    } else {
      console.error("Unexpected error:", err);
    }
    return null;
  }
};
