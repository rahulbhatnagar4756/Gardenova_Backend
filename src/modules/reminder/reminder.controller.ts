import {  Response } from 'express';
import {
  getLogWithPlant,
  completeLog,
  updatePlantAfterCompletion,
  upsertFcmToken,
  deleteFcmToken,
  rescheduleReminder,
  disableReminder,
} from './reminder.queries';
import { ReminderType } from '../../interface/reminder';

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
// ─── POST /reminders/complete ────────────────────────────────────────────────
/**
 * Marks a plant care reminder notification as completed.
 *
 * Steps:
 * - Validates `notification_log_id` from request body
 * - Fetches the notification log and associated plant
 * - Ensures the requesting user owns the reminder
 * - Prevents re-processing if already completed (idempotent)
 * - Marks the notification log as completed
 * - Updates plant's last and next scheduled care timestamps
 *
 * @param req - Express request object containing `notification_log_id`
 * @param res - Express response object
 * @returns JSON response indicating success or failure status
 */
export async function markComplete(req: AuthRequest, res: Response): Promise<Response> {
    const { notification_log_id } = req.body;

    if (!notification_log_id) {
        return res.status(400).json({ error: "notification_log_id is required" });
    }

    const logWithPlant = await getLogWithPlant(notification_log_id);
    if (!logWithPlant) {
        return res.status(404).json({ error: "Notification log not found" });
    }

    const user = await resolveUser(req, res);
    if (!user) return res as unknown as Response;

    if (logWithPlant.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    if (logWithPlant.status === "completed") {
        return res.json({ success: true, already_completed: true });
    }

    const completed = await completeLog(notification_log_id);
    if (!completed) {
        return res.status(409).json({ error: "Could not complete reminder" });
    }

    await updatePlantAfterCompletion(
        logWithPlant.user_plant_id,
        logWithPlant.reminder_type as ReminderType,
        new Date()
    );

    return res.json({ success: true });
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


/**
 * Reschedules an existing reminder for an authenticated user.
 *
 * Validates the request payload, verifies ownership of the reminder,
 * ensures the reminder is not already completed, and updates the
 * reminder's scheduled time.
 *
 * @param req - Express request containing the authenticated user and request body.
 * @param res - Express response object used to return success or error responses.
 * @returns A JSON response indicating whether the reminder was successfully rescheduled.
 *
 * @response 400 - Missing or invalid `notification_log_id`, invalid datetime, past datetime, or completed reminder.
 * @response 401 - User is not authenticated.
 * @response 403 - User does not own the reminder.
 * @response 404 - Notification log not found.
 * @response 200 - Reminder successfully rescheduled.
 */
export async function rescheduleReminderController(
    req: AuthRequest,
    res: Response
): Promise<Response> {
    const { notification_log_id, reschedule_to } = req.body;

    if (!notification_log_id) {
        return res.status(400).json({ error: "notification_log_id is required" });
    }

    if (!reschedule_to || isNaN(Date.parse(reschedule_to))) {
        return res.status(400).json({ error: "reschedule_to must be a valid ISO datetime" });
    }

    if (new Date(reschedule_to) <= new Date()) {
        return res.status(400).json({ error: "reschedule_to must be a future datetime" });
    }

    const logWithPlant = await getLogWithPlant(notification_log_id);
    if (!logWithPlant) {
        return res.status(404).json({ error: "Notification log not found" });
    }

    const user = await resolveUser(req, res);
    if (!user) return res as unknown as Response;

    if (logWithPlant.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    if (logWithPlant.status === "completed") {
        return res.status(400).json({ error: "Cannot reschedule a completed reminder" });
    }

    await rescheduleReminder(
        logWithPlant.user_plant_id,
        logWithPlant.reminder_type as ReminderType,
        new Date(reschedule_to)
    );

    return res.json({ success: true, rescheduled_to: reschedule_to });
}


/**
 * Disables an existing reminder for an authenticated user.
 *
 * Validates the request payload, verifies that the notification log exists,
 * confirms ownership of the reminder, and disables future notifications
 * for the associated reminder type.
 *
 * @param req - Express request containing the authenticated user and request body.
 * @param res - Express response object used to return success or error responses.
 * @returns A JSON response indicating whether the reminder was successfully disabled.
 *
 * @response 400 - Missing `notification_log_id`.
 * @response 401 - User is not authenticated.
 * @response 403 - User does not own the reminder.
 * @response 404 - Notification log not found.
 * @response 200 - Reminder successfully disabled.
 */
export async function disableReminderController(
    req: AuthRequest,
    res: Response
): Promise<Response> {
    const { notification_log_id } = req.body;

    if (!notification_log_id) {
        return res.status(400).json({ error: "notification_log_id is required" });
    }

    const logWithPlant = await getLogWithPlant(notification_log_id);
    if (!logWithPlant) {
        return res.status(404).json({ error: "Notification log not found" });
    }

    const user = await resolveUser(req, res);
    if (!user) return res as unknown as Response;

    if (logWithPlant.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await disableReminder(
        logWithPlant.user_plant_id,
        logWithPlant.reminder_type as ReminderType
    );

    return res.json({ success: true });
}


