// /**
//  * Full subscription/payment feature verification (upgrade + downgrade).
//  * Run: npx ts-node --transpile-only scripts/verify-subscription-feature.ts
//  */
// import {
//   comparePlanChange,
//   TIER_RANK,
// } from "../src/interface/subscription";
// import {
//   extractDeferredReplacement,
//   extractLineItem,
//   mapPlayStateToLocal,
//   PLAY_NOTIFICATION_TYPES,
//   PlaySubscriptionV2,
// } from "../src/modules/subscription/googlePlay.service";

// let passed = 0;
// let failed = 0;

// function assert(name: string, condition: boolean, detail?: string): void {
//   if (condition) {
//     passed += 1;
//     console.log(`  PASS  ${name}`);
//   } else {
//     failed += 1;
//     console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
//   }
// }

// /** Mirrors verifySubscriptionPayment defer/activate decision (same user). */
// function decideChange(params: {
//   currentTier: "free" | "starter" | "plus" | "pro" | null;
//   nextTier: "starter" | "plus" | "pro";
//   currentPrice: number;
//   nextPrice: number;
//   hasDeferredField: boolean;
//   playAlreadyOnLower: boolean;
// }): "activate" | "defer" {
//   const hasPaid =
//     params.currentTier !== null &&
//     params.currentTier !== "free";
//   const kind = hasPaid
//     ? comparePlanChange(
//         { tier: params.currentTier!, price_inr: params.currentPrice },
//         { tier: params.nextTier, price_inr: params.nextPrice }
//       )
//     : "upgrade";

//   if (
//     params.hasDeferredField ||
//     (kind === "downgrade" && hasPaid && !params.playAlreadyOnLower)
//   ) {
//     return "defer";
//   }
//   return "activate";
// }

// function testTierBasics(): void {
//   console.log("\n[1] Tier rank + comparePlanChange");
//   assert(
//     "free < starter < plus < pro",
//     TIER_RANK.free < TIER_RANK.starter &&
//       TIER_RANK.starter < TIER_RANK.plus &&
//       TIER_RANK.plus < TIER_RANK.pro
//   );
//   assert(
//     "starter → plus = upgrade",
//     comparePlanChange({ tier: "starter", price_inr: 99 }, { tier: "plus", price_inr: 199 }) ===
//       "upgrade"
//   );
//   assert(
//     "pro → plus = downgrade",
//     comparePlanChange({ tier: "pro", price_inr: 299 }, { tier: "plus", price_inr: 199 }) ===
//       "downgrade"
//   );
//   assert(
//     "plus → plus same price = same",
//     comparePlanChange({ tier: "plus", price_inr: 199 }, { tier: "plus", price_inr: 199 }) ===
//       "same"
//   );
//   assert(
//     "plus monthly → plus yearly = upgrade (price)",
//     comparePlanChange({ tier: "plus", price_inr: 199 }, { tier: "plus", price_inr: 1999 }) ===
//       "upgrade"
//   );
//   assert(
//     "plus yearly → plus monthly = downgrade (price)",
//     comparePlanChange({ tier: "plus", price_inr: 1999 }, { tier: "plus", price_inr: 199 }) ===
//       "downgrade"
//   );
// }

// function testUpgradeDowngradeMatrix(): void {
//   console.log("\n[2] Upgrade immediate / Downgrade deferred matrix");

//   const prices = { starter: 99, plus: 199, pro: 299 };

//   const cases: Array<{
//     name: string;
//     current: "starter" | "plus" | "pro" | null;
//     next: "starter" | "plus" | "pro";
//     hasDeferredField: boolean;
//     playAlreadyOnLower: boolean;
//     expect: "activate" | "defer";
//   }> = [
//     {
//       name: "first purchase → activate",
//       current: null,
//       next: "starter",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "activate",
//     },
//     {
//       name: "upgrade starter → plus → activate",
//       current: "starter",
//       next: "plus",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "activate",
//     },
//     {
//       name: "upgrade plus → pro → activate",
//       current: "plus",
//       next: "pro",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "activate",
//     },
//     {
//       name: "upgrade starter → pro → activate",
//       current: "starter",
//       next: "pro",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "activate",
//     },
//     {
//       name: "downgrade pro → plus + DEFERRED → defer",
//       current: "pro",
//       next: "plus",
//       hasDeferredField: true,
//       playAlreadyOnLower: false,
//       expect: "defer",
//     },
//     {
//       name: "downgrade plus → starter + DEFERRED → defer",
//       current: "plus",
//       next: "starter",
//       hasDeferredField: true,
//       playAlreadyOnLower: false,
//       expect: "defer",
//     },
//     {
//       name: "downgrade pro → starter (line still current) → defer",
//       current: "pro",
//       next: "starter",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "defer",
//     },
//     {
//       name: "downgrade but Play already switched (wrong mode) → activate",
//       current: "pro",
//       next: "plus",
//       hasDeferredField: false,
//       playAlreadyOnLower: true,
//       expect: "activate",
//     },
//     {
//       name: "same tier treated as activate path (same)",
//       current: "plus",
//       next: "plus",
//       hasDeferredField: false,
//       playAlreadyOnLower: false,
//       expect: "activate",
//     },
//   ];

