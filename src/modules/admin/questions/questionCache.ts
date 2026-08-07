import NodeCache from "node-cache";
import { QuestionWithOptions } from "../../../interface/question";

/** Shared questions cache so admin mutations clear what the public GET serves. */
export const questionsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
export const QUESTIONS_CACHE_KEY = "all_questions";

/**
 * Drops cached survey questions so the next GET reads DB (no redeploy).
 *
 * @returns {void}
 */
export function invalidateQuestionsCache(): void {
  questionsCache.del(QUESTIONS_CACHE_KEY);
}

/**
 * Reads cached questions if present.
 *
 * @returns {QuestionWithOptions[] | undefined} Cached list or undefined.
 */
export function getCachedQuestions(): QuestionWithOptions[] | undefined {
  return questionsCache.get<QuestionWithOptions[]>(QUESTIONS_CACHE_KEY);
}

/**
 * Stores questions in cache.
 *
 * @param {QuestionWithOptions[]} questions - Active questions with options.
 * @returns {void}
 */
export function setCachedQuestions(questions: QuestionWithOptions[]): void {
  questionsCache.set(QUESTIONS_CACHE_KEY, questions);
}
