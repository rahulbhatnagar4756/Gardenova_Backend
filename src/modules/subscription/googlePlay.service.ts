// import { GoogleAuth } from 'google-auth-library';
// import { GoogleSubscriptionResponse } from '../types/subscription.types';

// const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

// let authClient: GoogleAuth | null = null;

// function getAuthClient(): GoogleAuth {
//   if (!authClient) {
//     authClient = new GoogleAuth({
//       keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
//       // OR use keyFilename or credentials object:
//       // credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
//       scopes: [ANDROID_PUBLISHER_SCOPE],
//     });
//   }
//   return authClient;
// }

// /**
//  * Verify a subscription purchase token with Google Play Developer API
//  * Always call this before trusting any purchaseToken
//  */
// export async function verifySubscriptionWithGoogle(
//   packageName: string,
//   subscriptionId: string,
//   purchaseToken: string
// ): Promise<GoogleSubscriptionResponse> {
//   const auth = getAuthClient();
//   const client = await auth.getClient();
//   const accessToken = await client.getAccessToken();

//   const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

//   const response = await fetch(url, {
//     headers: {
//       Authorization: `Bearer ${accessToken.token}`,
//       'Content-Type': 'application/json',
//     },
//   });

//   if (!response.ok) {
//     const error = await response.json().catch(() => ({}));
//     const status = response.status;

//     if (status === 400) throw new GooglePlayError('INVALID_TOKEN', 'Purchase token is invalid or malformed', 400);
//     if (status === 401) throw new GooglePlayError('AUTH_FAILED', 'Google service account auth failed', 401);
//     if (status === 404) throw new GooglePlayError('NOT_FOUND', 'Subscription not found — may be expired or invalid token', 404);
//     if (status === 410) throw new GooglePlayError('TOKEN_EXPIRED', 'Purchase token has expired', 410);

//     throw new GooglePlayError('GOOGLE_API_ERROR', `Google API error: ${JSON.stringify(error)}`, status);
//   }

//   return response.json() as Promise<GoogleSubscriptionResponse>;
// }

// /**
//  * Acknowledge a new subscription — MUST be called within 3 days of purchase
//  * Only needed for NEW purchases (notificationType = 4), NOT for renewals
//  */
// export async function acknowledgeSubscription(
//   packageName: string,
//   subscriptionId: string,
//   purchaseToken: string
// ): Promise<void> {
//   const auth = getAuthClient();
//   const client = await auth.getClient();
//   const accessToken = await client.getAccessToken();

//   const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:acknowledge`;

//   const response = await fetch(url, {
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${accessToken.token}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({}),
//   });

//   // 204 = success, 200 = already acknowledged (both are fine)
//   if (!response.ok && response.status !== 204) {
//     throw new GooglePlayError('ACK_FAILED', `Failed to acknowledge subscription: ${response.status}`, response.status);
//   }
// }

// export class GooglePlayError extends Error {
//   constructor(
//     public code: string,
//     message: string,
//     public httpStatus: number = 500
//   ) {
//     super(message);
//     this.name = 'GooglePlayError';
//   }
// }