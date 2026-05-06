import { z } from "zod";

// Base question DTO (without options)
export const createQuestionDto = z.object({
  question_text: z
    .string()
    .min(5, "Question text must be at least 5 characters"),
  order: z.number().nullable().optional(),
  is_deleted: z.boolean().optional().default(false),
});

export type CreateQuestionDto = z.infer<typeof createQuestionDto>;

// Question with options DTO (for creating/updating question with options together)
export const createQuestionWithOptionsDto = z.object({
  question_text: z
    .string()
    .min(5, "Question text must be at least 5 characters"),
  order: z.number().nullable().optional(),
  is_deleted: z.boolean().optional().default(false),
  options: z
    .array(
      z.object({
        option_text: z
          .string()
          .min(1, "Option text must be at least 1 character"),
      })
    )
    .min(2, "At least 2 options are required")
    .optional()
    .default([]),
});

export type CreateQuestionWithOptionsDto = z.infer<
  typeof createQuestionWithOptionsDto
>;

// Update question with options DTO (all fields optional)
export const updateQuestionWithOptionsDto =
  createQuestionWithOptionsDto.partial();

export type UpdateQuestionWithOptionsDto = z.infer<
  typeof updateQuestionWithOptionsDto
>;
