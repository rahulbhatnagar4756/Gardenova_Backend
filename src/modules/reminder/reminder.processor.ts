import { UserPlant, ReminderType, DueReminder } from '../../interface/reminder';
import { sendReminderNotification } from './FCM.service';
import {
  getDuePlants,
  // getActiveLog,
  insertNotificationLog,
  // getTokensForUser,
  deleteInvalidTokens,
  getTokensForUsers,
  getActiveLogsForBatch,
  dbReminderTypeMap,
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
      {
        enabled: plant.watering_notification_enabled,
        nextAt: plant.next_watered_at,
        preferredTime: plant.watering_preferred_time,
        type: "water", note: plant.watering_note
      },
      {
        enabled: plant.fertilizer_notification_enabled,
        nextAt: plant.next_fertilized_at,
        preferredTime: plant.fertilizer_preferred_time,
        type: "fertilize",
        note: plant.fertilizer_note
      },
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
 * @param tokensMap
 * @returns {Promise<void>} Resolves when processing completes
 */
async function processReminder(reminder: DueReminder, tokensMap: Map<string, string[]>): Promise<void> {
  const { plant, type, scheduledFor } = reminder;

  // const tokens = await getTokensForUser(plant.user_id);
  const tokens = tokensMap.get(plant.user_id) ?? [];
  if (!tokens.length) return;

  // getActiveLog call HATA diya — insertNotificationLog khud check karta hai
  let log;
  try {
    log = await insertNotificationLog({
      userPlantId: plant.id,
      userId: plant.user_id,
      reminderType: type,
      scheduledFor,
      fcmMessageId: null,
    });
  } catch (err) {
    console.error(`[Reminder] ❌ insertNotificationLog threw:`, err);
    return;
  }

  if (!log) return; // conflict — already sent

  try {
    const result = await sendReminderNotification({
      tokens,
      reminderType: type,
      userPlantId: plant.id,
      notificationLogId: log.id,
      plantName: plant.common_name,
      note: reminder.note,
      scheduledFor,
    });

    if (result.invalidTokens.length) {
      await deleteInvalidTokens(result.invalidTokens);
    }
  } catch (err) {
    console.error(`[Reminder] ❌ FCM failed plant=${plant.id} type=${type}:`, err);
  }
}


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
    console.error('[Reminder] ❌ getDuePlants failed:', err);
    return;
  }
  if (!plants.length) return;

  const allDue = plants.flatMap((p) => getDueTypes(p, now));
  if (!allDue.length) return;

  // 1 query — sabke tokens ek saath
  const uniqueUserIds = [...new Set(allDue.map((d) => d.plant.user_id))];
  const tokensMap = await getTokensForUsers(uniqueUserIds);

  // 1 query — sabke active logs ek saath
  const activeLogs = await getActiveLogsForBatch(
    allDue.map((d) => ({
      userPlantId: d.plant.id,
      reminderType: d.type,
      scheduledFor: d.scheduledFor,
    }))
  );

  // already sent wale filter out
  const pending = allDue.filter((d) => {
    const key = `${d.plant.id}:${dbReminderTypeMap[d.type]}:${d.scheduledFor.toISOString()}`;
    return !activeLogs.has(key);
  });

  const BATCH = 10;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map((r) => processReminder(r, tokensMap))
    );
  }
}