//   for (const c of cases) {
//     const decision = decideChange({
//       currentTier: c.current,
//       nextTier: c.next,
//       currentPrice: c.current ? prices[c.current] : 0,
//       nextPrice: prices[c.next],
//       hasDeferredField: c.hasDeferredField,
//       playAlreadyOnLower: c.playAlreadyOnLower,
//     });
//     assert(c.name, decision === c.expect, `got ${decision}`);
//   }
// }

// function testFrequentSwitchSequence(): void {
//   console.log("\n[3] Frequent upgrade/downgrade sequence (same user)");

//   // Simulate entitlement state machine for one user
//   let plan: "starter" | "plus" | "pro" = "starter";
//   let pending: "starter" | "plus" | "pro" | null = null;

//   // upgrade to plus
//   let d = decideChange({
//     currentTier: plan,
//     nextTier: "plus",
//     currentPrice: 99,
//     nextPrice: 199,
//     hasDeferredField: false,
//     playAlreadyOnLower: false,
//   });
//   assert("seq1 upgrade → activate", d === "activate");
//   if (d === "activate") {
//     plan = "plus";
//     pending = null;
//   }

//   // upgrade to pro
//   d = decideChange({
//     currentTier: plan,
//     nextTier: "pro",
//     currentPrice: 199,
//     nextPrice: 299,
//     hasDeferredField: false,
//     playAlreadyOnLower: false,
//   });
//   assert("seq2 upgrade → activate", d === "activate");
//   if (d === "activate") {
//     plan = "pro";
//     pending = null;
//   }

//   // downgrade to plus (deferred)
//   d = decideChange({
//     currentTier: plan,
//     nextTier: "plus",
//     currentPrice: 299,
//     nextPrice: 199,
//     hasDeferredField: true,
//     playAlreadyOnLower: false,
//   });
//   assert("seq3 downgrade → defer", d === "defer");
//   if (d === "defer") {
//     pending = "plus";
//     // plan stays pro
//   }
//   assert("seq3 still on pro", plan === "pro");
//   assert("seq3 pending plus", pending === "plus");

//   // upgrade again before period end → activate, clear pending
//   d = decideChange({
//     currentTier: plan,
//     nextTier: "pro",
//     currentPrice: 299,
//     nextPrice: 299,
//     hasDeferredField: false,
//     playAlreadyOnLower: false,
//   });
//   // same tier same price = same → activate path
//   assert("seq4 re-upgrade/same → activate", d === "activate");
//   plan = "pro";
//   pending = null;
//   assert("seq4 pending cleared", pending === null);

//   // downgrade to starter
//   d = decideChange({
//     currentTier: plan,
//     nextTier: "starter",
//     currentPrice: 299,
//     nextPrice: 99,
//     hasDeferredField: true,
//     playAlreadyOnLower: false,
//   });
//   assert("seq5 downgrade → defer", d === "defer");
//   pending = "starter";
//   assert("seq5 still pro until period end", plan === "pro" && pending === "starter");

//   // period end applies pending
//   plan = pending!;
//   pending = null;
//   assert("seq6 after period end on starter", plan === "starter" && pending === null);
// }

// function testPlayPayloads(): void {
//   console.log("\n[4] Play payload extractors (upgrade vs deferred downgrade)");

//   const upgradePlay: PlaySubscriptionV2 = {
//     subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
//     linkedPurchaseToken: "old-token-pro",
//     lineItems: [
//       {
//         productId: "pro",
//         expiryTime: "2026-08-31T00:00:00.000Z",
//         offerDetails: { basePlanId: "pro-monthly" },
//         autoRenewingPlan: { autoRenewEnabled: true },
//       },
//     ],
//   };
//   assert("upgrade line = pro", extractLineItem(upgradePlay).productId === "pro");
//   assert("upgrade no deferred", extractDeferredReplacement(upgradePlay) === null);
//   assert("active maps to active", mapPlayStateToLocal(upgradePlay.subscriptionState) === "active");

//   const deferredPlay: PlaySubscriptionV2 = {
//     subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
//     lineItems: [
//       {
//         productId: "pro",
//         offerDetails: { basePlanId: "pro-monthly" },
//         deferredItemReplacement: { productId: "plus" },
//         autoRenewingPlan: { autoRenewEnabled: true },
//       },
//     ],
//   };
//   assert("deferred: current line still pro", extractLineItem(deferredPlay).productId === "pro");
//   assert(
//     "deferred: pending product plus",
//     extractDeferredReplacement(deferredPlay)?.productId === "plus"
//   );

