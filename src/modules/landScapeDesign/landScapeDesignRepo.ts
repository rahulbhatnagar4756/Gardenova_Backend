import Groq from "groq-sdk";
import fs from 'fs/promises';
import path from 'path';
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';
// const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY!;
// const SAM_ENDPOINT = process.env.WAVESPEED_SAM_URL!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type SpaceCategory = 'indoor' | 'outdoor';

export type SpaceType =
  // outdoor
  | 'balcony' | 'terrace' | 'yard' | 'rooftop' | 'patio' | 'garden'
  // indoor
  | 'bedroom' | 'living_room' | 'kitchen' | 'bathroom'
  | 'dining_room' | 'office' | 'hallway' | 'basement'
  // fallback
  | 'generic_indoor' | 'generic_outdoor';

export interface DetectedSpace {
  spaceType: SpaceType;
  category: SpaceCategory;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface PlanStep {
  step: number;
  category:
  // outdoor
  | 'Hardscape' | 'Softscape' | 'Water Feature' | 'Lighting' | 'Maintenance'
  // indoor
  | 'Furniture' | 'Decor' | 'Storage' | 'Textiles' | 'Paint & Finish' | 'Tech';
  action: string;
  details: string;
  effort: 'low' | 'medium' | 'high';
  cost: 'budget' | 'moderate' | 'premium';
}

export interface DesignPlan {
  summary: string;
  style: string;
  steps: PlanStep[];
}

export interface DesignResult {
  originalUrl: string;
  gardenUrl: string;
  description: string;
  detectedSpace: DetectedSpace;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVESPEED API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

// interface WaveSpeedSubmitResponse {
//   code: number;
//   message: string;
//   data: {
//     id: string;
//     model: string;
//     outputs: string[];
//     urls: { get: string };
//     status: 'created' | 'processing' | 'completed' | 'failed';
//     error: string;
//     executionTime: number;
//   };
// }

// interface WaveSpeedPollResponse {
//   code: number;
//   message: string;
//   data: {
//     id: string;
//     outputs: string[];
//     status: 'created' | 'processing' | 'completed' | 'failed';
//     error: string;
//   };
// }

// ─────────────────────────────────────────────────────────────────────────────
// SPACE CONFIG — persona, categories, style examples per space category
// ─────────────────────────────────────────────────────────────────────────────

const SPACE_CONFIG: Record<SpaceCategory, {
  persona: string;
  validCategories: string;
  styleExamples: string;
  decorRule: string;
}> = {
  outdoor: {
    persona: 'expert landscape architect',
    validCategories: 'Hardscape | Softscape | Water Feature | Lighting | Maintenance',
    styleExamples: 'Mediterranean, Japandi, Wabi-sabi, Biophilic Urban, Moroccan Courtyard, Rustic Farmhouse, Tropical Resort, Zen Garden',
    decorRule: 'Name real plant species (Latin or common). Match species to the light condition described. Specify pot material, size, and placement.',
  },
  indoor: {
    persona: 'expert interior designer',
    validCategories: 'Furniture | Decor | Storage | Textiles | Paint & Finish | Lighting | Tech',
    styleExamples: 'Japandi, Wabi-sabi, Mid-Century Modern, Maximalist Eclectic, Dark Academia, Coastal, Industrial Loft, Scandinavian Hygge, Bohemian',
    decorRule: 'Name specific furniture pieces with real material descriptions (e.g. "oak veneer sideboard", "linen sofa"). Specify exact dimensions and placement position in the room.',
  },
};
const SAM_ENDPOINT   = process.env.WAVESPEED_SAM_URL    ?? '';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY ?? '';
 
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS  = 2_000;
const MASK_DOWNLOAD_TIMEOUT_MS = 15_000;
 
// SAM segmentation prompts — must be ≤ 32 chars (WaveSpeed hard limit)
const SEGMENTATION_PROMPTS: Record<SpaceType, string> = {
  // outdoor – focus on the ground only
  balcony:         'balcony floor',
  terrace:         'terrace ground',
  yard:            'lawn area',
  rooftop:         'rooftop floor surface',
  patio:           'patio stones',
  garden:          'garden soil',
  // indoor – floor only (no walls)
  bedroom:         'bedroom floor',
  living_room:     'living room floor',
  kitchen:         'kitchen floor',
  bathroom:        'bathroom floor',
  dining_room:     'dining room floor',
  office:          'office floor',
  hallway:         'hallway floor',
  basement:        'basement floor',
  // fallback
  generic_indoor:  'floor surface',
  generic_outdoor: 'ground surface',
};
 
// ─── Types ────────────────────────────────────────────────────────────────────
 type JobStatus =
  | 'created'
  | 'processing'
  | 'completed'
  | 'failed'; 
interface WaveSpeedSubmitResponse {
  code: number;
  message: string;
  data: {
    id: string;
    status: JobStatus;
    urls: { get: string };
    outputs?: string[];
    error?: string;
  };
}

interface WaveSpeedPollResponse {
  code: number;
  message: string;
  data: {
    status: JobStatus;
    outputs?: string[];
    error?: string;
  };
}
 
export interface SegmentationResult {
  task_id:     string;
  mask_url:    string | null;
  mask_buffer: Buffer;
  mask_base64: string;
}
/**
 * Determines whether a space type should be treated as
 * an indoor or outdoor area.
 *
 * Outdoor spaces include balconies, terraces, patios,
 * gardens, rooftops, yards, and generic outdoor areas.
 * All other space types are classified as indoor.
 *
 * @param spaceType - The detected or selected space type.
 *
 * @returns
 * - `'outdoor'` if the space belongs to an outdoor category.
 * - `'indoor'` otherwise.
 */
function getSpaceCategory(spaceType: SpaceType): 'indoor' | 'outdoor' {
  const outdoorTypes: SpaceType[] = [
    'balcony', 'terrace', 'yard', 'rooftop',
    'patio', 'garden', 'generic_outdoor',
  ];
  return outdoorTypes.includes(spaceType) ? 'outdoor' : 'indoor';
}
 /**
 * Calculates the percentage of pixels whose intensity
 * is greater than the provided threshold.
 *
 * Useful for estimating mask coverage or determining
 * how much of an image is considered "white" or active.
 *
 * The function iterates through raw grayscale pixel data
 * and counts pixels brighter than the threshold value.
 *
 * @param pixelData - Raw pixel buffer containing grayscale values (0–255).
 * @param threshold - Brightness threshold used to classify a pixel as white.
 * Defaults to `200`.
 *
 * @returns Percentage of pixels above the threshold (0–100).
 */
function calcWhitePercent(
  pixelData: Buffer,
  threshold = 200,
): number {

  let white = 0;

  for (let i = 0; i < pixelData.length; i++) {
    if (pixelData[i]! > threshold) {
      white++;
    }
  }

  return (white / pixelData.length) * 100;
}
/**
 * Downloads a generated segmentation mask from a remote URL.
 *
 * The request is automatically aborted if it exceeds the
 * configured timeout duration.
 *
 * @param url - Direct URL to the mask image file.
 *
 * @returns A Buffer containing the downloaded mask image data.
 *
 * @throws Error
 * Throws if:
 * - the request fails,
 * - the server responds with a non-2xx status,
 * - or the download times out.
 */
async function downloadMask(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(MASK_DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Mask download failed [${res.status}]: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
 
/**
 * Extracts the generated segmentation mask from a WaveSpeed SAM response
 * and downloads it as a Buffer.
 *
 * The function expects the response to contain at least one output URL.
 * If no output is available, it throws an error.
 *
 * @param data - The `data` field from either submit or poll response.
 *
 * @returns A Buffer containing the downloaded mask image.
 *
 * @throws Error
 * Throws if the outputs array is missing or empty.
 */
async function extractMaskFromResponse(
  data: WaveSpeedSubmitResponse['data'] | WaveSpeedPollResponse['data']
): Promise<Buffer> {
  const maskUrl = data.outputs?.[0];
  if (!maskUrl) throw new Error('SAM completed but outputs array is empty');
  return downloadMask(maskUrl);
}
 
// ─── Core SAM call ───────────────────────────────────────────────────────────
/**
 * Calls WaveSpeed SAM segmentation API and returns the generated mask image as a Buffer.
 *
 * This function:
 * 1. Submits an image + prompt to the SAM endpoint
 * 2. Handles immediate completion/failure responses
 * 3. Polls the job status until completion or failure
 * 4. Downloads and returns the final segmentation mask image
 *
 * @param imageBase64WithPrefix - Full image data URI (e.g. "data:image/png;base64,...")
 * @param spaceType - Type of space used to select segmentation prompt
 *
 * @returns A Buffer containing the downloaded segmentation mask image (PNG)
 *
 * @throws Error
 * Throws if:
 * - Submission request fails
 * - API returns a non-200 response
 * - Task fails during processing
 * - Polling request fails
 * - Task times out after max attempts
 */
async function callSAMSegmentation(
  imageBase64WithPrefix: string, // full "data:image/…;base64,…" string
  spaceType: SpaceType,
): Promise<Buffer> {
 
  const prompt = SEGMENTATION_PROMPTS[spaceType];
 
  // ── Submit ────────────────────────────────────────────────────────────────
  const submitResponse = await fetch(SAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64WithPrefix, // WaveSpeed expects the full data URI
      prompt,
      output_format: 'png',
    }),
  });
 
