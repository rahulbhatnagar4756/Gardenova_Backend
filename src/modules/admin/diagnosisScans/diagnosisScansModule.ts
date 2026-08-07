import { getDB } from "../../../core/config/db";
import { ensureDiagnosisScansTable } from "../../plant/diagnosisScanLog";

export interface DiagnosisScanListFilters {
  search?: string;
  disease?: string;
  userId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface DiagnosisScanListItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  image_url: string;
  predicted_disease: string;
  confidence_score: number;
  plant_name: string | null;
  is_plant: boolean | null;
  is_healthy: boolean | null;
  created_at: Date;
}

/**
 * Lists diagnosis scan logs for the admin portal.
 *
 * @param {DiagnosisScanListFilters} filters - Pagination and filter options.
 * @returns {Promise<{ scans: DiagnosisScanListItem[]; total: number }>} Page of scans.
 */
export async function findDiagnosisScans(
  filters: DiagnosisScanListFilters
): Promise<{ scans: DiagnosisScanListItem[]; total: number }> {
  await ensureDiagnosisScansTable();
  const db = getDB();
  const values: unknown[] = [];
  const where: string[] = [];

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim().toLowerCase()}%`);
    const i = values.length;
    where.push(
      `(LOWER(ds.predicted_disease) LIKE $${i}
        OR LOWER(COALESCE(ds.plant_name, '')) LIKE $${i}
        OR LOWER(COALESCE(u.email, '')) LIKE $${i}
        OR LOWER(COALESCE(u.name, '')) LIKE $${i})`
    );
  }

  if (filters.disease?.trim()) {
    values.push(`%${filters.disease.trim().toLowerCase()}%`);
    where.push(`LOWER(ds.predicted_disease) LIKE $${values.length}`);
  }

  if (filters.userId?.trim()) {
    values.push(filters.userId.trim());
    where.push(`ds.user_id = $${values.length}::uuid`);
  }

  if (filters.from) {
    values.push(filters.from);
    where.push(`ds.created_at >= $${values.length}::timestamptz`);
  }

  if (filters.to) {
    values.push(filters.to);
    where.push(`ds.created_at <= $${values.length}::timestamptz`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM diagnosis_scans ds
    LEFT JOIN users u ON u.id = ds.user_id
    ${whereSql}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  values.push(filters.limit);
  const limitIdx = values.length;
  values.push((filters.page - 1) * filters.limit);
  const offsetIdx = values.length;

  const { rows } = await db.query<DiagnosisScanListItem>(
    `
    SELECT
      ds.id,
      ds.user_id,
      u.name AS user_name,
      u.email AS user_email,
      ds.image_url,
      ds.predicted_disease,
      ds.confidence_score,
      ds.plant_name,
      ds.is_plant,
      ds.is_healthy,
      ds.created_at
    FROM diagnosis_scans ds
    LEFT JOIN users u ON u.id = ds.user_id
    ${whereSql}
    ORDER BY ds.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    values
  );

  return { scans: rows, total };
}

/**
 * Fetches one diagnosis scan log by id (includes compact raw_result).
 *
 * @param {string} id - Scan UUID.
 * @returns {Promise<(DiagnosisScanListItem & { raw_result: unknown }) | null>} Scan or null.
 */
export async function findDiagnosisScanById(
  id: string
): Promise<(DiagnosisScanListItem & { raw_result: unknown }) | null> {
  await ensureDiagnosisScansTable();
  const db = getDB();
  const { rows } = await db.query<
    DiagnosisScanListItem & { raw_result: unknown }
  >(
    `
    SELECT
      ds.id,
      ds.user_id,
      u.name AS user_name,
      u.email AS user_email,
      ds.image_url,
      ds.predicted_disease,
      ds.confidence_score,
      ds.plant_name,
      ds.is_plant,
      ds.is_healthy,
      ds.raw_result,
      ds.created_at
    FROM diagnosis_scans ds
    LEFT JOIN users u ON u.id = ds.user_id
    WHERE ds.id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] ?? null;
}
