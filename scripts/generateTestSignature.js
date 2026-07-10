// /**
//  * Generates a valid razorpay_signature for a given payment_id + subscription_id
//  * pair, using the same HMAC formula the real backend uses to verify it.
//  *
//  * This lets you test the /subscriptions/verify endpoint locally WITHOUT
//  * going through a real Razorpay Checkout flow — since verifyCheckoutSignature()
//  * only checks that the signature was computed correctly with your key_secret,
//  * it doesn't actually validate the payment_id against Razorpay's servers.
//  *
//  * Usage:
//  *   RAZORPAY_KEY_SECRET=xxxxx node generateTestSignature.js sub_QRstUvWxYZ1234
//  */

// const crypto = require("crypto");
// require("dotenv").config(); // auto-loads .env from project root — run this script from project root

// const keySecret = process.env.RAZORPAY_KEY_SECRET;
// if (!keySecret) {
//   console.error("Set RAZORPAY_KEY_SECRET env var first.");
//   process.exit(1);
// }

// const subscriptionId = process.argv[2];
// if (!subscriptionId) {
//   console.error("Usage: node generateTestSignature.js <razorpay_subscription_id>");
//   process.exit(1);
// }

// // fake payment id is fine — signature formula doesn't validate its existence
// const paymentId = "pay_TEST" + Date.now();

// const body = `${paymentId}|${subscriptionId}`;
// const signature = crypto.createHmac("sha256", keySecret).update(body).digest("hex");

// // console.log("\n--- Use this in your /verify request body ---\n");
// console.log(
//   JSON.stringify(
//     {
//       razorpay_payment_id: paymentId,
//       razorpay_subscription_id: subscriptionId,
//       razorpay_signature: signature,
//     },
//     null,
//     2
//   )
// );