  if (!submitResponse.ok) {
    const body = await submitResponse.text();
    throw new Error(`SAM submit failed [${submitResponse.status}]: ${body}`);
  }
 
  const submitData = (await submitResponse.json()) as WaveSpeedSubmitResponse;
  if (submitData.code !== 200) {
    throw new Error(`WaveSpeed SAM error: ${submitData.message}`);
  }
 
  // ── Fast-path: task already completed on submit ───────────────────────────
  if (submitData.data.status === 'completed') {
    return extractMaskFromResponse(submitData.data);
  }
 
  if (submitData.data.status === 'failed') {
    throw new Error(`SAM failed immediately: ${submitData.data.error ?? 'Unknown'}`);
  }

  // ── Poll ──────────────────────────────────────────────────────────────────
  const pollUrl  = submitData.data.urls.get;
  let status: JobStatus = submitData.data.status;
  // let   attempts = 0;
  
 
  for (let attempts = 0; attempts < MAX_POLL_ATTEMPTS; attempts++) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

  const pollResponse = await fetch(pollUrl, {
    headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
  });

  if (!pollResponse.ok) {
    const err = await pollResponse.text();
    throw new Error(`SAM poll failed [${pollResponse.status}]: ${err}`);
  }

  const pollData = (await pollResponse.json()) as WaveSpeedPollResponse;
  status = pollData.data.status;  // ✅ TypeScript sees JobStatus here, no narrowing

