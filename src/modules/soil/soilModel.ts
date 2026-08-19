import { getDB } from "../../core/config/db";

export const SOIL_TYPES = ["organic", "salt", "clay", "sand"] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export interface UserCoordinates {
  user_id: string;
  latitude: number;
  longitude: number;
  soil_type: SoilType | null;
  updated_at: Date;
}

let tableReady: Promise<void> | null = null;

/**
 * Ensures `user_coordinates` exists (idempotent).
 *
 * @returns {Promise<void>} Resolves when the table is ready.
 */
export async function ensureUserCoordinatesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async (): Promise<void> => {
      const db = getDB();
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_coordinates (
          user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          latitude    DOUBLE PRECISION NOT NULL,
          longitude   DOUBLE PRECISION NOT NULL,
          soil_type   VARCHAR(20),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_user_coordinates_updated_at
          ON user_coordinates (updated_at DESC);
      `);
    })().catch((err: unknown) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

/**
 * Returns the last saved coordinates for a user.
 *
 * @param {string} userId - Authenticated user id.
 * @returns {Promise<UserCoordinates | null>} Last saved row or null.
 */
export async function findCoordinatesByUserId(
  userId: string
): Promise<UserCoordinates | null> {
  await ensureUserCoordinatesTable();
  const db = getDB();
  const { rows } = await db.query<UserCoordinates>(
    `SELECT user_id, latitude, longitude, soil_type, updated_at
     FROM user_coordinates
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * Upserts the user's last known coordinates and optional soil type.
 *
 * @param {object} input - Coordinates payload.
 * @param {string} input.userId - Authenticated user id.
 * @param {number} input.latitude - Latitude to save.
 * @param {number} input.longitude - Longitude to save.
 * @param {SoilType} input.soilType - Classified soil type.
 * @returns {Promise<UserCoordinates>} Saved row.
 */
export async function saveUserCoordinates(input: {
  userId: string;
  latitude: number;
  longitude: number;
  soilType: SoilType;
}): Promise<UserCoordinates> {
  await ensureUserCoordinatesTable();
  const db = getDB();
  const { rows } = await db.query<UserCoordinates>(
    `INSERT INTO user_coordinates (user_id, latitude, longitude, soil_type, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       soil_type = EXCLUDED.soil_type,
       updated_at = now()
     RETURNING user_id, latitude, longitude, soil_type, updated_at`,
    [input.userId, input.latitude, input.longitude, input.soilType]
  );
  return rows[0]!;
}
