import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { randomUUID } from "crypto";
import { MESSAGES } from "../../core/utils/constants";
import { uploadBufferLocal } from "../landScapeDesign/landScapeDesignRepo";
import {
  findLatestConversationId,
  findLatestGardenChatMessages,
  findAllGardenChatMessages,
  GardenChatMessage,
  insertGardenChatMessage,
} from "./gardenChatRepository";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GARDEN_CHAT_MODEL =
  process.env.GARDEN_CHAT_MODEL ||
  process.env.GPT_PLANNING_MODEL ||
  "gpt-4.1-mini";
const GARDEN_CHAT_VISION_MODEL =
  process.env.GARDEN_CHAT_VISION_MODEL ||
  process.env.GPT_VISION_MODEL ||
  GARDEN_CHAT_MODEL;
const HISTORY_LIMIT = 10;
const NOT_RELATED_REPLY = MESSAGES.GARDEN_CHAT_NOT_RELATED;
const BASE_URL = (process.env.APPDEV_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const IMAGE_ONLY_PROMPT =
  "Please analyze this plant or garden photo and help me.";

export interface GardenChatHistoryItem {
  role: "user" | "assistant";
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface GardenChatTurn {
  question: GardenChatHistoryItem;
  answer: GardenChatHistoryItem | null;
}

export interface GardenChatReplyResult {
  conversationId: string;
  isGardeningRelated: boolean;
  reply: string;
  question: GardenChatHistoryItem;
  answer: GardenChatHistoryItem;
}

/**
 * Parses a base64 image string or data URI into a buffer and mime type.
 *
 * @param imageBase64 - Raw base64 or data URI
 * @returns Image buffer and mime type
 */
function parseBase64Image(imageBase64: string): {
  buffer: Buffer;
  mime: string;
  ext: string;
} {
  const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
  const mime = matches?.[1] ?? "image/jpeg";
  const b64 = matches?.[2] ?? imageBase64;
  const buffer = Buffer.from(b64, "base64");
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpeg";
  return { buffer, mime, ext };
}

/**
 * Saves an uploaded chat image to local storage.
 *
 * @param imageBase64 - Raw base64 or data URI
 * @returns Relative upload path
 */
async function saveGardenChatImage(imageBase64: string): Promise<string> {
  const { buffer, ext } = parseBase64Image(imageBase64);
  const fileName = `${randomUUID()}.${ext}`;
  return uploadBufferLocal(buffer, fileName, "garden-chat");
}

/**
 * Builds a data URI for a stored chat image.
 *
 * @param relativePath - Path under uploads/
 * @returns Data URI for vision models
 */
async function imageUrlToDataUri(relativePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), "uploads", relativePath);
  const buffer = await fs.readFile(fullPath);
  const ext = path.extname(relativePath).slice(1).toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * Builds a public image URL for API responses.
 *
 * @param relativePath - Stored path under uploads/
 * @returns Full URL using APPDEV_URL
 */
function toPublicImageUrl(relativePath: string): string {
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }

  return `${BASE_URL}/uploads/${relativePath.replace(/^\/+/, "")}`;
}

/**
 * Maps stored messages to API history items.
 *
 * @param item - Stored message
 * @returns History list for responses
 */
function toHistoryItem(item: GardenChatMessage): GardenChatHistoryItem {
  return {
    role: item.role,
    content: item.content,
    imageUrl: item.imageUrl ? toPublicImageUrl(item.imageUrl) : null,
    createdAt: item.createdAt,
  };
}

/**
 * Groups stored messages into user question + assistant answer turns.
 *
 * @param messages - Chronological stored messages
 * @returns Question/answer pairs
 */
function toQuestionAnswerTurns(messages: GardenChatMessage[]): GardenChatTurn[] {
  const turns: GardenChatTurn[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (!current || current.role !== "user") {
      continue;
    }

    const next = messages[index + 1];
    const answer =
      next?.role === "assistant" ? toHistoryItem(next) : null;

    turns.push({
      question: toHistoryItem(current),
      answer,
    });
  }

  return turns;
}

/**
 * Turns stored messages into OpenAI chat history (last 10), including images.
 *
 * @param messages - Chronological stored messages
 * @returns LLM message list
 */