  if (status === 'failed') {
    throw new Error(`SAM task failed: ${pollData.data.error ?? 'Unknown'}`);
  }

  if (status === 'completed') {
    return extractMaskFromResponse(pollData.data);
  }
}

throw new Error(`SAM timed out after ${MAX_POLL_ATTEMPTS * (POLL_INTERVAL_MS / 1000)}s`);
 
  throw new Error('SAM ended with unexpected status');
}
/**
 * Saves a Buffer to the local filesystem under the configured upload directory.
 *
 * This function:
 * - Ensures the target folder exists (creates it recursively if needed)
 * - Writes the buffer to disk using the provided filename
 * - Returns a relative POSIX-style path for later use (e.g., serving via API)
 *
 * @param buffer - The binary data to be written to disk
 * @param fileName - The name of the file to create (including extension)
 * @param folder - Subfolder inside the upload directory where the file will be stored
 *
 * @returns A relative file path in POSIX format (e.g. "folder/file.png")
 *
 * @throws Error
 * Throws if filesystem operations fail (e.g., permission issues, disk errors)
 */
export async function uploadBufferLocal(
  buffer: Buffer,
  fileName: string,
  folder: string
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return path.posix.join(folder, fileName);
}

// ─────────────────────────────────────────────────────────────────────────────
// detectSpaceType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uses a vision-language model to classify the type of space shown in an image.
 *
 * The model returns a strict JSON object containing:
 * - spaceType: predicted architectural category (e.g., balcony, kitchen, bedroom)
 * - category: whether the space is indoor or outdoor
 * - confidence: model confidence level (high | medium | low)
 * - reasoning: a short explanation based on visible cues
 *
 * The function is resilient to malformed model outputs:
 * if JSON parsing fails, it returns a safe fallback classification
 * instead of throwing an error.
 *
 * @param imageBuffer - Raw image buffer to classify
 *
 * @returns A structured `DetectedSpace` object with classification results.
 */
