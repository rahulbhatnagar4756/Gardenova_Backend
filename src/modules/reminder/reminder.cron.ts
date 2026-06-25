import cron from 'node-cron';
import { processDueReminders } from './reminder.processor';
import logger from '../../core/config/logger';

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
async function cronTick(): Promise<void> {
    tickCount++;
    const tick = tickCount;

    logger.debug(`[Cron] Tick #${tick} fired at ${new Date().toISOString()}`);

    if (isRunning) {
        logger.warn(`[Cron] Skipping tick #${tick} — previous still running`);
        return;
    }

    isRunning = true;

    try {
        await processDueReminders();
    } catch (err) {
        logger.error(`[Cron] Tick #${tick} unexpected error`, { err });
    } finally {
        isRunning = false;
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
    cron.schedule("* * * * *", cronTick, { timezone: "UTC" });
    logger.info('[Cron] Reminder cron started — runs every minute');
}