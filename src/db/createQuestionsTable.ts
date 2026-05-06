import { connectDB } from "../core/config/db";

/**
 * Creates the "questions" and "question_options" tables in PostgreSQL.
 */
export async function createQuestionsTable(): Promise<void> {
  try {
    const client = await connectDB();

    // Create "questions" table
    const createQuestionsQuery = `
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_text TEXT NOT NULL CHECK (LENGTH(question_text) >= 5),
        "order" INTEGER DEFAULT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create "question_options" table
    const createOptionsQuery = `
      CREATE TABLE IF NOT EXISTS question_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL CHECK (LENGTH(option_text) >= 1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create index for better query performance
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_question_options_question_id 
      ON question_options(question_id);
    `;

    // Execute queries
    await client.query(createQuestionsQuery);
    await client.query(createOptionsQuery);
    await client.query(createIndexQuery);

    console.error(
      "Questions and Question_Options tables created successfully!"
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating questions tables:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