export async function detectSpaceType(imageBuffer: Buffer): Promise<DetectedSpace> {
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64Image}`;

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 200,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Classify the space in this image. Return ONLY valid JSON with no markdown or extra text:
{
  "spaceType": "one of: balcony|terrace|yard|rooftop|patio|garden|bedroom|living_room|kitchen|bathroom|dining_room|office|hallway|basement|generic_indoor|generic_outdoor",
  "category": "indoor or outdoor",
  "confidence": "high or medium or low",
  "reasoning": "one sentence explaining what you see"
}`,
          },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean) as DetectedSpace;
  } catch {
    return {
      spaceType: 'generic_indoor',
      category: 'indoor',
      confidence: 'low',
      reasoning: 'Could not classify space — using generic indoor fallback',
    };
  }
}
/**
 * Generates a simple fallback segmentation mask when AI-based
 * segmentation is unavailable.
 *
 * The mask is a synthetic black/white image:
 * - White region represents the estimated floor area
 * - Black region represents non-floor space
 *
 * Floor height ratio is adjusted based on whether the space
 * is classified as indoor or outdoor:
 * - Outdoor: larger floor area (default 50%)
 * - Indoor: smaller floor area (default 30%)
 *
 * @param width - Width of the output mask image
 * @param height - Height of the output mask image
 * @param spaceType - Detected space type used to infer layout proportions
 *
 * @returns A PNG Buffer containing the generated mask image
 *
 * @remarks
 * Uses `sharp` to rasterize an SVG-based mask.
 */
