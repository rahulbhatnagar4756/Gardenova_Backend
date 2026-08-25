import { getDB } from "../../core/config/db";
import { HealthIssue, PlantDiagnosis } from "../../interface/plants";
import { identifyPlantService } from "./plantRepository";
import {
  ensureDiagnosisScansTable,
  extractPredictedDisease,
  logDiagnosisScan,
} from "./diagnosisScanLog";

export interface UserPlantScanListItem {
  id: string;
  imageUrl: string;
  plantName: string | null;
  kingdom: string | null;
  family: string | null;
  predictedDisease: string;
  confidenceScore: number;
  isPlant: boolean | null;
  isHealthy: boolean | null;
  createdAt: Date;
}

export interface UserPlantScanDetail extends UserPlantScanListItem {
  diagnosis: PlantDiagnosis | null;
}

export interface PlantScanCompareIssue {
  name: string;
  type: string;
  causes: string[];
  severity: string;
  symptoms: string[];
  treatment: {
    longTerm: string[];
    immediate: string[];
    prevention: string[];
  };
  description: string;
  probability: number;
  similarImages: string[];
}

export interface PlantScanCompareItem {
  scanId: string | null;
  imageUrl: string;
  plantName: string;
  kingdom: string;
  family: string;
  predictedDisease: string;
  confidenceScore: number;
  commonNames: string[];
  confidence: number;
  healthStatus: {
    issues: PlantScanCompareIssue[];
  };
}

/**
 * Reads kingdom/family from a stored diagnosis taxonomy object.
 *
 * @param diagnosis - Stored diagnose payload
 * @returns Taxonomy labels
 */
function extractTaxonomy(diagnosis: PlantDiagnosis | null | undefined): {
  kingdom: string | null;
  family: string | null;
} {
  const taxonomy = diagnosis?.plantInfo?.taxonomy ?? {};
  const kingdom =
    taxonomy.kingdom || taxonomy.Kingdom || taxonomy.class_kingdom || null;
  const family = taxonomy.family || taxonomy.Family || null;
  return {
    kingdom: kingdom ? String(kingdom) : null,
    family: family ? String(family) : null,
  };
}

/**
 * Lists the authenticated user's saved plant scans, newest first.
 *
 * @param userId - Authenticated user id
 * @param page - Page number (1-based)
 * @param limit - Page size
 * @returns Paginated scan cards for the list screen
 */
export async function listUserPlantScans(
  userId: string,
  page: number,
  limit: number
): Promise<{
  scans: UserPlantScanListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}> {
  await ensureDiagnosisScansTable();
  const db = getDB();
  const offset = (page - 1) * limit;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM diagnosis_scans
      WHERE user_id = $1
        AND is_plant = true`,
    [userId]
  );
  const totalCount = Number(countResult.rows[0]?.count ?? 0);

  const { rows } = await db.query<{
    id: string;
    image_url: string;
    plant_name: string | null;
    predicted_disease: string;
    confidence_score: number;
    is_plant: boolean | null;
    is_healthy: boolean | null;
    raw_result: PlantDiagnosis | null;
    created_at: Date;
  }>(
    `SELECT
        id,
        image_url,
        plant_name,
        predicted_disease,
        confidence_score,
        is_plant,
        is_healthy,
        raw_result,
        created_at
       FROM diagnosis_scans
      WHERE user_id = $1
        AND is_plant = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    scans: rows.map((row) => {
      const taxonomy = extractTaxonomy(row.raw_result);
      return {
        id: row.id,
        imageUrl: row.image_url,
        plantName: row.plant_name,
        kingdom: taxonomy.kingdom,
        family: taxonomy.family,
        predictedDisease: row.predicted_disease,
        confidenceScore: Number(row.confidence_score ?? 0),
        isPlant: row.is_plant,
        isHealthy: row.is_healthy,
        createdAt: row.created_at,
      };
    }),
    pagination: {
      currentPage: page,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      totalCount,
      limit,
    },
  };
}

/**
 * Loads one saved scan for the authenticated user, including full diagnosis details.
 *
 * @param userId - Authenticated user id
 * @param scanId - Scan UUID
 * @returns Scan detail or null when not found / not owned by the user
 */
