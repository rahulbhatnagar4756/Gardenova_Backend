import OpenAI from "openai";
import { SOIL_TYPES, SoilType } from "./soilModel";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GPT_SOIL_MODEL = process.env.GPT_SOIL_MODEL || process.env.GPT_PLANNING_MODEL || "gpt-4.1-mini";

/**
 * Maps a free-form GPT label onto one of the allowed soil types.
 *
 * @param {string} raw - Raw soil label from the model.
 * @returns {SoilType} Normalized soil type.
 */
function normalizeSoilType(raw: string): SoilType {
  const value = raw.trim().toLowerCase();

  if (SOIL_TYPES.includes(value as SoilType)) {
    return value as SoilType;
  }

  if (value.includes("salin") || value.includes("salt")) return "salt";
  if (value.includes("sand")) return "sand";
  if (value.includes("clay")) return "clay";
  if (value.includes("organic") || value.includes("loam") || value.includes("humus")) {
    return "organic";
  }

  return "organic";
}

/**
 * Classifies dominant soil type for a geographic coordinate using GPT.
 *
 * Allowed values: organic, salt, clay, sand.
 *
 * @param {number} latitude - Latitude in decimal degrees.
 * @param {number} longitude - Longitude in decimal degrees.
 * @returns {Promise<SoilType>} Classified soil type.
 */
export async function classifySoilType(
  latitude: number,
  longitude: number
): Promise<SoilType> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const completion = await openai.chat.completions.create({
    model: GPT_SOIL_MODEL,
    temperature: 0.1,
    max_tokens: 80,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a soil science assistant. Classify the dominant garden soil type at a GPS coordinate. Return JSON only.",
      },
      {
        role: "user",
        content: `Classify the dominant soil type at latitude ${latitude}, longitude ${longitude}.

Return ONLY valid JSON:
{
  "soilType": "organic" | "salt" | "clay" | "sand"
}

Rules:
- soilType must be exactly one of: organic, salt, clay, sand
- organic = humus-rich / loamy garden soil
- salt = saline / coastal salt-affected soil
- clay = heavy clay
- sand = sandy / well-draining mineral sand
- Pick the most likely dominant type for that location.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from GPT soil classifier");
  }

  const parsed = JSON.parse(content) as { soilType?: string; soil_type?: string };
  const raw = parsed.soilType ?? parsed.soil_type ?? "";
  return normalizeSoilType(raw);
}
