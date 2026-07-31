import fs from "fs";
import path from "path";
import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { androidpublisher_v3 } from "googleapis";
import config from "../../core/config/env";
import logger from "../../core/config/logger";
import { SubscriptionStatus } from "../../interface/subscription";

export type PlaySubscriptionV2 = androidpublisher_v3.Schema$SubscriptionPurchaseV2;

/** Hard HTTP timeout for all Play Developer API calls (verify must never hang). */
const PLAY_API_TIMEOUT_MS = 8_000;
const PLAY_AUTH_TIMEOUT_MS = 5_000;

let cachedAuth: GoogleAuth | null = null;

/**
 * Treats HTTP 2xx responses as success for axios validateStatus.
 *
 * @param {number} status - HTTP status code from axios.
 * @returns {boolean} True when status is in the 2xx range.
 */
function isHttpSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Rejects if `promise` does not settle within `ms`.
 *
 * @param {Promise<T>} promise - Underlying async work.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} label - Error label for logs / messages.
 * @returns {Promise<T>} Resolved value of the original promise.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  try {
    return await Promise.race([
      promise.then((value) => {
        finished = true;
        return value;
      }),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    void promise.catch((err: unknown) => {
      if (!finished) {
        logger.warn(`${label} failed after timeout`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
}

/**
 * Returns the configured Google Play package name.
 *
 * @returns {string} Android application package name.
 */
function getPackageName(): string {
  const pkg = config.GOOGLE_PLAY_PACKAGE_NAME;
  if (!pkg) {
    throw new Error("GOOGLE_PLAY_PACKAGE_NAME is not configured");
  }
  return pkg;
}

/**
 * Parses Google Play service-account credentials from env.
 *
 * @returns {object} Service account JSON object.
 */
function getServiceAccountCredentials(): object {
  const raw = config.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured");
  }

  try {
    if (raw.startsWith("{")) {
      return JSON.parse(raw) as object;
    }

    const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    const fileContents = fs.readFileSync(resolved, "utf8");
    return JSON.parse(fileContents) as object;
  } catch (err) {
    if (err instanceof Error && err.message.includes("GOOGLE_PLAY")) {
      throw err;
    }
    throw new Error(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON or readable key file path"
    );
  }
}

/**
 * Returns a cached GoogleAuth client for Play Developer API.
 *
 * @returns {GoogleAuth} Auth client.
 */
function getGoogleAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = new GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return cachedAuth;
}

/**
 * Fetches a short-lived access token for Play API calls.
 *
 * @returns {Promise<string>} Bearer access token.
 */
async function getAccessToken(): Promise<string> {
  const auth = getGoogleAuth();
  const client = await withTimeout(
    auth.getClient(),
    PLAY_AUTH_TIMEOUT_MS,
    "Play auth.getClient"
  );
  const tokenResponse = await withTimeout(
    client.getAccessToken(),
    PLAY_AUTH_TIMEOUT_MS,
    "Play getAccessToken"
  );
  const token =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse?.token ?? null;
  if (!token) {
    throw new Error("Failed to obtain Google Play access token");
  }
  return token;
}

/**
 * Fetches a subscription purchase via Android Publisher Subscriptions v2 API.
 * Uses axios timeouts so the call cannot hang the verify request indefinitely.
 *
 * @param {string} purchaseToken - Google Play purchase token.
 * @returns {Promise<PlaySubscriptionV2>} Subscription purchase payload from Play.
 */
export async function fetchPlaySubscription(
  purchaseToken: string
): Promise<PlaySubscriptionV2> {
  const accessToken = await getAccessToken();
  const packageName = getPackageName();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;

  try {
    const res = await axios.get<PlaySubscriptionV2>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: PLAY_API_TIMEOUT_MS,
      validateStatus: isHttpSuccess,
    });
    if (!res.data) {
      throw new Error("Empty response from Google Play subscriptionsv2.get");
    }
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.code === "ECONNABORTED") {
      throw new Error(`Play subscriptionsv2.get timed out after ${PLAY_API_TIMEOUT_MS}ms`);
    }
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const body = err.response?.data;
      throw new Error(
        `Play subscriptionsv2.get failed${status ? ` (${status})` : ""}: ${
          typeof body === "string" ? body : JSON.stringify(body ?? err.message)
        }`
      );
    }
    throw err;
  }
}

/**
 * Acknowledges a subscription purchase (required within 3 days).
 *
 * Google docs (May 2025+): subscriptionId is optional and not recommended.
 * Passing the wrong subscriptionId on deferred replacements commonly hangs/fails.
 * We try the token-only acknowledge URL first, then fall back to current product id.
 *
 * @param {string | null} productId - Current entitlement product id (fallback only).
 * @param {string} purchaseToken - Google Play purchase token.
 * @returns {Promise<void>} Resolves when acknowledge succeeds.
 */
