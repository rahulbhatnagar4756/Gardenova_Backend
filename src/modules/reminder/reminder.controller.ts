import {  Response } from 'express';
import {
  
  upsertFcmToken,
  deleteFcmToken,
  
} from './reminder.queries';

import { AuthUserPayload, IUser } from '../../interface/user';
import { findUserByEmail } from '../auth/authRepository';
import { AuthRequest } from '../../interface/auth';

// ─── POST /reminders/snooze ──────────────────────────────────────────────────
/**
 * Snoozes a plant-care reminder notification.
 *
 * Validates ownership of the notification, determines the configured
 * snooze duration for the reminder type, and updates the notification
 * log with a new `snoozed_until` timestamp.
 *
 * Request body:
 * - notification_log_id: UUID of the notification log entry.
 *
 * Responses:
 * - 200: Reminder successfully snoozed.
 * - 400: Missing notification ID or reminder already completed.
 * - 403: Notification does not belong to the authenticated user.
 * - 404: Notification log not found.
 * - 409: Reminder could not be snoozed due to a state conflict.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>}
 */


/**
 * Resolves the authenticated user from the request.
 *
 * Retrieves the user email from the authenticated JWT payload,
 * looks up the corresponding user record, and returns it.
 * If no user is found, a `401 Unauthorized` response is sent.
 *
 * @param req - Express request containing the authenticated user payload.
 * @param res - Express response object used to send an unauthorized response.
 * @returns The resolved user object, or `null` if the user is not authorized.
 */
async function resolveUser(req: AuthRequest, res: Response):Promise<IUser | null> {
    const userPayload = req.user as AuthUserPayload | undefined;
    const user = await findUserByEmail(userPayload?.userEmail!);
    if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
    }
    return user;
}


// ─── POST /reminders/token ───────────────────────────────────────────────────
// Called by app on login or when FCM token refreshes
/**
 * Registers or updates an FCM (Firebase Cloud Messaging) token for a user.
 *
 * If the token already exists for the user, it will be updated (upsert operation).
 * This allows the system to send push notifications to the user's device.
 * @param req - Express request object containing the FCM token in the request body
 *              and authenticated user information in `req.user`.
 * @param res - Express response object
 * @returns  JSON response indicating whether the token was successfully stored
 */
export async function registerToken(req: AuthRequest, res: Response): Promise<Response> {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    const user = await resolveUser(req, res);
    if (!user) return res as unknown as Response;

    await upsertFcmToken(user.id!, token);
    return res.json({ success: true });
}

// ─── DELETE /reminders/token ─────────────────────────────────────────────────
// Called on logout
/**
 * Removes an FCM (Firebase Cloud Messaging) token for a user.
 *
 * This is used when a device is logged out or when the push token
 * should no longer receive notifications.
 *
 * @param req - Express request object containing the FCM token in the body
 *              and authenticated user information in `req.user`.
 * @param res - Express response object
 * @returns JSON response confirming whether the token was removed successfully
 */
export async function removeToken(req: AuthRequest, res: Response): Promise<Response> {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    const user = await resolveUser(req, res);
    if (!user) return res as unknown as Response;

    await deleteFcmToken(user.id!, token);
    return res.json({ success: true });
}








