import { connectDB } from "../core/config/db";

/**
 * Creates the `user_push_tokens` table if it does not already exist.
 *
 * The table stores push notification tokens for users,
 * supporting multiple platforms (android, ios, web).
 *
 * Features:
 * - Unique token constraint
 * - Cascade delete when user is removed
 * - Platform validation via CHECK constraint
 *
 * @returns {Promise<void>} Resolves when the table creation process completes.
 * @throws {Error} Logs any database-related errors encountered during execution.
 */
export async function user_push_token(): Promise<void> {
    try {
        const client = await connectDB();
        const query=`CREATE TABLE user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(token)
);
`;        await client.query(query);    
        // console.log("User push token table created successfully!");

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating user push token table:", error.message);
        }
        else {
            console.error("Unknown error:", error);
        }

    }
}