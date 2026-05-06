import { connectDB } from "../core/config/db";

/**
 * Creates the `user_plants` table in the database if it does not already exist.
 * 
 * The table stores the association between users and the plants they own, 
 * along with optional custom care schedules, plant health status, and images.
 *
 * @async
 * @function
 * @returns {Promise<void>} Resolves when the table creation query completes.
 * @throws {Error} If the database query fails.
 */
export async function userplantTable(): Promise<void> {
  try {
    const client = await connectDB();
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    const query = `
    CREATE TABLE IF NOT EXISTS user_plants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        user_id UUID NOT NULL,
        plant_id INTEGER NOT NULL,

        added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        -- ══════════════════════════════════════
        -- Watering Reminder
        -- ══════════════════════════════════════
        watering_reminder_frequency INTEGER DEFAULT 0,
        last_watered_at TIMESTAMPTZ,
        next_watered_at TIMESTAMPTZ,
        watering_notification_enabled BOOLEAN DEFAULT FALSE,
        watering_preferred_time TIME DEFAULT '09:00:00',

        -- ══════════════════════════════════════
        -- Fertilizer Reminder
        -- ══════════════════════════════════════
        fertilizer_reminder_frequency INTEGER DEFAULT 0,
        last_fertilized_at TIMESTAMPTZ,
        next_fertilized_at TIMESTAMPTZ,
        fertilizer_notification_enabled BOOLEAN DEFAULT FALSE,
        fertilizer_preferred_time TIME DEFAULT '09:00:00',

        -- ══════════════════════════════════════
        -- Pruning Reminder
        -- ══════════════════════════════════════
        pruning_reminder_frequency INTEGER DEFAULT 0,
        last_pruned_at TIMESTAMPTZ,
        next_pruned_at TIMESTAMPTZ,
        pruning_notification_enabled BOOLEAN DEFAULT FALSE,

        -- ══════════════════════════════════════
        -- Generic Care Reminder
        -- ══════════════════════════════════════
        generic_care_reminder_frequency INTEGER DEFAULT 0,
        last_generic_care_at TIMESTAMPTZ,
        next_generic_care_at TIMESTAMPTZ,
        generic_notification_enabled BOOLEAN DEFAULT FALSE,

        health_status VARCHAR(50) DEFAULT 'healthy',

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        -- Foreign Keys
        CONSTRAINT fk_user
            FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_plant
            FOREIGN KEY(plant_id)
            REFERENCES All_plants(id)
            ON DELETE CASCADE,

        -- Unique constraint
        CONSTRAINT unique_user_plant        
        UNIQUE (user_id, plant_id)
    );
    `;

    await client.query(query);
    console.error("User plants table created successfully!");

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating user plants table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

