import { ZodError } from "zod";
import { createRuleDto, CreateRuleDto } from "../../../dto/ruleDto";
import { getDB } from "../../../core/config/db"; // your existing DB helper
import NodeCache from "node-cache";
import { IRule } from "../../../interface/rules";

export const appCache = new NodeCache({
  stdTTL: 300, // cache for 5 minutes (adjust as needed)
  checkperiod: 120,
});

const CACHE_KEY = "all_rules";

/**
 * Create a new Rule with validation and insert it into PostgreSQL.
 * @param data - The input rule data.
 * @returns The newly created rule object.
 */
export async function createValidatedRule(data: unknown): Promise<IRule> {
  const client = await getDB();

  try {
    // ✅ Validate input using Zod
    const parsedData: CreateRuleDto = createRuleDto.parse(data);

    // 1️⃣ Insert main rule
    const ruleResult = await client.query<IRule>(
      `
      INSERT INTO rules (name)
      VALUES ($1)
      RETURNING *;
      `,
      [parsedData.name]
    );

    const rule = ruleResult.rows[0];

    // 2️⃣ Insert related conditions
    for (const c of parsedData.conditions) {
      await client.query(
        `
        INSERT INTO rule_conditions (rule_id, question_id, operator, values)
        VALUES ($1, $2, $3, $4);
        `,
        [rule?.id, c.questionId, c.operator, c.value]
      );
    }
    appCache.del(CACHE_KEY);

    // ✅ Return combined object
    return {
      ...rule,
      conditions: parsedData.conditions,
    };
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw err;
  }
}

/**
 * Update a Rule by ID with validation.
 * @param ruleId - The rule ID.
 * @param data - Updated rule data.
 * @returns The updated rule or null if not found.
 */
export async function updateValidatedRule(
  ruleId: string,
  data: unknown
): Promise<IRule | null> {
  const client = await getDB();

  try {
    const parsedData: CreateRuleDto = createRuleDto.parse(data);

    // 1️⃣ Update main rule
    const updateRule = await client.query<IRule>(
      `
      UPDATE rules
      SET name = $1,
          updated_at = $2
      WHERE id = $3
      RETURNING *;
      `,
      [parsedData.name, parsedData.updatedAt, ruleId]
    );

    if (updateRule.rowCount === 0) return null;
    const rule = updateRule.rows[0];

    // 2️⃣ Delete old conditions
    await client.query(`DELETE FROM rule_conditions WHERE rule_id = $1;`, [
      ruleId,
    ]);

    // 3️⃣ Insert new conditions
    for (const c of parsedData.conditions) {
      await client.query(
        `
        INSERT INTO rule_conditions (rule_id, question_id, operator, values)
        VALUES ($1, $2, $3, $4);
        `,
        [rule?.id, c.questionId, c.operator, c.value]
      );
    }
    appCache.del(CACHE_KEY);

    return {
      ...rule,
      conditions: parsedData.conditions,
    };
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw err;
  }
}

/**
 * Get all Rules (with their conditions).
 * @returns An array of all active rules.
 */
export async function getAllRules(): Promise<IRule[]> {
  // 1. Check Cache
  const cachedRules = appCache.get<IRule[]>(CACHE_KEY);
  if (cachedRules) {
    return cachedRules;
  }

  const client = await getDB();

  // Fetch rules + conditions + question text in ONE QUERY
  const result = await client.query(`
    SELECT 
      r.id AS rule_id,
      r.name AS rule_name,
      rc.question_id AS question_id,
      q.question_text AS question_text,
      rc.operator,
      rc.values
    FROM rules r
    LEFT JOIN rule_conditions rc ON rc.rule_id = r.id
    LEFT JOIN questions q ON q.id = rc.question_id
    WHERE r.is_deleted = false
    ORDER BY r.created_at DESC;
  `);

  const ruleMap: Record<string, IRule> = {};

  for (const row of result.rows) {
    if (!ruleMap[row.rule_id]) {
      ruleMap[row.rule_id] = {
        id: row.rule_id,
        name: row.rule_name,
        conditions: [],
      };
    }

    if (row.question_id) {
      ruleMap[row.rule_id]?.conditions.push({
        questionId: row.question_id,
        questionText: row.question_text, // added text
        operator: row.operator,
        value: row.values,
      });
    }
  }

  const rules = Object.values(ruleMap);

  // 3. Cache
  appCache.set(CACHE_KEY, rules);

  return rules;
}

/**
 * Delete a Rule by ID (soft delete).
 * @param ruleId - The ID of the rule to delete.
 * @returns True if successfully deleted, otherwise false.
 */
export async function deleteRule(ruleId: string): Promise<boolean> {
  const client = await getDB();

  const result = await client.query(
    `UPDATE rules SET is_deleted = true WHERE id = $1;`,
    [ruleId]
  );

  appCache.del(CACHE_KEY);

  return result.rowCount! > 0;
}
