import { getDB } from "../../core/config/db";

export type MissedNotificationFeature =
  | "watering"
  | "fertilizer"
  | "pruning"
  | "generic";

/**
 * Normalizes activity labels to missed-notification feature keys.
 *
 * @param {string} feature - Raw activity/feature label.
 * @returns {MissedNotificationFeature} Normalized feature value.
 */
export function normalizeMissedNotificationFeature(
  feature: string
): MissedNotificationFeature {
  if (feature === "fertilizing") {
    return "fertilizer";
  }

  if (
    feature === "watering" ||
    feature === "fertilizer" ||
    feature === "pruning" ||
    feature === "generic"
  ) {
    return feature;
  }

  return "generic";
}

/**
 * Records a missed notification for a user/plant/feature combination.
 *
 * If the same notification is missed again, the counter is incremented and
 * the latest miss timestamp is refreshed.
 *
 * @param {object} params - Missed notification payload.
 * @param {string} params.userId - User ID.
 * @param {string | number} params.plantId - Plant ID.
 * @param {MissedNotificationFeature} params.feature - Missed feature name.
 * @returns {Promise<void>} Resolves when the upsert completes.
 */
export async function recordMissedNotification(params: {
  userId: string;
  plantId: string | number;
  feature: MissedNotificationFeature;
}): Promise<void> {
  const pool = getDB();
  const plantId = String(params.plantId);

  await pool.query(
    `
      INSERT INTO missed_notifications (
        user_id,
        plant_id,
        notification_feature,
        missed_count,
        last_missed_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 1, NOW(), NOW(), NOW())
      ON CONFLICT (user_id, plant_id, notification_feature)
      DO UPDATE SET
        missed_count = missed_notifications.missed_count + 1,
        last_missed_at = NOW(),
        updated_at = NOW()
    `,
    [params.userId, plantId, params.feature]
  );
}

/**
 * Resolves the base application URL for public assets.
 *
 * Uses `APPPROD_URL` when running in production, otherwise `APPDEV_URL`.
 * Falls back to the available one if the preferred variable is missing.
 *
 * @returns {string} Base URL without trailing slash.
 */
function getBaseUrl(): string {
  const devBase = (process.env.APPDEV_URL ?? "").replace(/\/$/, "");
  const prodBase = (process.env.APPPROD_URL ?? "").replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    return prodBase || devBase;
  }

  return devBase || prodBase;
}

/**
 * Converts a stored local plant image path to a public URL.
 *
 * @param {string | null} localPath - Stored local image path.
 * @returns {string | null} Public image URL or null.
 */
function toImageUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const filename = localPath.split(/[\\/]/).pop();
  if (!filename) return null;

  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/plant-images/${filename}` : `/plant-images/${filename}`;
}

export interface MissedNotificationRow {
  id: string;
  user_id: string;
  plant_id: string;
  notification_feature: string;
  missed_count: number;
  last_missed_at: string;
  created_at: string;
  updated_at: string;
  common_name: string | null;
  scientific_name: string | null;
  image_url: string | null;
}

export interface MissedNotificationsResult {
  items: MissedNotificationRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Fetches the authenticated user's missed notifications with pagination.
 *
 * @param {string} userId - User ID.
 * @param {number} page - Page number.
 * @param {number} limit - Page size.
 * @returns {Promise<MissedNotificationsResult>} Paginated missed notifications.
 */
export async function getMissedNotificationsService(
  userId: string,
  page: number,
  limit: number
): Promise<MissedNotificationsResult> {
  const pool = await getDB();
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM missed_notifications
     WHERE user_id = $1`,
    [userId]
  );

  const total: number = countResult.rows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const result = await pool.query<MissedNotificationRow>(
    `SELECT
        mn.id,
        mn.user_id,
        mn.plant_id,
        mn.notification_feature,
        mn.missed_count,
        mn.last_missed_at,
        mn.created_at,
        mn.updated_at,
        p.common_name,
        p.scientific_name,
        p.local_image_path as image_url
     FROM missed_notifications mn
     LEFT JOIN plant_table_final p ON p.id::text = mn.plant_id
     WHERE mn.user_id = $1
     ORDER BY mn.last_missed_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const items = result.rows.map((row) => ({
    ...row,
    image_url: toImageUrl(row.image_url),
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

/**
 * Marks a missed notification as complete by removing it from missed tracking.
 *
 * @param {string} userId - User ID.
 * @param {string} missedNotificationId - Missed notification row ID.
 * @returns {Promise<void>} Resolves when deletion succeeds.
 */
export async function markMissedNotificationCompleteService(
  userId: string,
  missedNotificationId: string
): Promise<void> {
  const pool = await getDB();

  const result = await pool.query(
    `DELETE FROM missed_notifications
     WHERE id = $1 AND user_id = $2`,
    [missedNotificationId, userId]
  );

  if (!result.rowCount) {
    throw new Error("Missed notification not found for this user");
  }
}