async function buildFallbackMask(
  width: number,
  height: number,
  spaceType: SpaceType,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
 
  const category   = getSpaceCategory(spaceType);
  const floorRatio = category === 'outdoor' ? 0.5 : 0.3;
  const floorH     = Math.floor(height * floorRatio);
  const floorY     = height - floorH;
 
  // xmlns + viewBox are required for sharp to parse SVG correctly
  const svgMask = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0"      width="${width}" height="${height}" fill="black" />
      <rect x="0" y="${floorY}" width="${width}" height="${floorH}"  fill="white" />
    </svg>`;
 
  return sharp(Buffer.from(svgMask)).png().toBuffer();
}
 
// ─── Public API ───────────────────────────────────────────────────────────────
 
/**
 * Primary segmentation pipeline entry point.
 *
 * This function:
 * 1. Normalizes input image (base64 or data URI)
 * 2. Extracts image dimensions using `sharp`
 * 3. Attempts SAM-based segmentation
 * 4. Validates mask quality using pixel coverage heuristics
 * 5. Falls back to rule-based floor mask if SAM fails or is invalid
 * 6. Optionally stores a debug mask for inspection
 *
 * Mask validation rules:
 * - Rejects masks with < 5% white pixels (too empty)
 * - Rejects masks with ≥ 90% white pixels (over-segmentation)
 *
 * @param imageBase64 - Raw base64 string or full data URI image
 * @param spaceType - Detected or assumed space type used for prompting SAM
 *
 * @returns A `SegmentationResult` containing:
 * - task_id: local identifier
 * - mask_url: null (local generation)
 * - mask_buffer: raw PNG buffer
 * - mask_base64: base64-encoded PNG mask
 */
export async function callSegmentationAPI(
  imageBase64: string,
  spaceType: SpaceType = 'generic_indoor',
): Promise<SegmentationResult> {
 
  const sharp = (await import('sharp')).default;
 
  // Normalise: strip prefix for sharp; keep full URI for SAM API
  const rawBase64    = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const dataUri      = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${rawBase64}`;
 
  const inputBuffer  = Buffer.from(rawBase64, 'base64');
  const metadata     = await sharp(inputBuffer).metadata();
  const width        = metadata.width  ?? 1024;
  const height       = metadata.height ?? 1024;
 
  let mask_buffer: Buffer;
  let usedSAM = false;
 
  // ── Attempt SAM segmentation ──────────────────────────────────────────────
  try {
    const samResult = await callSAMSegmentation(dataUri, spaceType);
 
    // Validate mask coverage
    const { data: pixelData } = await sharp(samResult)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
 
    const whitePercent = calcWhitePercent(pixelData);
 
    // Reject masks that are near-empty (<5%) or near-total (≥90%)
    // — both indicate SAM misidentified the region
    if (whitePercent >= 5 && whitePercent < 90) {
      mask_buffer = samResult;
      usedSAM     = true;
    } else {
      throw new Error(
        `SAM mask rejected: ${whitePercent.toFixed(1)}% white pixels ` +
        `(expected 5–90%)`
      );
    }
 
  } catch (err) {
    console.error(
      `[MASK] SAM failed or produced invalid mask — using floor-only fallback.\n` +
      `       Reason: ${(err as Error).message}`
    );
 
    mask_buffer = await buildFallbackMask(width, height, spaceType);
  }
 
  console.error(`[MASK] Strategy: ${usedSAM ? 'SAM segmentation' : 'floor-only fallback'}`);
 
  const mask_base64 = `data:image/png;base64,${mask_buffer.toString('base64')}`;
 
  // Persist debug mask (fire-and-forget — don't block the response)
  uploadBufferLocal(mask_buffer, `debug-mask-${Date.now()}.png`, 'debug-masks').catch(
    e => console.error('[MASK] Debug upload failed:', e)
  );
 
  return {
    task_id:     'local',
    mask_url:    null,           // no remote URL for locally-generated masks
    mask_buffer,
    mask_base64,
  };
}


/**
 * Sends an image to a vision-language model and returns a structured
 * architectural/interior scene description.
 *
 * The model is instructed to:
 * - Describe only visible elements in the image
 * - Infer physical properties from visual cues (lighting, shadows, scale)
 * - Follow a strict structured output format (FLOOR, WALLS & CEILING, etc.)
 *
 * The function encodes the image as a base64 data URI and sends it
 * to a multimodal LLM for analysis.
 *
 * @param imageBuffer - Raw image buffer (JPEG/PNG/WebP)
 * @param mimeType - MIME type of the image (defaults to image/jpeg)
 *
 * @returns A structured text description of the scene
 *
 * @throws Error
 * Throws if:
 * - Image buffer is invalid or too small
 * - The model returns an empty response
 * - The model appears to ignore or fail to process the image
 */
