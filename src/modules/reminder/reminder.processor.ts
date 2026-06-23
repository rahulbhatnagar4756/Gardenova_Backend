import { UserPlant, ReminderType, DueReminder } from '../../interface/reminder';
import { sendReminderNotification } from './FCM.service';
import {
  getDuePlants,
  getActiveLog,
  insertNotificationLog,
  getTokensForUser,
  deleteInvalidTokens,
} from './reminder.queries';

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Checks whether the current time has reached or passed the preferred reminder time.
 *
 * If no preferred time is set, the check passes by default.
 *
 * @param preferredTime - Preferred time in `HH:MM:SS` format or null
 * @returns {boolean} True if current time is past the preferred time or no time is set
 */
function isPreferredTimeReached(preferredTime: string | null): boolean {
  if (!preferredTime) return true;
  const [h, m] = preferredTime.split(':').map(Number);
  const now = new Date();
  return now.getHours() > h! || (now.getHours() === h && now.getMinutes() >= m!);
}
/**
 * Determines which reminder types are due for a given plant at the current time.
 *
 * A reminder is considered due if:
 * - Notifications are enabled
 * - A next scheduled date exists and is in the past
 * - The preferred time condition is satisfied
 *
 * @param plant - User plant data containing reminder configuration
 * @param now - Current timestamp used for evaluation
 * @returns {DueReminder[]} List of due reminders for the plant
 */
function getDueTypes(plant: UserPlant, now: Date): DueReminder[] {
  const due: DueReminder[] = [];

  const checks: Array<{
    enabled: boolean;
    nextAt: Date | null;
    preferredTime: string | null;
    type: ReminderType;
    note: string | null;
  }> = [
      { enabled: plant.watering_notification_enabled, nextAt: plant.next_watered_at, preferredTime: plant.watering_preferred_time, type: "water", note: plant.watering_note },
      { enabled: plant.fertilizer_notification_enabled, nextAt: plant.next_fertilized_at, preferredTime: plant.fertilizer_preferred_time, type: "fertilize", note: plant.fertilizer_note },
      { enabled: plant.pruning_notification_enabled, nextAt: plant.next_pruned_at, preferredTime: plant.pruning_preferred_time, type: "prune", note: plant.pruning_note },
      { enabled: plant.generic_notification_enabled, nextAt: plant.next_generic_care_at, preferredTime: plant.generic_care_preferred_time, type: "generic", note: plant.generic_care_note },
    ];

  for (const check of checks) {
    if (
      check.enabled &&
      check.nextAt !== null &&
      check.nextAt <= now &&
      isPreferredTimeReached(check.preferredTime)
    ) {
      due.push({ plant, type: check.type, scheduledFor: check.nextAt, note: check.note });
    }
  }

  return due;
}

// ─── Process a single due reminder ──────────────────────────────────────────
/**
 * Processes a single due reminder:
 * - Ensures idempotency (prevents duplicate sends)
 * - Fetches user FCM tokens
 * - Creates a notification log entry
 * - Sends FCM push notification
 * - Cleans up invalid tokens if found
 *
 * @param reminder - The due reminder to process
 * @returns {Promise<void>} Resolves when processing completes
 */
async function processReminder(reminder: DueReminder): Promise<void> {
  const { plant, type, scheduledFor } = reminder;

  // console.log(`[Reminder]   → Processing plant=${plant.id} type=${type}`);

  // 1. Idempotency check
  const existing = await getActiveLog(plant.id, type, scheduledFor);
  if (existing) {
    // console.log(`[Reminder]   ⏭  Already active (status=${existing.status}) for plant=${plant.id} type=${type} — skipping`);
    return;
  }

  // 2. Fetch FCM tokens
  const tokens = await getTokensForUser(plant.user_id);
  if (!tokens.length) {
    // console.warn(`[Reminder]   ⚠️  No FCM tokens for user=${plant.user_id} — skipping`);
    return;
  }

  // console.log(`[Reminder]   📱 Found ${tokens.length} token(s) for user=${plant.user_id}`);

  // 3. Insert log first (prevents duplicate sends on cron overlap)
  const log = await insertNotificationLog({
    userPlantId: plant.id,
    userId: plant.user_id,
    reminderType: type,
    scheduledFor,
    fcmMessageId: null,
  });

  if (!log) {
    //console.log(`[Reminder]   ⏭  Conflict on insert for plant=${plant.id} type=${type} — another instance handled it`);
    return;
  }

  // console.log(`[Reminder]   📝 Log created id=${log.id}`);

  // 4. Send FCM
  try {
    const result = await sendReminderNotification({
    tokens,
    reminderType:      type,
    userPlantId:       plant.id,
    notificationLogId: log.id,
    plantName:         plant.common_name,
    note:              reminder.note,
});

    // console.log(
    //   `[Reminder]   ✅ FCM sent plant=${plant.id} type=${type} | success=${result.successCount} fail=${result.failureCount} messageId=${result.messageId ?? 'N/A'}`
    // );

    if (result.invalidTokens.length) {
      // console.warn(`[Reminder]   🗑  Removing ${result.invalidTokens.length} invalid/expired token(s)`);
      await deleteInvalidTokens(result.invalidTokens);
    }
  } catch (err) {
    console.error(`[Reminder]   ❌ FCM send failed for plant=${plant.id} type=${type}:`, err);
  }
}

