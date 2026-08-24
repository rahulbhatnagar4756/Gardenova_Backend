import { getDB } from "../../core/config/db";
import { ensureDiagnosisScansTable } from "./diagnosisScanLog";
import { PlantDiagnosis } from "../../interface/plants";

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
