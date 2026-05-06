import { z } from "zod";

// Product Recommendation DTO
const productRecommendationDto = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  affiliateLink: z.string().url("Must be a valid URL").optional(),
});

// Professional Recommendation DTO
const professionalRecommendationDto = z.object({
  name: z.string().min(2, "Professional name must be at least 2 characters"),
  contact: z.string().min(5, "Contact must be valid"),
});

// Answer DTO
const answerDto = z.object({
  questionId: z.string().min(1, "QuestionId is required"),
  answerId: z.string().min(1, "AnswerId is required"),
  answerText: z.string().min(1, "Answer text is required"),
});

// Report DTO
export const createReportDto = z
  .object({
    userId: z.string().optional(), // null if guest
    answers: z.array(answerDto),
    report: z.object({
      problemAnalysis: z.string().min(5, "Problem Analysis must have details"),
      products: z.array(productRecommendationDto).optional(),
      professionals: z.array(professionalRecommendationDto).optional(),
    }),
    createdAt: z.date().default(() => new Date()),
  })
  .strict();

export type CreateReportDto = z.infer<typeof createReportDto>;