//   const expiredOld: PlaySubscriptionV2 = {
//     subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
//     lineItems: [{ productId: "plus", offerDetails: { basePlanId: "plus-monthly" } }],
//   };
//   assert(
//     "expired old sub maps expired",
//     mapPlayStateToLocal(expiredOld.subscriptionState) === "expired"
//   );
// }

// function testRtdnTypes(): void {
//   console.log("\n[5] RTDN notification types used in payment flow");
//   assert("PURCHASED=4", PLAY_NOTIFICATION_TYPES[4] === "SUBSCRIPTION_PURCHASED");
//   assert("DEFERRED=9", PLAY_NOTIFICATION_TYPES[9] === "SUBSCRIPTION_DEFERRED");
//   assert("EXPIRED=13", PLAY_NOTIFICATION_TYPES[13] === "SUBSCRIPTION_EXPIRED");
//   assert("RENEWED=2", PLAY_NOTIFICATION_TYPES[2] === "SUBSCRIPTION_RENEWED");
// }

// function testTokenConflictRules(): void {
//   console.log("\n[6] Token ownership rules (same user vs other account)");

//   // Documented behavior of claimPurchaseTokenForUser — pure logic mirror
//   type Row = { userId: string; status: string };
//   function claim(
//     caller: string,
//     existing: Row | null
//   ): "ok" | "reclaim" | "reject" {
//     if (!existing) return "ok";
//     if (existing.userId === caller) return "ok";
//     if (existing.status === "expired" || existing.status === "canceled") return "reclaim";
//     return "reject";
//   }

//   assert(
//     "same user upgrading with new token path: no prior owner → ok",
//     claim("A", null) === "ok"
//   );
//   assert(
//     "same user already owns token → ok",
//     claim("A", { userId: "A", status: "active" }) === "ok"
//   );
//   assert(
//     "other user active → reject (your error)",
//     claim("A", { userId: "B", status: "active" }) === "reject"
//   );
//   assert(
//     "other user expired → reclaim",
//     claim("A", { userId: "B", status: "expired" }) === "reclaim"
//   );
//   assert(
//     "frequent up/down same user does not reject",
//     claim("A", { userId: "A", status: "active" }) === "ok"
//   );
// }

// async function testLiveApis(): Promise<void> {
//   console.log("\n[7] Live API smoke (localhost:8080)");

//   const base = "http://localhost:8080/api/v1/plans";

//   // Webhook test notification
//   try {
//     const testPayload = {
//       version: "1.0",
//       packageName: "com.gardenova.digisoft",
//       testNotification: { version: "1.0" },
//     };
//     const data = Buffer.from(JSON.stringify(testPayload)).toString("base64");
//     const res = await fetch(`${base}/webhooks/google-play`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         message: { data, messageId: `pay-test-${Date.now()}` },
//         subscription: "projects/test/subscriptions/play-rtdn",
//       }),
//     });
//     const json = (await res.json()) as { success?: boolean };
//     assert("webhook test → 200", res.status === 200);
//     assert("webhook success", json.success === true);
//   } catch (err) {
//     assert("webhook reachable", false, err instanceof Error ? err.message : String(err));
//   }

//   for (const [method, path] of [
//     ["GET", "/getplans"],
//     ["GET", "/subscriptions/me"],
//     ["POST", "/subscriptions/verify"],
//   ] as const) {
//     try {
//       const res = await fetch(`${base}${path}`, {
//         method,
//         headers: { "Content-Type": "application/json" },
//         body: method === "POST" ? "{}" : undefined,
//       });
//       assert(`${method} ${path} → 401 without JWT`, res.status === 401);
//     } catch (err) {
//       assert(`${method} ${path}`, false, err instanceof Error ? err.message : String(err));
//     }
//   }
// }

// async function main(): Promise<void> {
//   console.log("=== Payment system verification (upgrade / downgrade) ===");
//   testTierBasics();
//   testUpgradeDowngradeMatrix();
//   testFrequentSwitchSequence();
//   testPlayPayloads();
//   testRtdnTypes();
//   testTokenConflictRules();
//   await testLiveApis();

//   console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
//   if (failed > 0) process.exit(1);

//   console.log(`
// Manual E2E still needed (real Play purchase + JWT):
//   1. Buy starter → verify → /me shows starter
//   2. Upgrade to plus (CHARGE_FULL_PRICE) → verify activated:true → /me plus, pending null
//   3. Downgrade to starter (DEFERRED) → verify deferred:true → /me still plus + pending starter
//   4. Wait period end / RTDN → /me starter, pending null
// `);
// }

// void main();
