/**
 * Ensures multi-line DEFERRED Play payloads keep current plan + pending.
 * Run: npx ts-node --transpile-only scripts/test-deferred-line-items.ts
 */
import {
  extractDeferredReplacement,
  extractLineItem,
  PlaySubscriptionV2,
} from "../src/modules/subscription/googlePlay.service";

const play = {
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  lineItems: [
    {
      productId: "starter_monthly",
      offerDetails: { basePlanId: "starter-monthly" },
      itemReplacement: {
        productId: "plus",
        replacementMode: "DEFERRED",
        basePlanId: "plus-monthly",
      },
    },
    {
      productId: "plus",
      expiryTime: "2026-07-31T10:10:56.563Z",
      offerDetails: { basePlanId: "plus-monthly" },
      deferredItemReplacement: { productId: "starter_monthly" },
    },
  ],
} as PlaySubscriptionV2;

const line = extractLineItem(play);
const deferred = extractDeferredReplacement(play);

const ok =
  line.productId === "plus" &&
  line.basePlanId === "plus-monthly" &&
  !!line.expiryTime &&
  deferred?.productId === "starter_monthly" &&
  deferred.basePlanId === "starter-monthly";

console.log({ line, deferred, ok });
process.exit(ok ? 0 : 1);