export async function acknowledgePlaySubscription(
  productId: string | null,
  purchaseToken: string
): Promise<void> {
  const accessToken = await getAccessToken();
  const packageName = getPackageName();
  const tokenPath = encodeURIComponent(purchaseToken);
  const pkgPath = encodeURIComponent(packageName);

  const urls: string[] = [
    // Preferred: no subscriptionId (recommended since May 2025)
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkgPath}/purchases/subscriptions/tokens/${tokenPath}:acknowledge`,
  ];
  if (productId) {
    urls.push(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkgPath}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${tokenPath}:acknowledge`
    );
  }

  let lastError: unknown;
  for (const url of urls) {
    try {
      await axios.post(
        url,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: PLAY_API_TIMEOUT_MS,
          validateStatus: isHttpSuccess,
        }
      );
      return;
    } catch (err) {
      lastError = err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      // 404 → try fallback URL shape; other errors still try fallback once.
      logger.warn("Play acknowledge attempt failed", {
        status: status ?? null,
        hasProductId: !!productId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (axios.isAxiosError(lastError) && lastError.code === "ECONNABORTED") {
    throw new Error(`Play subscriptions.acknowledge timed out after ${PLAY_API_TIMEOUT_MS}ms`);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Play acknowledge failed: ${String(lastError)}`);
}

/**
 * Maps Play subscriptionState to local status.
 *
 * @param {string | null | undefined} subscriptionState - Play subscription state enum string.
 * @returns {SubscriptionStatus} Local subscription status.
 */
export function mapPlayStateToLocal(
  subscriptionState: string | null | undefined
): SubscriptionStatus {
  switch (subscriptionState) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "in_grace";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "on_hold";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "canceled";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    default:
      logger.warn(`Unknown Play subscriptionState: ${subscriptionState}`);
      return "pending";
  }
}

type PlayLineItem = NonNullable<PlaySubscriptionV2["lineItems"]>[number];

/**
 * Picks the line item that represents the user's CURRENT entitlement.
 *
 * On DEFERRED downgrade Play often returns two line items:
 * - [0] incoming lower plan (no expiry yet)
 * - [1] current higher plan with `deferredItemReplacement` + expiry
 *
 * @param {PlaySubscriptionV2} play - SubscriptionPurchaseV2 payload.
 * @returns {PlayLineItem | undefined} Current-entitlement line item.
 */
function pickCurrentLineItem(play: PlaySubscriptionV2): PlayLineItem | undefined {
  const items = play.lineItems ?? [];
  const withDeferred = items.find((item) => !!item?.deferredItemReplacement?.productId);
  if (withDeferred) return withDeferred;
  return items[0];
}

/**
 * Extracts the current-entitlement line item product / base plan / expiry.
 *
 * @param {PlaySubscriptionV2} play - SubscriptionPurchaseV2 payload.
 * @returns {{ productId: string | null, basePlanId: string | null, expiryTime: Date | null, autoRenewing: boolean | null }}
 * Primary line-item fields used by local billing sync.
 */
export function extractLineItem(play: PlaySubscriptionV2): {
  productId: string | null;
  basePlanId: string | null;
  expiryTime: Date | null;
  autoRenewing: boolean | null;
} {
  const item = pickCurrentLineItem(play);
  const productId = item?.productId ?? null;
  const basePlanId = item?.offerDetails?.basePlanId ?? null;
  const expiryTime = item?.expiryTime ? new Date(item.expiryTime) : null;
  const autoRenewing =
    typeof item?.autoRenewingPlan?.autoRenewEnabled === "boolean"
      ? item.autoRenewingPlan.autoRenewEnabled
      : null;
  return { productId, basePlanId, expiryTime, autoRenewing };
}

/**
 * Extracts a deferred (period-end) replacement from any line item.
 *
 * @param {PlaySubscriptionV2} play - SubscriptionPurchaseV2 payload.
 * @returns {{ productId: string, basePlanId: string | null } | null} Pending product ids, or null.
 */
export function extractDeferredReplacement(
  play: PlaySubscriptionV2
): { productId: string; basePlanId: string | null } | null {
  const items = play.lineItems ?? [];
  for (const item of items) {
    const deferred = item?.deferredItemReplacement;
    const productId = deferred?.productId;
    if (!productId) continue;

    const fromDeferred =
      (deferred as { basePlanId?: string | null })?.basePlanId ?? null;
    const fromTargetLine =
      items.find((line) => line?.productId === productId)?.offerDetails?.basePlanId ??
      null;

    return {
      productId,
      basePlanId: fromDeferred ?? fromTargetLine ?? null,
    };
  }
  return null;
}

/** RTDN subscriptionNotification.notificationType codes */
export const PLAY_NOTIFICATION_TYPES: Record<number, string> = {
  1: "SUBSCRIPTION_RECOVERED",
  2: "SUBSCRIPTION_RENEWED",
  3: "SUBSCRIPTION_CANCELED",
  4: "SUBSCRIPTION_PURCHASED",
  5: "SUBSCRIPTION_ON_HOLD",
  6: "SUBSCRIPTION_IN_GRACE_PERIOD",
  7: "SUBSCRIPTION_RESTARTED",
  8: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
  9: "SUBSCRIPTION_DEFERRED",
  10: "SUBSCRIPTION_PAUSED",
  11: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
  12: "SUBSCRIPTION_REVOKED",
  13: "SUBSCRIPTION_EXPIRED",
};