// ─── Main: process new due reminders ────────────────────────────────────────
/**
 * Fetches all plants with due reminders and processes them in batches.
 *
 * Steps:
 * - Fetch due plants from database
 * - Determine due reminder types per plant
 * - Process reminders in batches (concurrent-safe)
 *
 * @returns {Promise<void>} Resolves when all due reminders are processed
 */
export async function processDueReminders(): Promise<void> {
  const now = new Date();

  let plants: UserPlant[];
  try {
    plants = await getDuePlants();
  } catch (err) {
    console.error('[Reminder] ❌ Failed to fetch due plants from DB:', err);
    return;
  }

  if (!plants.length) {
    // console.log('[Reminder] ✔  No due reminders found');
    return;
  }

  const allDue: DueReminder[] = plants.flatMap((p) => getDueTypes(p, now));

  // console.log(`[Reminder] 🌱 Found ${plants.length} plant(s) → ${allDue.length} reminder(s) to process`);

  const BATCH = 10;
  for (let i = 0; i < allDue.length; i += BATCH) {
    const batch = allDue.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(processReminder));
  }

  // console.log(`[Reminder] ✔  Done processing due reminders`);
}

// ─── Main: re-fire snoozed reminders ────────────────────────────────────────
/**
 * Processes snoozed reminder logs that are ready to be re-fired.
 *
 * Steps:
 * - Fetch snoozed logs due for re-processing
 * - Retrieve user FCM tokens
 * - Send push notifications again
 * - Reset snooze state or update log status
 * - Clean up invalid tokens
 *
 * @returns {Promise<void>} Resolves when all snoozed reminders are processed
 */
// export async function processSnoozedReminders(): Promise<void> {
//   let snoozed: Awaited<ReturnType<typeof getDueSnoozedLogs>>;
//   try {
//     snoozed = await getDueSnoozedLogs();
//   } catch (err) {
//     console.error('[Snooze] ❌ Failed to fetch snoozed logs from DB:', err);
//     return;
//   }

//   if (!snoozed.length) {
//     // console.log('[Snooze] ✔  No snoozed reminders due');
//     return;
//   }

//   // console.log(`[Snooze] ⏰ Found ${snoozed.length} snoozed reminder(s) to re-fire`);

//   for (const log of snoozed) {
//     // console.log(`[Snooze]   → Re-firing log=${log.id} type=${log.reminder_type} user=${log.user_id}`);
//     try {
//       const tokens = await getTokensForUser(log.user_id);

//       if (!tokens.length) {
//         // console.warn(`[Snooze]   ⚠️  No tokens for user=${log.user_id} — marking as sent anyway`);
//         await resetSnoozedLog(log.id, null);
//         continue;
//       }

//       const result = await sendReminderNotification({
//         tokens,
//         reminderType: log.reminder_type as ReminderType,
//         userPlantId: log.user_plant_id,
//         notificationLogId: log.id,
//       });

//       await resetSnoozedLog(log.id, result.messageId);

//       if (result.invalidTokens.length) {
//         // console.warn(`[Snooze]   🗑  Removing ${result.invalidTokens.length} invalid token(s)`);
//         await deleteInvalidTokens(result.invalidTokens);
//       }

//       // console.log(`[Snooze]   ✅ Re-fired log=${log.id} success=${result.successCount} fail=${result.failureCount}`);
//     } catch (err) {
//       console.error(`[Snooze]   ❌ Failed to re-fire log=${log.id}:`, err);
//     }
//   }

//   // console.log(`[Snooze] ✔  Done processing snoozed reminders`);
// }