export async function getUserPlantScanById(
  userId: string,
  scanId: string
): Promise<UserPlantScanDetail | null> {
  await ensureDiagnosisScansTable();
  const db = getDB();
  const { rows } = await db.query<{
    id: string;
    image_url: string;
    plant_name: string | null;
    predicted_disease: string;
    confidence_score: number;
    is_plant: boolean | null;
    is_healthy: boolean | null;
    raw_result: PlantDiagnosis | null;
    created_at: Date;
  }>(
    `SELECT
        id,
        image_url,
        plant_name,
        predicted_disease,
        confidence_score,
        is_plant,
        is_healthy,
        raw_result,
        created_at
       FROM diagnosis_scans
      WHERE id = $1
        AND user_id = $2
        AND is_plant = true
      LIMIT 1`,
    [scanId, userId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const taxonomy = extractTaxonomy(row.raw_result);

  return {
    id: row.id,
    imageUrl: row.image_url,
    plantName: row.plant_name,
    kingdom: taxonomy.kingdom,
    family: taxonomy.family,
    predictedDisease: row.predicted_disease,
    confidenceScore: Number(row.confidence_score ?? 0),
    isPlant: row.is_plant,
    isHealthy: row.is_healthy,
    createdAt: row.created_at,
    diagnosis: row.raw_result ?? null,
  };
}

/**
 * Maps a health issue into the compare-card shape.
 *
 * @param issue - Stored or freshly diagnosed issue
 * @returns Compare issue object
 */
function toCompareIssue(issue: HealthIssue): PlantScanCompareIssue {
  return {
    name: issue.name,
    type: issue.type,
    causes: issue.causes ?? [],
    severity: issue.severity,
    symptoms: issue.symptoms ?? [],
    treatment: {
      longTerm: issue.treatment?.longTerm ?? [],
      immediate: issue.treatment?.immediate ?? [],
      prevention: issue.treatment?.prevention ?? [],
    },
    description: issue.description || "No description available",
    probability: Number(issue.probability ?? 0),
    similarImages: issue.similarImages ?? [],
  };
}

/**
 * Builds one compare card from a saved (or just-created) scan.
 *
 * @param scan - Scan row plus diagnosis
 * @param scan.id - Scan UUID
 * @param scan.imageUrl - Public scan image URL
 * @param scan.plantName - Display plant name
 * @param scan.diagnosis - Full diagnosis payload
 * @returns Compare response object
 */
function toCompareItem(scan: {
  id: string | null;
  imageUrl: string;
  plantName: string | null;
  diagnosis: PlantDiagnosis | null;
}): PlantScanCompareItem {
  const diagnosis = scan.diagnosis;
  const taxonomy = extractTaxonomy(diagnosis);
  const predicted = diagnosis
    ? extractPredictedDisease(diagnosis)
    : { predictedDisease: "Unknown", confidenceScore: 0 };
  const plantInfo = diagnosis?.plantInfo ?? null;

  return {
    scanId: scan.id,
    imageUrl: scan.imageUrl,
    plantName:
      scan.plantName ||
      plantInfo?.commonNames?.[0] ||
      plantInfo?.scientificName ||
      "",
    kingdom: taxonomy.kingdom ?? "",
    family: taxonomy.family ?? "",
    predictedDisease: predicted.predictedDisease,
    confidenceScore: predicted.confidenceScore,
    commonNames: plantInfo?.commonNames ?? [],
    confidence: Number(diagnosis?.confidence ?? predicted.confidenceScore),
    healthStatus: {
      issues: (diagnosis?.healthStatus?.issues ?? []).map(toCompareIssue),
    },
  };
}

/**
 * Loads a user's scan by id without requiring is_plant = true.
 *
 * @param userId - Authenticated user id
 * @param scanId - Scan UUID
 * @returns Scan detail or null
 */
async function getUserScanRow(
  userId: string,
  scanId: string
): Promise<UserPlantScanDetail | null> {
  await ensureDiagnosisScansTable();
  const db = getDB();
  const { rows } = await db.query<{
    id: string;
    image_url: string;
    plant_name: string | null;
    predicted_disease: string;
    confidence_score: number;
    is_plant: boolean | null;
    is_healthy: boolean | null;
    raw_result: PlantDiagnosis | null;
    created_at: Date;
  }>(
    `SELECT
        id,
        image_url,
        plant_name,
        predicted_disease,
        confidence_score,
        is_plant,
        is_healthy,
        raw_result,
        created_at
       FROM diagnosis_scans
      WHERE id = $1
        AND user_id = $2
      LIMIT 1`,
    [scanId, userId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const taxonomy = extractTaxonomy(row.raw_result);
  return {
    id: row.id,
    imageUrl: row.image_url,
    plantName: row.plant_name,
    kingdom: taxonomy.kingdom,
    family: taxonomy.family,
    predictedDisease: row.predicted_disease,
    confidenceScore: Number(row.confidence_score ?? 0),
    isPlant: row.is_plant,
    isHealthy: row.is_healthy,
    createdAt: row.created_at,
    diagnosis: row.raw_result ?? null,
  };
}

/**
 * Scans a new plant image, saves it to history, and compares it with an existing scan.
 *
 * @param input - Compare payload
 * @param input.userId - Authenticated user id
 * @param input.historyScanId - Existing plant-scan id from the details page
 * @param input.imageBase64 - New plant photo as base64 or data URI
 * @param input.latitude - Optional GPS latitude
 * @param input.longitude - Optional GPS longitude
 * @returns Two compare cards: [history, new], or null if the history scan is missing
 */
export async function compareUserPlantScan(input: {
  userId: string;
  historyScanId: string;
  imageBase64: string;
  latitude?: number;
  longitude?: number;
}): Promise<PlantScanCompareItem[] | null> {
  const history = await getUserPlantScanById(input.userId, input.historyScanId);
  if (!history) {
    return null;
  }

  const diagnosis = await identifyPlantService({
    images: [input.imageBase64],
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    similar_images: true,
  });

  const logPayload: {
    userId: string;
    diagnosis: PlantDiagnosis;
    image?: string;
    latitude?: number;
    longitude?: number;
  } = {
    userId: input.userId,
    diagnosis,
    image: input.imageBase64,
  };
  if (input.latitude !== undefined) logPayload.latitude = input.latitude;
  if (input.longitude !== undefined) logPayload.longitude = input.longitude;

  const newScanId = await logDiagnosisScan(logPayload);
  const savedNewScan = newScanId
    ? await getUserScanRow(input.userId, newScanId)
    : null;

  const historyCard = toCompareItem({
    id: history.id,
    imageUrl: history.imageUrl,
    plantName: history.plantName,
    diagnosis: history.diagnosis,
  });

  const newCard = toCompareItem({
    id: savedNewScan?.id ?? newScanId,
    imageUrl: savedNewScan?.imageUrl ?? "",
    plantName: savedNewScan?.plantName ?? diagnosis.plantInfo?.commonNames?.[0] ?? null,
    diagnosis,
  });

  return [historyCard, newCard];
}
