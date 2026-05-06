import { connectDB } from "../core/config/db";

/**
 * Creates the "logs" table in PostgreSQL (all fields flattened, no JSON).
 */
export async function createLogsTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'error', 'warn', 'debug')),
        message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
        "timestamp" TIMESTAMP NOT NULL,
        source VARCHAR(200) DEFAULT 'application',

        -- Flattened meta fields
        method VARCHAR(10) DEFAULT NULL,
        url TEXT DEFAULT NULL,
        ip VARCHAR(50) DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        role VARCHAR(100) DEFAULT NULL,
        token_exp TIMESTAMP DEFAULT NULL,
        has_auth_header BOOLEAN DEFAULT NULL,

        -- User/session info
        "userId" UUID DEFAULT NULL,
        "sessionId" VARCHAR(200) DEFAULT NULL,

        -- Timestamps
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
      );

      -- Indexes for fast queries
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs("timestamp");
      CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
      CREATE INDEX IF NOT EXISTS idx_logs_level_createdAt ON logs(level, "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_method ON logs(method);
      CREATE INDEX IF NOT EXISTS idx_logs_url ON logs(url);
      CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip);
      CREATE INDEX IF NOT EXISTS idx_logs_email ON logs(email);
    `;

    await client.query(query);
    console.error("Logs table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating logs table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
