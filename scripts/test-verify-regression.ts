/**
 * Regression matrix for verify decision + deferred line-item extraction.
 * Run: npx ts-node --transpile-only scripts/test-verify-regression.ts
 */
import {
  extractDeferredReplacement,
  extractLineItem,
  PlaySubscriptionV2,
} from "../src/modules/subscription/googlePlay.service";
import { decideVerifyChange } from "../src/modules/subscription/verifyDecision";

let passed = 0;
let failed = 0;

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const pro = { id: "p", code: "pro_monthly", tier: "pro" as const, price_inr: 299 };
const plus = { id: "l", code: "plus_monthly", tier: "plus" as const, price_inr: 199 };
const starter = {
  id: "s",
  code: "starter_monthly",
  tier: "starter" as const,
  price_inr: 99,
};

// 1) First purchase activates
{
  const d = decideVerifyChange({
    hasPaidCurrent: false,
    currentPlan: { id: "f", code: "free", tier: "free", price_inr: 0 },
    activeLinePlan: plus,
    pendingTargetPlan: null,
    deferredFromPlay: false,
    bodyMappedPlan: plus,
  });
  assert("first purchase activates", d.mode === "activate" && d.keepOrActivatePlan.code === "plus_monthly");
}

// 2) Upgrade activates new plan
{
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: plus,
    activeLinePlan: pro,
    pendingTargetPlan: null,
    deferredFromPlay: false,
    bodyMappedPlan: pro,
  });
  assert(
    "upgrade activates pro",
    d.mode === "activate" && d.changeKind === "upgrade" && d.keepOrActivatePlan.code === "pro_monthly"
  );
}

// 3) Play deferred downgrade keeps current + pending
{
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: pro,
    activeLinePlan: pro,
    pendingTargetPlan: plus,
    deferredFromPlay: true,
    bodyMappedPlan: plus,
  });
  assert(
    "deferred downgrade keeps pro pending plus",
    d.mode === "defer" &&
      d.keepOrActivatePlan.code === "pro_monthly" &&
      d.pendingPlan?.code === "plus_monthly"
  );
}

// 4) Immediate Play lower SKU still defers locally
{
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: pro,
    activeLinePlan: plus,
    pendingTargetPlan: null,
    deferredFromPlay: false,
    bodyMappedPlan: plus,
  });
  assert(
    "immediate lower SKU still defers (keep pro)",
    d.mode === "defer" &&
      d.playAlreadyOnLower &&
      d.keepOrActivatePlan.code === "pro_monthly" &&
      d.pendingPlan?.code === "plus_monthly"
  );
}

// 5) Same plan activates (idempotent verify)
{
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: pro,
    activeLinePlan: pro,
    pendingTargetPlan: null,
    deferredFromPlay: false,
    bodyMappedPlan: pro,
  });
  assert("same plan activates/refreshes", d.mode === "activate" && d.changeKind === "same");
}

// 6) Multi-line deferred extraction
{
  const play = {
    lineItems: [
      {
        productId: "starter_monthly",
        offerDetails: { basePlanId: "starter-monthly" },
      },
      {
        productId: "pro",
        expiryTime: "2026-08-01T00:00:00.000Z",
        offerDetails: { basePlanId: "pro-monthly" },
        deferredItemReplacement: { productId: "starter_monthly" },
      },
    ],
  } as PlaySubscriptionV2;
  const line = extractLineItem(play);
  const deferred = extractDeferredReplacement(play);
  assert(
    "multi-line extract current=pro pending=starter",
    line.productId === "pro" && deferred?.productId === "starter_monthly"
  );
}

// 7) Single-line upgrade extraction unchanged
{
  const play = {
    lineItems: [
      {
        productId: "pro",
        expiryTime: "2026-08-01T00:00:00.000Z",
        offerDetails: { basePlanId: "pro-monthly" },
        autoRenewingPlan: { autoRenewEnabled: true },
      },
    ],
  } as PlaySubscriptionV2;
  const line = extractLineItem(play);
  const deferred = extractDeferredReplacement(play);
  assert(
    "single-line upgrade extract unchanged",
    line.productId === "pro" && deferred === null && line.autoRenewing === true
  );
}

// 8) Monthly -> yearly same tier = upgrade
{
  const proMonthly = { ...pro, price_inr: 299 };
  const proYearly = { ...pro, id: "py", code: "pro_yearly", price_inr: 2999 };
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: proMonthly,
    activeLinePlan: proYearly,
    pendingTargetPlan: null,
    deferredFromPlay: false,
    bodyMappedPlan: proYearly,
  });
  assert("monthly->yearly upgrade activates", d.mode === "activate" && d.changeKind === "upgrade");
}

// 9) Yearly -> monthly = defer
{
  const proYearly = { ...pro, id: "py", code: "pro_yearly", price_inr: 2999 };
  const proMonthly = { ...pro, price_inr: 299 };
  const d = decideVerifyChange({
    hasPaidCurrent: true,
    currentPlan: proYearly,
    activeLinePlan: proYearly,
    pendingTargetPlan: proMonthly,
    deferredFromPlay: true,
    bodyMappedPlan: proMonthly,
  });
  assert(
    "yearly->monthly defers",
    d.mode === "defer" && d.pendingPlan?.code === "pro_monthly"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