export async function callVisionForSceneDescription(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<string> {

  if (!imageBuffer || imageBuffer.length < 1000) {
    throw new Error(`Invalid image buffer: ${imageBuffer?.length ?? 0} bytes`);
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `You are a professional designer doing a visual site assessment from a photograph.
 
RULES:
- Describe ONLY what is physically visible in the image.
- Make confident inferences from visual cues (light, shadows, object scale).
- Do NOT say "cannot be determined" for things that ARE visible.
- Do NOT hallucinate objects not in the image.
- If the space is empty, write "No furniture or objects present." — do not invent them.
 
Use this exact structure. Omit a section only if truly nothing is visible:
 
FLOOR: [material, color, pattern, condition, estimated size]
WALLS & CEILING: [material, color, style, condition]
OBJECTS PRESENT: [every visible item, or "None"]
LIGHT: [direction, intensity, time-of-day from shadows]
SURROUNDINGS: [what is visible beyond the space — windows, views, adjacent areas]
CONDITION: [one sentence — overall state and mood]
 
Start immediately with FLOOR. No preamble. No suggestions.`;

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 700,
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
  });

  const description = completion.choices[0]?.message?.content;
  if (!description) throw new Error('Empty response from vision model');

  const blindPhrases = [
    "i don't have a photograph",
    'no image was provided',
    'i cannot see',
    "i'm unable to view",
  ];
  if (blindPhrases.some(p => description.toLowerCase().includes(p))) {
    throw new Error(`Vision model did not process the image: "${description.slice(0, 100)}"`);
  }

  return description;
}

// ─────────────────────────────────────────────────────────────────────────────
// callGroqForPlanning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a structured interior/exterior transformation plan using a Groq LLM.
 *
 * The model is instructed to behave as a space-specific designer persona and
 * generate a step-by-step redesign plan strictly grounded in the provided
 * scene description.
 *
 * Key behavior constraints:
 * - No hallucinated objects or assumptions beyond the scene description
 * - Steps must be additive unless a clear issue is explicitly described
 * - Style must be specific and context-aware (never default to "Modern")
 * - Output must be valid JSON (no markdown or extra text)
 *
 * The function automatically retries on rate limit errors (HTTP 429) using
 * exponential backoff.
 *
 * @param sceneDescription - Structured description of the physical space
 * @param detectedSpace - Output from vision-based space classification
 * @param prefs - Optional user preferences influencing design choices
 *
 * @returns A structured `DesignPlan` containing summary, style, and steps
 *
 * @throws Error
 * Throws if:
 * - Groq returns an empty response
 * - JSON parsing fails or response is invalid
 * - Max retry attempts are exceeded
 * - Non-retryable API errors occur
 */
export async function callGroqForPlanning(
  sceneDescription: string,
  detectedSpace: DetectedSpace,
  prefs?: Record<string, string>
): Promise<DesignPlan> {

  const config = SPACE_CONFIG[detectedSpace.category];

  const systemPrompt = `You are an ${config.persona} creating a transformation plan.
 
STRICT RULES:
- Base EVERY step ONLY on what is in the scene description. Never invent objects.
- Treat the space as a blank slate unless the description explicitly says otherwise.
- Steps must be additive (ADD / BUILD), not corrective, unless the description names a specific problem.
 
STYLE SELECTION RULES:
- NEVER default to "Modern" as a style — it is too generic and will be rejected.
- Choose a style that specifically matches the visible conditions in the scene.
- Good style examples for this space type: ${config.styleExamples}
- The style must feel like it belongs in THIS specific space, not a catalog.
 
DECORATION RULES:
- ${config.decorRule}
 
Return ONLY valid JSON — no markdown, no extra text:
{
  "summary": "One bold sentence describing the transformation vision for THIS specific space",
  "style": "Specific named style (not 'Modern')",
  "steps": [
    {
      "step": 1,
      "category": "${config.validCategories}",
      "action": "Action title (max 8 words)",
      "details": "Specific how-to: real item names, real materials, real dimensions. Min 2 sentences.",
      "effort": "low | medium | high",
      "cost": "budget | moderate | premium"
    }
  ]
}
 
Order steps: lowest effort first. Aim for 5–7 steps. No filler.`;

  const userPrompt = `
SPACE TYPE: ${detectedSpace.spaceType} (${detectedSpace.category})
DETECTION CONFIDENCE: ${detectedSpace.confidence} — ${detectedSpace.reasoning}
 
SCENE DESCRIPTION (treat this as ground truth — do not invent anything beyond it):
${sceneDescription}
 
USER PREFERENCES:
${prefs ? JSON.stringify(prefs) : 'None provided — create a general plan for this exact space.'}
 
IMPORTANT: Every step must be directly informed by the scene above.
Build FROM the described baseline — do not assume anything else exists.
`;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq planner');

      return JSON.parse(content) as DesignPlan;

    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('Groq planning error:', error);
      throw new Error('Failed to generate design plan with Groq.');
    }
  }

  throw new Error('Groq planning failed after all retries.');
}

