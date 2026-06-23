import * as admin from 'firebase-admin';
import { ReminderType } from '../../interface/reminder';
import path from 'path';
import fs from 'fs';

// Initialize once
if (!admin.apps.length) {
  let serviceAccount: admin.ServiceAccount;

  // Option 1: JSON file path (recommended for local dev)
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  // Option 2: Inline JSON string (recommended for production)
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[FCM] Service account file not found at: ${resolved}`);
    }
    serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } else if (rawJson) {
    try {
      serviceAccount = JSON.parse(rawJson);
    } catch {
      throw new Error('[FCM] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  } else {
    throw new Error('[FCM] Set either GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in .env');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // console.log('[FCM] Firebase initialized successfully');
}

const messaging = admin.messaging();

// ─── Titles & Bodies ────────────────────────────────────────────────────────

const REMINDER_COPY: Record<ReminderType, { title: string; defaultBody: string }> = {
    water:     { title: "💧 Time to Water!",   defaultBody: "Your plant is thirsty — give it some love." },
    fertilize: { title: "🌱 Fertilizer Time!", defaultBody: "Boost your plant with some nutrients today." },
    prune:     { title: "✂️ Time to Prune!",   defaultBody: "Keep your plant healthy with a trim." },
    generic:   { title: "🌿 Plant Care Time!", defaultBody: "Your plant needs some attention today." },
};

// ─── Send to multiple tokens ─────────────────────────────────────────────────

export interface SendReminderPayload {
    tokens:            string[];
    reminderType:      ReminderType;
    userPlantId:       string;
    notificationLogId: string;
    plantName?:        string;
    note?:             string | null;   // ← added
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  messageId: string | null;
  invalidTokens: string[];
}
/**
 * Sends a plant-care reminder notification to one or more devices using Firebase Cloud Messaging (FCM).
 *
 * Builds a multicast notification message based on the reminder type,
 * sends it to all provided device tokens, and collects any invalid tokens
 * that should be removed from storage.
 *
 * @param {SendReminderPayload} payload - Notification details including
 * recipient tokens, plant information, reminder type, and notification metadata.
 *
 * @returns {Promise<SendResult>} A summary of the send operation containing:
 * - successCount: Number of successfully delivered messages.
 * - failureCount: Number of failed deliveries.
 * - messageId: The first successful FCM message ID, if available.
 * - invalidTokens: Tokens that are invalid or no longer registered.
 *
 * @throws {FirebaseError} Propagates any unexpected Firebase Messaging errors.
 */
export async function sendReminderNotification(
  payload: SendReminderPayload
): Promise<SendResult> {
  const { tokens, reminderType, userPlantId, notificationLogId, plantName,note } = payload;

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, messageId: null, invalidTokens: [] };
  }

  const copy = REMINDER_COPY[reminderType];
  const body = note
    ? `${note} — ${plantName ?? "your plant"}`
    : plantName
        ? `${plantName}: ${copy.defaultBody}`
        : copy.defaultBody;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: copy.title, body },
    data: {
        notification_log_id: notificationLogId,
        user_plant_id:       userPlantId,
        reminder_type:       reminderType,
        action:              "plant_reminder",
    },
    android: {
      priority: 'high',
      notification: {
        channelId:   'plant_reminders',
        clickAction: 'OPEN_PLANT_DETAIL',
        sound:       'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound:    'default',
          category: 'PLANT_REMINDER',
          badge:    1,
        },
      },
    },
  };

  const response = await messaging.sendEachForMulticast(message);

  const invalidTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[idx]!);
      }
      console.error(`FCM error for token[${idx}]:`, code, resp.error?.message);
    }
  });

  const firstSuccess = response.responses.find((r) => r.success);

  return {
    successCount:  response.successCount,
    failureCount:  response.failureCount,
    messageId:     firstSuccess?.messageId ?? null,
    invalidTokens,
  };
}