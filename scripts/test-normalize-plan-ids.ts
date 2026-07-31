// /**
//  * Quick test for normalizeVerifyPlanIds against live DB.
//  * Run: npx ts-node --transpile-only scripts/test-normalize-plan-ids.ts
//  */
// import { connectDB } from "../src/core/config/db";
// import { normalizeVerifyPlanIds } from "../src/modules/subscription/subscriptionRepository";

// async function main(): Promise<void> {
//   await connectDB();

//   const cases: Array<{ productId: string; basePlanId: string | null }> = [
//     { productId: "pro", basePlanId: "monthly" },
//     { productId: "pro", basePlanId: "pro-monthly" },
//     { productId: "plus", basePlanId: "yearly" },
//     { productId: "starter_monthly", basePlanId: null },
//     { productId: "starter_monthly", basePlanId: "monthly" },
//     { productId: "starter", basePlanId: "monthly" },
//     { productId: "plus", basePlanId: "plus-monthly" },
//   ];

//   let failed = 0;
//   for (const c of cases) {
//     const out = await normalizeVerifyPlanIds(c.productId, c.basePlanId);
//     const ok = !!out.productId && out.planCode !== null;
//     if (!ok) failed += 1;
//     console.log(
//       `${ok ? "PASS" : "FAIL"} in=${JSON.stringify(c)} -> out=${JSON.stringify(out)}`
//     );
//   }

//   console.log(failed === 0 ? "\nAll normalization cases resolved a plan." : `\n${failed} case(s) failed.`);
//   process.exit(failed === 0 ? 0 : 1);
// }

// void main();
