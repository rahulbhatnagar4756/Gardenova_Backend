import { z } from "zod";

// Basic UUID validation
const uuidSchema = z.string().uuid("Invalid UUID format");

// DTO for a single survey answer
export const surveyAnswerDto = z.object({
  responseId: uuidSchema,
  questionId: uuidSchema,
  answerType: z.number().int(), // 1 or 2, but no validation logic
  selectedOption: z.string().optional(),
});

export type SurveyAnswerDto = z.infer<typeof surveyAnswerDto>;