async function toLlmHistory(
  messages: GardenChatMessage[]
): Promise<ChatCompletionMessageParam[]> {
  const history: ChatCompletionMessageParam[] = [];

  for (const item of messages) {
    if (item.role === "user" && item.imageUrl) {
      const dataUri = await imageUrlToDataUri(item.imageUrl);
      history.push({
        role: "user",
        content: [
          { type: "text", text: item.content },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      });
      continue;
    }

    history.push({
      role: item.role,
      content: item.content,
    });
  }

  return history;
}

/**
 * Returns true when at least one user message includes an image.
 *
 * @param messages - Stored messages
 * @returns Whether vision model should be used
 */
function historyHasImages(messages: GardenChatMessage[]): boolean {
  return messages.some((item) => item.role === "user" && Boolean(item.imageUrl));
}

/**
 * Verifies whether the current user message is gardening related,
 * using the last 10 messages as context for follow-up questions.
 *
 * @param history - Last 10 messages including the current user message
 * @param model - Chat or vision model
 * @returns True when the topic is gardening
 */
async function isGardeningRelatedChat(
  history: ChatCompletionMessageParam[],
  model: string
): Promise<boolean> {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 60,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a classifier. Decide if the latest user message is about gardening.

Gardening includes: plants, soil, watering, fertilizer, pests, diseases, pruning, pots, indoor/outdoor gardens, lawns, landscape, compost, seeds, sunlight, humidity, and follow-up questions that clearly continue a garden conversation.
Photos of plants, gardens, leaves, pests, soil, pots, or outdoor spaces to diagnose are gardening related.

Not gardening: sports, politics, coding, finance, general chit-chat with no garden context, unrelated selfies or objects.

Use the conversation history so follow-ups like "what about watering?" stay related.

Return ONLY JSON:
{ "isGardeningRelated": true | false }`,
      },
      ...history,
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return false;

  const parsed = JSON.parse(content) as { isGardeningRelated?: boolean };
  return Boolean(parsed.isGardeningRelated);
}

/**
 * Answers a gardening question using the last 10 messages as memory.
 *
 * @param history - Last 10 messages including the current user message
 * @param model - Chat or vision model
 * @returns Assistant reply
 */
async function answerGardeningQuestion(
  history: ChatCompletionMessageParam[],
  model: string
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: `You are Gardenova, a practical gardening assistant.
Answer only gardening problems using the conversation history.
When the user shares a plant or garden photo, identify visible issues and give clear, useful steps.
Stay concise.
If a follow-up depends on earlier messages, use that context.
Do not discuss unrelated topics.`,
      },
      ...history,
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Empty response from gardening chat model");
  }
  return reply;
}

/**
 * Handles one user chat turn: verify gardening topic, then answer if allowed.
 * Always loads the last 10 messages for LLM context.
 *
 * @param input - Chat turn payload
 * @param input.userId - Authenticated user id
 * @param input.message - Optional user message text
 * @param input.imageBase64 - Optional base64 or data URI image
 * @param input.conversationId - Optional existing conversation id
 * @returns Reply, related flag, conversation id, and last-10 history
 */
export async function handleGardenChat(input: {
  userId: string;
  message?: string;
  imageBase64?: string;
  conversationId?: string;
}): Promise<GardenChatReplyResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const messageText = input.message?.trim() ?? "";
  const imageBase64 = input.imageBase64?.trim() ?? "";

  if (!messageText && !imageBase64) {
    throw new Error("Provide message, image_base64, or both");
  }

  let conversationId = input.conversationId;
  if (!conversationId) {
    conversationId = (await findLatestConversationId(input.userId)) ?? randomUUID();
  }

  const storedContent = messageText || IMAGE_ONLY_PROMPT;
  const imageUrl = imageBase64 ? await saveGardenChatImage(imageBase64) : null;

  const userMessage = await insertGardenChatMessage({
    conversationId,
    userId: input.userId,
    role: "user",
    content: storedContent,
    imageUrl,
  });

  const recent = await findLatestGardenChatMessages(
    conversationId,
    input.userId,
    HISTORY_LIMIT
  );
  const history = await toLlmHistory(recent);
  const model = historyHasImages(recent)
    ? GARDEN_CHAT_VISION_MODEL
    : GARDEN_CHAT_MODEL;

  const isGardeningRelated = await isGardeningRelatedChat(history, model);

  const reply = isGardeningRelated
    ? await answerGardeningQuestion(history, model)
    : NOT_RELATED_REPLY;

  const assistantMessage = await insertGardenChatMessage({
    conversationId,
    userId: input.userId,
    role: "assistant",
    content: reply,
    isGardening: isGardeningRelated,
  });

  return {
    conversationId,
    isGardeningRelated,
    reply,
    question: toHistoryItem(userMessage),
    answer: toHistoryItem(assistantMessage),
  };
}

export interface GardenChatHistoryPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

/**
 * Returns stored garden chat history with pagination.
 *
 * @param input - History query payload
 * @param input.userId - Authenticated user id
 * @param input.conversationId - Optional conversation id
 * @param input.page - Page number (default 1)
 * @param input.limit - Turns (question+answer pairs) per page (default 10)
 * @returns Conversation id, paginated Q&A turns, and pagination metadata
 */
export async function getGardenChatHistory(input: {
  userId: string;
  conversationId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  conversationId: string | null;
  history: GardenChatTurn[];
  pagination: GardenChatHistoryPagination;
}> {
  const page = input.page ?? 1;
  const limit = input.limit ?? HISTORY_LIMIT;

  const conversationId =
    input.conversationId ?? (await findLatestConversationId(input.userId));

  if (!conversationId) {
    return {
      conversationId: null,
      history: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalCount: 0,
        limit,
      },
    };
  }

  const messages = await findAllGardenChatMessages(conversationId, input.userId);
  const turns = toQuestionAnswerTurns(messages);
  const totalCount = turns.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  const offset = (page - 1) * limit;

  return {
    conversationId,
    history: turns.slice(offset, offset + limit),
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
    },
  };
}
