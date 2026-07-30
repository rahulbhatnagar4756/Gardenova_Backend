import fs from "fs";
import path from "path";
import { google, androidpublisher_v3 } from "googleapis";
import config from "../../core/config/env";
import logger from "../../core/config/logger";
import { SubscriptionStatus } from "../../interface/subscription";

export type PlaySubscriptionV2 = androidpublisher_v3.Schema$SubscriptionPurchaseV2;

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
 * Accepts either inline JSON or a path to a JSON key file.
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
 * Builds an authenticated Android Publisher API client.
 *
 * @returns {androidpublisher_v3.Androidpublisher} Android Publisher v3 client.
 */
function getAndroidPublisher(): androidpublisher_v3.Androidpublisher {
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return google.androidpublisher({ version: "v3", auth });
}

/**
 * Fetches a subscription purchase via Android Publisher Subscriptions v2 API.
 *
 * @param {string} purchaseToken - Google Play purchase token.
 * @returns {Promise<PlaySubscriptionV2>} Subscription purchase payload from Play.
 */
export async function fetchPlaySubscription(
  purchaseToken: string
): Promise<PlaySubscriptionV2> {
  const androidpublisher = getAndroidPublisher();
  const res = await androidpublisher.purchases.subscriptionsv2.get({
    packageName: getPackageName(),
    token: purchaseToken,
  });
  if (!res.data) {
    throw new Error("Empty response from Google Play subscriptionsv2.get");
  }
  return res.data;
}

/**
 * Acknowledges a subscription purchase (required within 3 days).
 * Uses productId as subscriptionId for the legacy acknowledge endpoint.
 *
 * @param {string} productId - Play subscription product / SKU id.
 * @param {string} purchaseToken - Google Play purchase token.
 * @returns {Promise<void>} Resolves when acknowledge succeeds.
 */
export async function acknowledgePlaySubscription(
  productId: string,
  purchaseToken: string
): Promise<void> {
  const androidpublisher = getAndroidPublisher();
  await androidpublisher.purchases.subscriptions.acknowledge({
    packageName: getPackageName(),
    subscriptionId: productId,
    token: purchaseToken,
    requestBody: {},
  });
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

/**
 * Extracts the primary line item product / base plan / expiry from v2 payload.
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
  const item = play.lineItems?.[0];
  const productId = item?.productId ?? null;
  const basePlanId = item?.offerDetails?.basePlanId ?? null;
  const expiryTime = item?.expiryTime ? new Date(item.expiryTime) : null;
  const autoRenewing =
    typeof item?.autoRenewingPlan?.autoRenewEnabled === "boolean"
      ? item.autoRenewingPlan.autoRenewEnabled
      : null;
  return { productId, basePlanId, expiryTime, autoRenewing };
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
