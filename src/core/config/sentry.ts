import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config(); // ← add this

/**
 * Initializes Sentry error tracking for the application.
 *
 * This function:
 * - Checks if SENTRY_DSN is available in environment variables
 * - Initializes Sentry SDK with environment and sampling configuration
 * - Skips initialization if DSN is not configured
 *
 * @returns {void}
 */
const initSentry = (): void => {
  if (!process.env.SENTRY_DSN) {
    // console.log('❌ Sentry DSN not found');
    return;
  }


  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
};

/**
 * Exported Sentry SDK instance for capturing errors, messages, and traces.
 *
 * @remarks
 * Use this for manual error reporting:
 * `Sentry.captureException(error)`
 */
export { Sentry };

export default initSentry;