// ─────────────────────────────────────────────────────────────────────────────
// buildImagePrompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds an image editing (inpainting) prompt for a generative model.
 *
 * The prompt is carefully structured to ensure the model performs
 * *edits on the existing scene* rather than generating a new scene from scratch.
 *
 * Key behavior:
 * - Converts a design plan into actionable visual modifications
 * - Preserves original architectural structure (walls, floors, perspective)
 * - Adapts vocabulary based on indoor vs outdoor spaces
 * - Infers lighting condition from scene description
 *
 * Outdoor prompts focus on:
 * - landscaping (softscape)
 * - structural additions (hardscape)
 * - lighting enhancements
 *
 * Indoor prompts focus on:
 * - furniture placement
 * - decor and styling
 * - textiles and finishes
 * - lighting and paint updates
 *
 * @param plan - Generated design plan containing structured transformation steps
 * @param sceneDescription - Vision model description of the original image
 * @param detectedSpace - Classified space type and category (indoor/outdoor)
 *
 * @returns A single optimized text prompt for image editing / inpainting models
 */
export function buildImagePrompt(
  plan: DesignPlan,
  sceneDescription: string,
  detectedSpace: DetectedSpace
): string {

  const isAfternoon = sceneDescription.toLowerCase().includes('afternoon');
  const lightingCondition = isAfternoon ? 'warm golden afternoon light' : 'soft natural daylight';

  if (detectedSpace.category === 'outdoor') {
    const plants = plan.steps
      .filter(s => s.category === 'Softscape')
      .map(s => s.details.split('.')[0])
      .join('; ');
    const hardscape = plan.steps
      .filter(s => s.category === 'Hardscape')
      .map(s => s.action)
      .join(', ');
    const lighting = plan.steps
      .filter(s => s.category === 'Lighting')
      .map(s => s.action)
      .join(', ');

    return [
      `Add ${plan.style} garden elements to this existing ${detectedSpace.spaceType}:`,
      plants ? `plants including ${plants},` : '',
      hardscape ? `${hardscape},` : '',
      lighting ? `${lighting},` : '',
      `${lightingCondition},`,
      `photorealistic, high detail, 4k,`,
      `keep original floor tiles unchanged,`,
      `keep original railings and walls unchanged,`,
      `keep original architectural structure and perspective intact`,
    ].filter(Boolean).join(' ');

  } else {
    // indoor
    const furniture = plan.steps
      .filter(s => s.category === 'Furniture')
      .map(s => s.details.split('.')[0])
      .join('; ');
    const decor = plan.steps
      .filter(s => s.category === 'Decor')
      .map(s => s.action)
      .join(', ');
    const textiles = plan.steps
      .filter(s => s.category === 'Textiles')
      .map(s => s.action)
      .join(', ');
    const lighting = plan.steps
      .filter(s => s.category === 'Lighting')
      .map(s => s.action)
      .join(', ');
    const paint = plan.steps
      .filter(s => s.category === 'Paint & Finish')
      .map(s => s.action)
      .join(', ');

    return [
      `Transform this ${detectedSpace.spaceType} into a ${plan.style} interior:`,
      furniture ? `furniture including ${furniture},` : '',
      decor ? `${decor},` : '',
      textiles ? `${textiles},` : '',
      lighting ? `${lighting},` : '',
      paint ? `${paint},` : '',
      `${lightingCondition},`,
      `photorealistic, interior photography, high detail, 4k,`,
      `keep original walls, floor, and ceiling unchanged,`,
      `keep original windows and doors intact,`,
      `same room dimensions and perspective`,
    ].filter(Boolean).join(' ');
  }
}
/**
 * Performs mask-guided inpainting using WaveSpeed `flux-fill-dev`.
 *
 * This function:
 * - Sends an image + binary mask + prompt to the inpainting model
 * - Polls the job until completion
 * - Downloads the generated image
 * - Stores the result locally and returns a public URL
 *
 * IMPORTANT BEHAVIOR:
 * - Mask interpretation:
 *   - White pixels → regions to regenerate (edit area)
 *   - Black pixels → preserved exactly (unchanged)
 *
 * MODEL NOTE:
 * - `flux-fill-dev` supports mask-based editing (inpainting)
 * - `flux-kontext-dev` does NOT support masks and will regenerate full image
 *
 * @param imageBase64 - Input image (data URI or raw base64 string)
 * @param maskBase64 - Binary mask image (white = edit, black = preserve)
 * @param prompt - Text prompt guiding the inpainting transformation
 * @param fileName - Base filename used for storing output result
 *
 * @returns Public URL of the generated inpainted image
 *
 * @throws Error
 * Throws if:
 * - Submission fails
 * - API returns non-200 response
 * - Polling fails or times out
 * - Model returns no output image URL
 * - Download or storage fails
 */
