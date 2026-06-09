import cron from 'node-cron';
import { processDueReminders, processSnoozedReminders } from './reminder.processor';

let isRunning = false;
let tickCount = 0;
/**
 * Executes a single cron tick for processing plant reminders.
 *
 * This function:
 * - Prevents overlapping executions using a locking flag (`isRunning`)
 * - Processes due reminders
 * - Processes snoozed reminders
 * - Ensures safe execution even if one tick overlaps the next
 *
 * Errors are caught and logged without stopping the cron scheduler.
 *
 * @returns {Promise<void>} Resolves when the tick processing completes
 */
async function cronTick(): Promise<void>  {
  tickCount++;
  const tick = tickCount;
  // const startedAt = new Date().toISOString();

  // console.log(`\n[Cron] ─────────── Tick #${tick} started at ${startedAt} ───────────`);

  if (isRunning) {
    // console.warn(`[Cron] ⚠️  Previous tick still running — skipping tick #${tick}`);
    return;
  }

  isRunning = true;
  // const start = Date.now();

  try {
    // console.log(`[Cron] ▶ Running due reminders check...`);
    await processDueReminders();

    // console.log(`[Cron] ▶ Running snoozed reminders check...`);
    await processSnoozedReminders();

  } catch (err) {
    console.error(`[Cron] ❌ Tick #${tick} threw an unexpected error:`, err);
  } finally {
    isRunning = false;
    // console.log(`[Cron] ✅ Tick #${tick} done in ${Date.now() - start}ms`);
    // console.log(`[Cron] ─────────────────────────────────────────────────────────\n`);
  }
}
/**
 * Starts the reminder cron job.
 *
 * The cron runs every minute (UTC timezone) and triggers `cronTick`,
 * which processes due and snoozed plant reminders.
 *
 * @returns {void}
 */
export function startReminderCron(): void {
  // console.log('[Cron] 🚀 Reminder cron started — runs every minute');
  cron.schedule('* * * * *', cronTick, { timezone: 'UTC' });
}