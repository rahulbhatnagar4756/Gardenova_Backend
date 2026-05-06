import { connectDB } from "../core/config/db";

/**
 * Creates the "survey_responses" table in PostgreSQL.
 */
export async function createSurveyResponsesTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS survey_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);
    console.error("Survey responses table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating survey_responses table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

/**
 * Creates the "survey_answers" table in PostgreSQL.
 */
export async function createSurveyAnswersTable(): Promise<void> {
  try {
    const client = await connectDB();

    const query = `
      CREATE TABLE IF NOT EXISTS survey_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        response_id UUID NOT NULL,
        question_id UUID NOT NULL,
        answer_type INTEGER NOT NULL,
        selected_option TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_response
          FOREIGN KEY (response_id) 
          REFERENCES survey_responses(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT unique_response_question
          UNIQUE(response_id, question_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_survey_answers_response_id 
        ON survey_answers(response_id);
      
      CREATE INDEX IF NOT EXISTS idx_survey_answers_question_id 
        ON survey_answers(question_id);
    `;

    await client.query(query);
    console.error("Survey answers table created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating survey_answers table:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

/**
 * Creates both survey tables in the correct order.
 */
export async function createSurveyTables(): Promise<void> {
  await createSurveyResponsesTable();
  await createSurveyAnswersTable();
}