export async function callInpainting(
  imageBase64: string,
  maskBase64: string,
  prompt: string,
  fileName: string
): Promise<string> {

  const ENDPOINT = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-fill-dev';

  // Strip data URI prefix — WaveSpeed expects raw base64 only
  const rawImageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const rawMaskBase64 = maskBase64.replace(/^data:image\/\w+;base64,/, '');

  const submitResponse = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: rawImageBase64,
      mask_image: rawMaskBase64,   // white = fill, black = preserve
      prompt,
      num_inference_steps: 28,
      guidance_scale: 28,             // flux-fill-dev requires >= 28
      num_images: 1,
      output_format: 'jpeg',
      seed: -1,
      negative_prompt: `
      completely new scene,
      different layout,
      distorted perspective,
      changed architecture,
      unrealistic geometry
`
    }),
  });

  if (!submitResponse.ok) {
    const err = await submitResponse.text();
    throw new Error(`flux-fill submit failed [${submitResponse.status}]: ${err}`);
  }

  const submitData = (await submitResponse.json()) as WaveSpeedSubmitResponse;
  if (submitData.code !== 200) throw new Error(`WaveSpeed error: ${submitData.message}`);

  const pollUrl = submitData.data.urls.get;
  let status = submitData.data.status;
  let attempts = 0;
  const MAX = 500;

  while (status !== 'completed' && status !== 'failed') {
    if (attempts >= MAX) throw new Error('[Inpainting] Timed out after 80s');

    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
    });
    const pollData = (await pollRes.json()) as WaveSpeedPollResponse;
    status = pollData.data.status;

    if (status === 'failed') {
      throw new Error(`[Inpainting] Failed: ${pollData.data.error ?? 'Unknown'}`);
    }

    if (status === 'completed') {
      const imageUrl = pollData.data.outputs?.[0];
      if (!imageUrl) throw new Error('[Inpainting] No output URL in response');

      const imgBuffer = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
      const outKey = await uploadBufferLocal(imgBuffer, `${fileName}-result.jpg`, 'design-outputs');
      return `${BASE_URL}/uploads/${outKey}`;
    }
  }

  throw new Error('[Inpainting] Ended with unexpected status');
}