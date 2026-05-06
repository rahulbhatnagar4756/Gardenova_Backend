import cron from "node-cron";
import { blockExpiredTrialProfiles } from "../services/blockTrialsProfile";
/**
 * Registers a daily cron job to block expired trial professional profiles.
 *
 * The job runs every day at midnight (00:00).
 *
 * @returns {void}
 */
export async function registerBlockExpiredTrialsCron(): Promise<void> {
  cron.schedule("0 0 * * *", async () => {
    try {
      await blockExpiredTrialProfiles();
    } catch (error) {
      console.error("[CRON] Trial expiry job failed", error);
    }
  });
}
