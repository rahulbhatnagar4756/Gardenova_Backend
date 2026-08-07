import { connectDB } from "../core/config/db";

/**
 * Creates the diagnosis_scans table used to log plant disease scan requests.
 *
 * @returns {Promise<void>} Resolves when the table exists.
 */
export async function createDiagnosisScansTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS diagnosis_scans (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
        image_url          TEXT NOT NULL,
        predicted_disease  TEXT NOT NULL,
        confidence_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
        plant_name         TEXT,
        is_plant           BOOLEAN,
        is_healthy         BOOLEAN,
        raw_result         JSONB,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_diagnosis_scans_created_at
        ON diagnosis_scans (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_diagnosis_scans_user_id
        ON diagnosis_scans (user_id);
      CREATE INDEX IF NOT EXISTS idx_diagnosis_scans_disease
        ON diagnosis_scans (predicted_disease);
    `);
    console.error("diagnosis_scans table ready");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating diagnosis_scans table:", error.message);
    } else {
      console.error("Unknown error creating diagnosis_scans table:", error);
    }
  }
}

if (require.main === module) {
  void createDiagnosisScansTable().then(() => process.exit(0));
}
