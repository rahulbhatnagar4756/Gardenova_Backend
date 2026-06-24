import * as admin from 'firebase-admin';
import { ReminderType } from '../../interface/reminder';


// Initialize once
if (!admin.apps.length) {
  // console.log('PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
  // console.log('CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
  // console.log('PRIVATE_KEY starts:', process.env.FIREBASE_PRIVATE_KEY?.substring(0, 40));
  // console.log('PRIVATE_KEY ends:', process.env.FIREBASE_PRIVATE_KEY?.slice(-20));
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const messaging = admin.messaging();

// ─── Titles & Bodies ────────────────────────────────────────────────────────

const REMINDER_COPY: Record<ReminderType, { actionTitle: string }> = {
  water:     { actionTitle: "Watering Time" },
  fertilize: { actionTitle: "Fertilizer Time" },
  prune:     { actionTitle: "Pruning Time" },
  generic:   { actionTitle: "Care Time" },
};

// ─── Send to multiple tokens ─────────────────────────────────────────────────

export interface SendReminderPayload {
  tokens:            string[];
  reminderType:      ReminderType;
  userPlantId:       string;
  notificationLogId: string;
  plantName?:        string;
  note?:             string | null;
  scheduledFor?:     Date;  // ← add karo
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
  const { tokens, reminderType, userPlantId, notificationLogId, plantName, note, scheduledFor } = payload;

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, messageId: null, invalidTokens: [] };
  }

  const copy = REMINDER_COPY[reminderType];

  // Time format
  const scheduledTime = new Date(scheduledFor ?? Date.now())
    .toLocaleTimeString('en-IN', {
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
      timeZone: 'Asia/Kolkata',
    }); // "3:35 PM"

  const title = `🌿 ${plantName ?? 'Your Plant'} – ${copy.actionTitle}`;
  const body = note
  ? `Scheduled for ${scheduledTime} today\n${note}`
  : `Scheduled for ${scheduledTime} today`;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
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