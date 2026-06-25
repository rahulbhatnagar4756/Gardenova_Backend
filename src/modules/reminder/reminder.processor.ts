import logger from '../../core/config/logger';
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

  const tokens = tokensMap.get(plant.user_id) ?? [];
  if (!tokens.length) {
    logger.warn(`[Reminder] No FCM tokens for user=${plant.user_id} — skipping`);
    return;
  }

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
    logger.error(`[Reminder] insertNotificationLog failed`, { plant: plant.id, type, err });
    return;
  }

  if (!log) {
    logger.debug(`[Reminder] Already sent — skipping plant=${plant.id} type=${type}`);
    return;
  }

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

    logger.debug(`[Reminder] FCM sent plant=${plant.id} type=${type} success=${result.successCount} fail=${result.failureCount}`);

    if (result.invalidTokens.length) {
      logger.warn(`[Reminder] Removing ${result.invalidTokens.length} invalid token(s)`);
      await deleteInvalidTokens(result.invalidTokens);
    }
  } catch (err) {
    logger.error(`[Reminder] FCM failed`, { plant: plant.id, type, err });
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
    logger.error('[Reminder] getDuePlants failed', { err });
    return;
  }

  logger.debug(`[Reminder] getDuePlants returned ${plants.length} plant(s)`);
  if (!plants.length) return;

  const allDue = plants.flatMap((p) => getDueTypes(p, now));
  logger.debug(`[Reminder] allDue=${allDue.length}`);
  if (!allDue.length) return;

  const uniqueUserIds = [...new Set(allDue.map((d) => d.plant.user_id))];
  const tokensMap = await getTokensForUsers(uniqueUserIds);

  const activeLogs = await getActiveLogsForBatch(
    allDue.map((d) => ({
      userPlantId: d.plant.id,
      reminderType: d.type,
      scheduledFor: d.scheduledFor,
    }))
  );

  const pending = allDue.filter((d) => {
    const key = `${d.plant.id}:${dbReminderTypeMap[d.type]}:${d.scheduledFor.toISOString()}`;
    return !activeLogs.has(key);
  });

  logger.debug(`[Reminder] pending=${pending.length}`);
  if (!pending.length) return;

  const BATCH = 10;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.allSettled(batch.map((r) => processReminder(r, tokensMap)));
  }
}

