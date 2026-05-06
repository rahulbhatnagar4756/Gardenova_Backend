import { z } from "zod";

// 🧩 Condition DTO (for rule_conditions table)
const conditionDto = z.object({
  questionId: z.string().uuid("Valid UUID is required for questionId"), // ✅ PostgreSQL UUID
  operator: z.enum(["equal", "and", "or"]), // ✅ removed "in" since not in table constraint
  value: z.string().min(1, "Value must be a non-empty string"), // ✅ now TEXT (not array)
});

// 🧠 Rule DTO (for rules table)
export const createRuleDto = z
  .object({
    name: z.string().min(3, "Rule name must be at least 3 characters"),
    conditions: z
      .array(conditionDto)
      .nonempty("At least one condition is required"),
    isDeleted: z.boolean().default(false),
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date()),
  })
  .strict();

export type CreateRuleDto = z.infer<typeof createRuleDto>;
