// /**
//  * Simulates a Razorpay webhook call directly to your local server —
//  * no ngrok/tunnel needed. This tests your webhook handler's signature
//  * verification + event processing logic end-to-end, using a fake but
//  * correctly-signed payload.
//  *
//  * NOTE: This does NOT test the real Razorpay -> your server delivery path
//  * (network reachability, Razorpay's actual retry behavior, etc). For that,
//  * you still eventually need a public URL (ngrok/localtunnel/cloudflared/
//  * or your staging server). But for testing your OWN webhook logic —
//  * signature check, idempotency, DB updates — this is enough.
//  *
//  * Usage:
//  *   node scripts/simulateWebhook.js subscription.charged sub_TBONraMFRK6d0N
//  *   node scripts/simulateWebhook.js subscription.activated sub_TBONraMFRK6d0N
//  *   node scripts/simulateWebhook.js subscription.cancelled sub_TBONraMFRK6d0N
//  */

// const crypto = require("crypto");
// const http = require("http");
// require("dotenv").config();

// const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
// if (!webhookSecret) {
//   console.error("Set RAZORPAY_WEBHOOK_SECRET in your .env first.");
//   process.exit(1);
// }

// const eventType = process.argv[2];
// const subscriptionId = process.argv[3];

// if (!eventType || !subscriptionId) {
//   console.error("Usage: node simulateWebhook.js <event_type> <razorpay_subscription_id>");
//   console.error("Example: node simulateWebhook.js subscription.charged sub_TBONraMFRK6d0N");
//   process.exit(1);
// }

// const now = Math.floor(Date.now() / 1000);
// const oneMonthLater = now + 30 * 24 * 60 * 60;

// // Minimal fake subscription entity — enough fields for handleSubscriptionEvent() to work
// const payload = {
//   event: eventType,
//   created_at: now,
//   payload: {
//     subscription: {
//       entity: {
//         id: subscriptionId,
//         plan_id: process.argv[4] || "plan_TBietTV7tmLW6Z",
//         status: eventType.split(".")[1], // rough mapping, fine for local testing
//         current_start: now,
//         current_end: oneMonthLater,
//       },
//     },
//   },
// };

// const rawBody = JSON.stringify(payload);

// const signature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

// const options = {
//   hostname: "localhost",
//   port: 8080,
//   path: "/api/v1/plans/webhooks/razorpay",
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//     "Content-Length": Buffer.byteLength(rawBody),
//     "X-Razorpay-Signature": signature,
//   },
// };

// const req = http.request(options, (res) => {
//   let body = "";
//   res.on("data", (chunk) => (body += chunk));
//   res.on("end", () => {
//     console.log(`\nStatus: ${res.statusCode}`);
//     console.log(`Response: ${body}`);
//   });
// });

// req.on("error", (err) => {
//   console.error("Request failed:", err.message);
// });

// req.write(rawBody);
// req.end();

// console.log("Sent fake webhook:");
// console.log(JSON.stringify(payload, null, 2));