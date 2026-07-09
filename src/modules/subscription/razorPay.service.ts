import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Shared Razorpay SDK client instance, initialized using API keys from env vars.
 * Use `rzp_test_*` keys in development/staging and `rzp_live_*` only in production.
 *
 * @constant
 * @type {Razorpay}
 */
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Verifies the signature returned by Razorpay Checkout (`handler` callback)
 * after a subscription payment completes on the client (web or mobile SDK).
 *
 * Formula per Razorpay docs:
 *   HMAC_SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret)
 *
 * A mismatch means either the payload was tampered with in transit, or the
 * payment/subscription IDs don't actually correspond to a legitimate Razorpay
 * transaction signed with this account's key secret.
 *
 * Note: this check confirms the *signature* is valid — it does NOT flip the
 * subscription's status in the DB. That happens via the webhook, which is
 * the source of truth for subscription state. This function is used purely
 * to give the client fast feedback that the payment went through.
 *
 * @function verifyCheckoutSignature
 * @param {Object} params
 * @param {string} params.razorpay_payment_id - Payment ID returned by Razorpay Checkout.
 * @param {string} params.razorpay_subscription_id - Subscription ID returned by Razorpay Checkout.
 * @param {string} params.razorpay_signature - HMAC signature returned by Razorpay Checkout.
 * @returns {boolean} `true` if the computed signature matches the one provided by Razorpay, `false` otherwise.
 */
export function verifyCheckoutSignature(params: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): boolean {
  const body = `${params.razorpay_payment_id}|${params.razorpay_subscription_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return expected === params.razorpay_signature;
}

/**
 * Verifies the `X-Razorpay-Signature` header on incoming webhook requests
 * from Razorpay (server-to-server), confirming the event genuinely originated
 * from Razorpay and wasn't spoofed by a third party.
 *
 * Formula per Razorpay docs:
 *   HMAC_SHA256(rawRequestBody, webhookSecret)
 *
 * IMPORTANT: `rawBody` must be the raw, unparsed request body (Buffer or
 * string) exactly as received on the wire — NOT `JSON.stringify(parsedBody)`.
 * Re-serializing a parsed JSON object can silently change whitespace/key
 * ordering, which breaks the signature check even though the payload is
 * semantically identical. This is why the webhook route must use
 * `express.raw()` instead of `express.json()`.
 *
 * @function verifyWebhookSignature
 * @param {string | Buffer} rawBody - The raw, unparsed request body as received from Razorpay.
 * @param {string} signature - The value of the `X-Razorpay-Signature` request header.
 * @returns {boolean} `true` if the computed signature matches the header value, `false` otherwise.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}