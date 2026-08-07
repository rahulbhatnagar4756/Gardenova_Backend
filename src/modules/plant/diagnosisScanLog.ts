import fs from "fs/promises";
import path from "path";
import { getDB } from "../../core/config/db";
import { PlantDiagnosis } from "../../interface/plants";

const SCAN_DIR = path.join(process.cwd(), "scan_images");
const APP_URL = (process.env.APPDEV_URL || "http://localhost:8080").replace(
  /\/$/,
  ""
);

let tableReady: Promise<void> | null = null;

/**
 * Ensures diagnosis_scans exists (idempotent).
 *
 * @returns {Promise<void>} Resolves when the table is ready.
 */
export async function ensureDiagnosisScansTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async (): Promise<void> => {
      const db = getDB();
      await db.query(`
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
    })().catch((err: unknown) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

/**
 * Persists the first scan image locally (or keeps remote URL) and returns a public path/URL.
 *
 * @param {string | undefined} image - Base64 data URI, raw base64, or http(s) URL.
 * @returns {Promise<string>} Public image URL or path.
 */
export async function persistScanImage(
  image: string | undefined
): Promise<string> {
  if (!image?.trim()) {
    return `${APP_URL}/scan_images/missing.png`;
  }

  const trimmed = image.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  await fs.mkdir(SCAN_DIR, { recursive: true });

  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mime = match?.[1] ?? "image/jpeg";
  const b64 = match?.[2] ?? trimmed.replace(/^data:image\/\w+;base64,/, "");
  const ext =
    mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : "jpg";

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  await fs.writeFile(path.join(SCAN_DIR, filename), Buffer.from(b64, "base64"));
  return `${APP_URL}/scan_images/${filename}`;
}

/**
 * Picks the predicted disease label and confidence from a diagnosis result.
 *
 * @param {PlantDiagnosis} diagnosis - Structured Plant.ID diagnosis.
 * @returns {{ predictedDisease: string; confidenceScore: number }} Top prediction.
 */
export function extractPredictedDisease(diagnosis: PlantDiagnosis): {
  predictedDisease: string;
  confidenceScore: number;
} {
  if (!diagnosis.isPlant) {
    return {
      predictedDisease: "Not a plant",
      confidenceScore: Number(diagnosis.confidence ?? 0),
    };
  }

  const topIssue = [...(diagnosis.healthStatus?.issues ?? [])].sort(
    (a, b) => b.probability - a.probability
  )[0];

  if (topIssue) {
    return {
      predictedDisease: topIssue.name,
      confidenceScore: Number(topIssue.probability ?? 0),
    };
  }

  if (diagnosis.healthStatus?.isHealthy) {
    return {
      predictedDisease: "Healthy",
      confidenceScore: Number(
        diagnosis.healthStatus.healthProbability ?? diagnosis.confidence ?? 0
      ),
    };
  }

  return {
    predictedDisease: "Unknown",
    confidenceScore: Number(diagnosis.confidence ?? 0),
  };
}

/**
 * Writes one diagnosis scan log row for the admin portal.
 *
 * @param {object} input - Log payload.
 * @param {string} input.userId - Authenticated user id.
 * @param {string | undefined} input.image - First request image (base64/URL).
 * @param {PlantDiagnosis} input.diagnosis - Diagnose API result.
 * @returns {Promise<void>} Resolves when the row is stored (best-effort).
 */
export async function logDiagnosisScan(input: {
  userId: string;
  image?: string;
  diagnosis: PlantDiagnosis;
}): Promise<void> {
  try {
    await ensureDiagnosisScansTable();
    const imageUrl = await persistScanImage(input.image);
    const { predictedDisease, confidenceScore } = extractPredictedDisease(
      input.diagnosis
    );
    const plantName =
      input.diagnosis.plantInfo?.scientificName ||
      input.diagnosis.plantInfo?.commonNames?.[0] ||
      null;

    const db = getDB();
    await db.query(
      `
      INSERT INTO diagnosis_scans (
        user_id, image_url, predicted_disease, confidence_score,
        plant_name, is_plant, is_healthy, raw_result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        input.userId,
        imageUrl,
        predictedDisease,
        confidenceScore,
        plantName,
        input.diagnosis.isPlant,
        input.diagnosis.healthStatus?.isHealthy ?? null,
        JSON.stringify({
          confidence: input.diagnosis.confidence,
          plantInfo: input.diagnosis.plantInfo
            ? {
                scientificName: input.diagnosis.plantInfo.scientificName,
                commonNames: input.diagnosis.plantInfo.commonNames,
                probability: input.diagnosis.plantInfo.probability,
              }
            : null,
          healthStatus: {
            isHealthy: input.diagnosis.healthStatus?.isHealthy,
            healthProbability: input.diagnosis.healthStatus?.healthProbability,
            issues: (input.diagnosis.healthStatus?.issues ?? []).map((i) => ({
              name: i.name,
              type: i.type,
              probability: i.probability,
              severity: i.severity,
            })),
          },
        }),
      ]
    );
  } catch (err) {
    console.error(
      "[diagnosisScanLog] failed to persist scan",
      err instanceof Error ? err.message : err
    );
  }
}
