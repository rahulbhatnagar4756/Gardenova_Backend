import { getDB } from "../core/config/db";

/**
 * Creates the "rules" and "rule_conditions" tables in PostgreSQL.
 */
export async function createRulesTables(): Promise<void> {
  try {
    const client = await getDB();

    // Create main "rules" table
    const rulesTableQuery = `
      CREATE TABLE IF NOT EXISTS rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        affiliate_for VARCHAR(255) DEFAULT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create "rule_conditions" table (one-to-many relationship)
    const ruleConditionsTableQuery = `
      CREATE TABLE IF NOT EXISTS rule_conditions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
        question_id UUID NOT NULL,
        operator VARCHAR(20) CHECK (operator IN ('equals', 'and', 'or')),
        values TEXT[] NOT NULL, -- array of string values
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(rulesTableQuery);
    await client.query(ruleConditionsTableQuery);

    console.error("Rules and RuleConditions tables created successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating rules tables:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}
