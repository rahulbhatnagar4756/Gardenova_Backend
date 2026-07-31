/**
 * Offline checks for upgrade/downgrade decision logic (no Play / no DB writes).
 *
 * Run:
 *   npx ts-node --transpile-only scripts/test-subscription-compare.ts
 */
import { comparePlanChange } from "../src/interface/subscription";

const cases: Array<{
  name: string;
  current: { tier: "free" | "starter" | "plus" | "pro"; price_inr: number };
  next: { tier: "free" | "starter" | "plus" | "pro"; price_inr: number };
  expect: "upgrade" | "downgrade" | "same";
  android: string;
}> = [
  {
    name: "starter monthly -> plus monthly",
    current: { tier: "starter", price_inr: 99 },
    next: { tier: "plus", price_inr: 199 },
    expect: "upgrade",
    android: "CHARGE_FULL_PRICE",
  },
  {
    name: "plus monthly -> pro monthly",
    current: { tier: "plus", price_inr: 199 },
    next: { tier: "pro", price_inr: 299 },
    expect: "upgrade",
    android: "CHARGE_FULL_PRICE",
  },
  {
    name: "pro monthly -> plus monthly",
    current: { tier: "pro", price_inr: 299 },
    next: { tier: "plus", price_inr: 199 },
    expect: "downgrade",
    android: "DEFERRED",
  },
  {
    name: "pro monthly -> pro yearly",
    current: { tier: "pro", price_inr: 299 },
    next: { tier: "pro", price_inr: 2999 },
    expect: "upgrade",
    android: "CHARGE_FULL_PRICE",
  },
  {
    name: "pro yearly -> pro monthly",
    current: { tier: "pro", price_inr: 2999 },
    next: { tier: "pro", price_inr: 299 },
    expect: "downgrade",
    android: "DEFERRED",
  },
  {
    name: "same plan",
    current: { tier: "plus", price_inr: 199 },
    next: { tier: "plus", price_inr: 199 },
    expect: "same",
    android: "n/a",
  },
];

let failed = 0;
console.log("=== subscription comparePlanChange ===\n");
for (const c of cases) {
  const got = comparePlanChange(c.current, c.next);
  const ok = got === c.expect;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.name}\n` +
      `       got=${got} expect=${c.expect}  android=${c.android}\n`
  );
}

console.log(
  failed === 0
    ? "All compare checks passed.\n\nManual Play test after clear:\n" +
        "1) Buy starter/plus/pro (verify) → /me shows paid plan\n" +
        "2) Upgrade with CHARGE_FULL_PRICE → activates immediately\n" +
        "3) Downgrade with DEFERRED → stays on current + pending_plan\n" +
        "4) npx ts-node --transpile-only scripts/inspect-subscriptions.ts"
    : `${failed} compare check(s) failed`
);

process.exit(failed === 0 ? 0 : 1);
