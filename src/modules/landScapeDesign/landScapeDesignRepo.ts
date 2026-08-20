import OpenAI from "openai";
import fs from 'fs/promises';
import path from 'path';
import dotenv from "dotenv";
import { getDB } from "../../core/config/db";
dotenv.config();

const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
const GPT_VISION_MODEL = process.env.GPT_VISION_MODEL || "gpt-4.1-mini";
const GPT_PLANNING_MODEL = process.env.GPT_PLANNING_MODEL || "gpt-4.1";

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';
// const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY!;
// const SAM_ENDPOINT = process.env.WAVESPEED_SAM_URL!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
const REPLICATE_API_KEY = requireEnv('REPLICATE_API_KEY');

// meta/sam-2 on Replicate — pinned version for stability
const REPLICATE_SAM2_URL = 'https://api.replicate.com/v1/predictions';
// const REPLICATE_SAM2_VERSION = 'cbd95fb76192174268b6b303aeeb7a736e8dab0cbc38177f09db79b2299da30b';

const REQUEST_TIMEOUT_MS = 60_000;  // wait up to 60s (Prefer: wait header)
const DOWNLOAD_TIMEOUT_MS = 15_000;
// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplicatePrediction {
  id: string;
  status: string;           // 'starting' | 'processing' | 'succeeded' | 'failed'
  output?: string | string[];// mask image URL(s)
  error?: string;
  urls?: {
    get: string;
    cancel: string;
  };
}

export interface SegmentationResult {
  task_id: string;
  mask_url: string | null;
  mask_buffer: Buffer;
  mask_base64: string;
}

/**
 * Retrieves a required environment variable from `process.env`.
 *
 * @param key - The name of the environment variable to retrieve.
 * @returns The environment variable value as a string.
 * @throws {Error} Throws if the environment variable is missing or empty.
 *
 * @example
 * const apiKey = requireEnv("API_KEY");
 */
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

/**
 * Determines whether a space type is categorized as indoor or outdoor.
 *
 * @param spaceType - The type of space to classify.
 * @returns `"outdoor"` if the space type is considered outdoor; otherwise `"indoor"`.
 *
 * @example
 * getSpaceCategory('balcony'); // "outdoor"
 * getSpaceCategory('bedroom'); // "indoor"
 */
function getSpaceCategory(spaceType: SpaceType): 'indoor' | 'outdoor' {
  const outdoorTypes: SpaceType[] = [
    'balcony', 'terrace', 'yard', 'rooftop',
    'patio', 'garden', 'generic_outdoor',
  ];
  return outdoorTypes.includes(spaceType) ? 'outdoor' : 'indoor';
}
/**
 * Calculates the percentage of pixels whose value exceeds a given threshold.
 *
 * Commonly used for estimating the proportion of "white" pixels
 * in grayscale or single-channel image data.
 *
 * @param pixelData - Array of pixel intensity values.
 * @param threshold - Minimum value required for a pixel to be counted as white. Defaults to `128`.
 * @returns The percentage of pixels above the threshold, from `0` to `100`.
 *
 * @example
 * calcWhitePercent(new Uint8Array([0, 255, 200, 100]));
 * // 50
 */
function calcWhitePercent(pixelData: Uint8Array, threshold = 128): number {
  let white = 0;
  for (let i = 0; i < pixelData.length; i++) {
    if (pixelData[i]! > threshold) white++;
  }
  return (white / pixelData.length) * 100;
}
/**
 * Calculates a reference floor point within a space image.
 *
 * The point is positioned horizontally at the center of the image and
 * vertically near the bottom. Outdoor spaces use a slightly higher
 * floor position than indoor spaces.
 *
 * @param width - Width of the image or canvas.
 * @param height - Height of the image or canvas.
 * @param spaceType - Type of space used to determine indoor/outdoor placement.
 * @returns An object containing the `{ x, y }` floor coordinates.
 *
 * @example
 * getFloorPoint(1024, 768, 'balcony');
 * // { x: 512, y: 614 }
 */
function getFloorPoint(
  width: number,
  height: number,
  spaceType: SpaceType,
): { x: number; y: number } {
  const outdoor = getSpaceCategory(spaceType) === 'outdoor';
  return {
    x: Math.floor(width / 2),
    y: Math.floor(height * (outdoor ? 0.80 : 0.88)),
  };
}

/**
 * Downloads a mask image from a given URL and returns it as a Buffer.
 *
 * The request is automatically aborted if it exceeds `DOWNLOAD_TIMEOUT_MS`.
 *
 * @param url - Direct URL to the mask image resource
 * @returns A `Buffer` containing the downloaded image data
 *
 * @throws {Error} Throws if the network request fails or returns a non-OK response
 *
 * @example
 * const maskBuffer = await downloadMask("https://example.com/mask.png");
 */
async function downloadMask(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Mask download failed [${res.status}]: ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
// ─── Roboflow SAM2 ────────────────────────────────────────────────────────────

/**
 * Step 1 — embed the image and get an image_id back.
 * Roboflow caches the embedding so the subsequent infer call is fast.
 */
// async function embedImage(rawBase64: string): Promise<string> {
//   const response = await fetch(
//     `${SAM2_EMBED_URL}?api_key=${ROBOFLOW_API_KEY}`,
//     {
//       method:  'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body:    JSON.stringify({ image: { type: 'base64', value: rawBase64 } }),
//       signal:  AbortSignal.timeout(MASK_DOWNLOAD_TIMEOUT_MS),
//     },
//   );

//   if (!response.ok) {
//     const err = await response.text();
//     throw new Error(`SAM2 embed failed [${response.status}]: ${err}`);
//   }

//   const data = (await response.json()) as RoboflowEmbedResponse;
//   if (!data.image_id) {
//     throw new Error(`SAM2 embed returned no image_id: ${JSON.stringify(data)}`);
//   }

//   return data.image_id;
// }







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
  | 'Hardscape' | 'Softscape' | 'Water Feature' | 'Lighting' | 'Maintenance' | 'Pathways' | 'seating' | 'planters' | 'decor' | 'otherwise'
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
  style: string;
  questionsAndAnswers: Array<{ question: string; answer: string }>;
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
// const SAM_ENDPOINT = process.env.WAVESPEED_SAM_URL ?? '';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY ?? '';

// const MAX_POLL_ATTEMPTS = 30;
// const POLL_INTERVAL_MS = 2_000;
// const MASK_DOWNLOAD_TIMEOUT_MS = 15_000;

// SAM segmentation prompts — must be ≤ 32 chars (WaveSpeed hard limit)
// const SEGMENTATION_PROMPTS: Record<SpaceType, string> = {
//   // outdoor – focus on the ground only
//   balcony: 'balcony floor',
//   terrace: 'terrace ground',
//   yard: 'lawn area',
//   rooftop: 'rooftop floor surface',
//   patio: 'patio stones',
//   garden: 'garden soil',
//   // indoor – floor only (no walls)
//   bedroom: 'bedroom floor',
//   living_room: 'living room floor',
//   kitchen: 'kitchen floor',
//   bathroom: 'bathroom floor',
//   dining_room: 'dining room floor',
//   office: 'office floor',
//   hallway: 'hallway floor',
//   basement: 'basement floor',
//   // fallback
//   generic_indoor: 'floor surface',
//   generic_outdoor: 'ground surface',
// };

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
  task_id: string;
  mask_url: string | null;
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
// function calcWhitePercent(
//   pixelData: Buffer,
//   threshold = 200,
// ): number {

//   let white = 0;

//   for (let i = 0; i < pixelData.length; i++) {
//     if (pixelData[i]! > threshold) {
//       white++;
//     }
//   }

//   return (white / pixelData.length) * 100;
// }
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
// async function downloadMask(url: string): Promise<Buffer> {
//   const res = await fetch(url, {
//     signal: AbortSignal.timeout(MASK_DOWNLOAD_TIMEOUT_MS),
//   });
//   if (!res.ok) throw new Error(`Mask download failed [${res.status}]: ${url}`);
//   return Buffer.from(await res.arrayBuffer());
// }

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

// async function extractMaskFromResponse(
//   data: WaveSpeedSubmitResponse['data'] | WaveSpeedPollResponse['data']
// ): Promise<Buffer> {
//   const maskUrl = data.outputs?.[0];
//   if (!maskUrl) throw new Error('SAM completed but outputs array is empty');
//   return downloadMask(maskUrl);
// }

// ─── Core SAM call ───────────────────────────────────────────────────────────
/**
 * Calls the SAM2 segmentation service to generate a mask from an input image.
 *
 * This function:
 * - Computes foreground/background prompt points based on image geometry
 * - Submits a segmentation request to the Replicate SAM2 model
 * - Handles both synchronous ("Prefer: wait") and fallback polling flows
 *
 * @param rawBase64 - Base64-encoded image data (without data URI prefix)
 * @param spaceType - Type of space used to compute prompt points
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns A `Buffer` containing the generated segmentation mask
 *
 * @throws {Error} Throws if the API request fails or segmentation cannot be completed
 *
 * @example
 * const mask = await callSAM2Segmentation(base64Image, 'balcony', 1024, 768);
 */
async function callSAM2Segmentation(
  rawBase64: string,
  spaceType: SpaceType,
  width: number,
  height: number,
): Promise<Buffer> {

  const floor = getFloorPoint(width, height, spaceType);
  const bgX = Math.floor(width / 2);
  const bgY = Math.floor(height * 0.08);

  // console.log(
  //   `[SAM2] spaceType=${spaceType} | ` +
  //   `floor=(${floor.x},${floor.y}) | bg=(${bgX},${bgY}) | ` +
  //   `size=${width}x${height}`
  // );

  // ── Submit prediction ─────────────────────────────────────────────────────
  const submitRes = await fetch(REPLICATE_SAM2_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',          // synchronous response — no polling needed
    },
    body: JSON.stringify({
      version: 'cbd95fb76192174268b6b303aeeb7a736e8dab0cbc38177f09db79b2299da30b', // ← meta/sam-2 latest
      input: {
        image: `data:image/jpeg;base64,${rawBase64}`,
        point_coords: JSON.stringify([[floor.x, floor.y], [bgX, bgY]]),
        point_labels: '1, 0',
        multimask_output: false,
      },
    }),

    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`SAM2 submit failed [${submitRes.status}]: ${err}`);
  }

  const prediction = (await submitRes.json()) as ReplicatePrediction;

  // ── Fast-path: already succeeded (Prefer: wait worked) ───────────────────
  if (prediction.status === 'succeeded') {
    return getMaskFromOutput(prediction.output);
  }

  if (prediction.status === 'failed') {
    throw new Error(`SAM2 failed immediately: ${prediction.error ?? 'Unknown'}`);
  }

  // ── Fallback polling (if Prefer: wait timed out on Replicate's side) ─────
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) {
    throw new Error('SAM2 prediction has no poll URL and is not yet complete');
  }

  return pollUntilDone(pollUrl);
}
/**
 * Polls the SAM2 prediction endpoint until the segmentation result is ready.
 *
 * This function repeatedly queries the provided polling URL until:
 * - The prediction succeeds (returns a mask Buffer), or
 * - The prediction fails, or
 * - The maximum number of attempts is reached
 *
 * @param pollUrl - The Replicate prediction polling URL
 * @returns A `Buffer` containing the generated segmentation mask
 *
 * @throws {Error} Throws if polling fails, the prediction fails, or a timeout occurs
 *
 * @example
 * const mask = await pollUntilDone(pollUrl);
 */
async function pollUntilDone(pollUrl: string): Promise<Buffer> {
  const MAX_ATTEMPTS = 30;
  const POLL_INTERVAL = 2_000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!pollRes.ok) {
      const err = await pollRes.text();
      throw new Error(`SAM2 poll failed [${pollRes.status}]: ${err}`);
    }

    const data = (await pollRes.json()) as ReplicatePrediction;

    if (data.status === 'failed') {
      throw new Error(`SAM2 prediction failed: ${data.error ?? 'Unknown'}`);
    }

    if (data.status === 'succeeded') {
      return getMaskFromOutput(data.output);
    }
  }

  throw new Error(
    `SAM2 timed out after ${MAX_ATTEMPTS * (POLL_INTERVAL / 1000)}s`
  );
}

/**
 * Extracts and downloads the segmentation mask from SAM2 model output.
 *
 * The Replicate SAM2 API may return either:
 * - A single mask URL (string), or
 * - An array of mask URLs (string[])
 *
 * This function normalizes the output and downloads the first available mask.
 *
 * @param output - The SAM2 model output containing one or more mask URLs
 * @returns A `Buffer` containing the downloaded mask image
 *
 * @throws {Error} Throws if the output is missing or empty
 *
 * @example
 * const mask = await getMaskFromOutput(prediction.output);
 */
async function getMaskFromOutput(
  output: string | string[] | undefined
): Promise<Buffer> {
  // Replicate SAM2 returns an array of mask URLs
  const maskUrl = Array.isArray(output) ? output[0] : output;

  if (!maskUrl) {
    throw new Error('SAM2 succeeded but output is empty');
  }

  return downloadMask(maskUrl);
}
/**
 * Validates a segmentation mask by analyzing pixel coverage in both alpha
 * and grayscale channels.
 *
 * The function computes the percentage of "white" pixels (above default
 * threshold) and uses the higher value between:
 * - Alpha channel coverage
 * - Grayscale intensity coverage
 *
 * A mask is considered valid if it covers a reasonable portion of the image
 * (between 5% and 90%).
 *
 * @param maskBuffer - Raw image buffer of the segmentation mask
 * @returns An object containing:
 *  - `valid`: whether the mask passes coverage thresholds
 *  - `whitePercent`: estimated percentage of white/active pixels
 *
 * @example
 * const result = await validateMask(maskBuffer);
 * if (result.valid) {
 *   console.log(result.whitePercent);
 * }
 */
async function validateMask(
  maskBuffer: Buffer,
): Promise<{ valid: boolean; whitePercent: number }> {
  const sharp = (await import('sharp')).default;

  // Check alpha channel
  const { data: rgbaData, info } = await sharp(maskBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alphaData = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alphaData.length; i++) {
    alphaData[i] = rgbaData[i * 4 + 3]!;
  }
  const alphaPercent = calcWhitePercent(alphaData);

  // Check grayscale channel
  const { data: grayData } = await sharp(maskBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const grayPercent = calcWhitePercent(new Uint8Array(grayData));

  const whitePercent = Math.max(alphaPercent, grayPercent);

  // console.log(
  //   `[MASK] alpha=${alphaPercent.toFixed(1)}% | ` +
  //   `gray=${grayPercent.toFixed(1)}% | ` +
  //   `effective=${whitePercent.toFixed(1)}%`
  // );

  // Accept masks covering 5–90% of the image
  return {
    valid: whitePercent >= 5 && whitePercent < 90,
    whitePercent,
  };
}
/**
 * Builds a simple fallback segmentation mask when SAM2 fails or returns
 * an invalid result.
 *
 * The mask is a generated SVG where:
 * - The entire image is black (background)
 * - The lower portion is white (floor region)
 *
 * Floor height is adjusted based on whether the space is indoor or outdoor.
 *
 * @param width - Width of the target image
 * @param height - Height of the target image
 * @param spaceType - Type of space used to adjust floor ratio
 * @returns A `Buffer` containing a PNG mask image
 *
 * @example
 * const mask = await buildFallbackMask(1024, 768, 'garden');
 */
async function buildFallbackMask(
  width: number,
  height: number,
  spaceType: SpaceType,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  const outdoor = getSpaceCategory(spaceType) === 'outdoor';
  const floorRatio = outdoor ? 0.5 : 0.3;
  const floorH = Math.floor(height * floorRatio);
  const floorY = height - floorH;

  const svgMask = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0"         width="${width}" height="${height}" fill="black" />
      <rect x="0" y="${floorY}" width="${width}" height="${floorH}"  fill="white" />
    </svg>`;

  return sharp(Buffer.from(svgMask)).png().toBuffer();
}



// async function callSAM2Segmentation(
//   rawBase64: string,
//   spaceType: SpaceType,
//   width: number,
//   height: number,
// ): Promise<Buffer> {

//   const imageId = await embedImage(rawBase64);

//   const [floorX, floorY] = getFloorPoint(width, height, spaceType);

//   // Background exclusion: top-center = ceiling (indoor) or sky (outdoor)
//   const bgX = Math.floor(width  / 2);
//   const bgY  = Math.floor(height * 0.08);

//   const pointCoords: [number, number][] = [
//     [floorX, floorY], // foreground — floor
//     [bgX,    bgY],    // background — ceiling / sky
//   ];
//   const pointLabels = [1, 0]; // 1 = include, 0 = exclude

//   console.log(
//     `[SAM2] spaceType=${spaceType} | ` +
//     `floor=(${floorX},${floorY}) | bg=(${bgX},${bgY}) | ` +
//     `imageSize=${width}x${height}`
//   );

//   return inferMask(rawBase64, imageId, pointCoords, pointLabels);
// }

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

  const completion = await openai.chat.completions.create({
    model: GPT_VISION_MODEL,
    max_tokens: 200,
    temperature: 0.1,
    response_format: { type: 'json_object' },
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
// ─────────────────────────────────────────────────────────────────────────────
// getNativePlants
// ─────────────────────────────────────────────────────────────────────────────

export interface NativePlant {
  commonName: string;
  latinName: string;
  type: 'tree' | 'shrub' | 'flowering' | 'ground_cover' | 'climber' | 'grass';
  sunlight: 'full_sun' | 'partial_shade' | 'full_shade';
  waterNeeds: 'low' | 'moderate' | 'high';
  notes: string;
}

export interface NativePlantsResult {
  region: string;
  climate: string;
  plants: NativePlant[];
}

export interface SurveyAnswerForDesign {
  question: string;
  answer: string;
  order: number;
}

/**
 * Loads the user's onboarding survey answers for garden plant selection.
 *
 * Uses an explicit responseId when provided; otherwise uses the latest
 * survey_answers row for the user.
 *
 * @param userId - Authenticated user id
 * @param responseId - Optional survey response id
 * @returns Ordered question/answer pairs
 */
export async function getUserSurveyAnswersForDesign(
  userId: string,
  responseId?: string
): Promise<SurveyAnswerForDesign[]> {
  const db = getDB();

  const resolvedResponseId = responseId ?? (
    await db.query<{ response_id: string }>(
      `SELECT response_id
         FROM survey_answers
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId]
    )
  ).rows[0]?.response_id;

  if (!resolvedResponseId) {
    return [];
  }

  const result = await db.query<{
    question_text: string;
    selected_option: string | null;
    question_order: number;
  }>(
    `SELECT
        q.question_text,
        sa.selected_option,
        q."order" AS question_order
       FROM survey_answers sa
       JOIN questions q ON q.id = sa.question_id
      WHERE sa.response_id = $1
        AND q.is_deleted = false
      ORDER BY q."order" ASC NULLS LAST, q.id ASC`,
    [resolvedResponseId]
  );

  return result.rows
    .filter((row) => (row.selected_option ?? "").trim().length > 0)
    .map((row) => ({
      question: row.question_text,
      answer: (row.selected_option ?? "").trim(),
      order: row.question_order,
    }));
}

/**
 * Uses GPT to identify regionally native and climate-appropriate plants
 * for the given GPS coordinates.
 *
 * The model returns up to 10 plants suited to the local climate, soil, and light conditions.
 *
 * @param latitude - Decimal latitude
 * @param longitude - Decimal longitude
 * @returns Structured list of native/suitable plants with care metadata
 */
export async function getNativePlants(
  latitude: number,
  longitude: number,
): Promise<NativePlantsResult> {
  const completion = await openai.chat.completions.create({
    model: GPT_PLANNING_MODEL,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a professional horticulturist and landscape botanist.
Given GPS coordinates, identify the climate zone and recommend native or well-adapted garden plants.
Return ONLY valid JSON — no markdown, no extra text.`,
      },
      {
        role: 'user',
        content: `GPS: latitude=${latitude}, longitude=${longitude}

Identify the region and climate zone, then list 8–10 plants (native or regionally adapted) best suited for a garden in that location.

Return ONLY this JSON structure:
{
  "region": "city/country name",
  "climate": "climate classification (e.g. tropical, arid, temperate)",
  "plants": [
    {
      "commonName": "string",
      "latinName": "string",
      "type": "tree | shrub | flowering | ground_cover | climber | grass",
      "sunlight": "full_sun | partial_shade | full_shade",
      "waterNeeds": "low | moderate | high",
      "notes": "1 sentence — why it suits this climate and where to place it"
    }
  ]
}

Rules:
- Prefer plants native to or well-established in the region
- Mix types: include at least 2 flowering, 1 ground_cover, 1 climber
- All plants must realistically grow outdoors in that climate
- Keep notes concise and practical`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from GPT native plants lookup');

  return JSON.parse(content) as NativePlantsResult;
}

/**
 * Calls a segmentation model (or fallback rules) to generate an edit mask.
 *
 * @param imageBase64 - Raw base64 string or full data URI image.
 * @param spaceType - Optional space type used to guide masking.
 * @returns A `SegmentationResult` containing a mask buffer and base64.
 */
export async function callSegmentationAPI(
  imageBase64: string,
  spaceType: SpaceType = 'generic_indoor',
): Promise<SegmentationResult> {

  const sharp = (await import('sharp')).default;

  const rawBase64Original = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const inputBufferRaw = Buffer.from(rawBase64Original, 'base64');

  // ✅ Rotate once, reuse everywhere
  const inputBuffer = await sharp(inputBufferRaw)
    .rotate()          // strips EXIF rotation and bakes it in
    .jpeg({ quality: 92 })            // re-encode so downstream gets a clean, orientation-safe image
    .toBuffer();

  // ✅ Re-derive rawBase64 FROM the corrected buffer
  const rawBase64 = inputBuffer.toString('base64');

  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;


  let mask_buffer: Buffer;
  /* eslint-disable @typescript-eslint/no-unused-vars */
  let usedSAM = false;

  // ── Attempt SAM2 segmentation ─────────────────────────────────────────────
  try {
    const samResult = await callSAM2Segmentation(
      rawBase64, spaceType, width, height
    );

    const { valid, whitePercent } = await validateMask(samResult);

    if (valid) {
      mask_buffer = samResult;
      usedSAM = true;
    } else {
      throw new Error(
        `SAM2 mask rejected: ${whitePercent.toFixed(1)}% coverage (expected 5–90%)`
      );
    }

  } catch (err) {
    // console.warn(
    //   `[MASK] SAM2 failed — using floor-only fallback.\n` +
    //   `       Reason: ${(err as Error).message}`
    // );
    mask_buffer = await buildFallbackMask(width, height, spaceType);
  }

  // console.log(`[MASK] Strategy: ${usedSAM ? 'SAM2 (Replicate)' : 'floor-only fallback'}`);

  const mask_base64 = `data:image/png;base64,${mask_buffer.toString('base64')}`;

  // Debug upload — fire-and-forget
  uploadBufferLocal(mask_buffer, `debug-mask-${Date.now()}.png`, 'debug-masks').catch(
    (e: Error) => console.error('[MASK] Debug upload failed:', e)
  );

  return {
    task_id: 'local',
    mask_url: null,
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

  const completion = await openai.chat.completions.create({
    model: GPT_VISION_MODEL,
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

export interface SpaceVisionAndNativePlantsResult {
  detectedSpace: DetectedSpace;
  description: string;
  nativePlants: NativePlantsResult;
}

/**
 * Single-call pipeline helper:
 * - Uses ONE vision request to classify the space
 * - Produces the structured scene description
 * - Also recommends native / climate-appropriate plants from lat/long
 *
 * This is intended to reduce the overall prompt/token usage vs calling
 * detectSpaceType + callVisionForSceneDescription + getNativePlants separately.
 *
 * @param imageBuffer - Raw image buffer (JPEG/PNG/WebP).
 * @param latitude - GPS latitude in decimal degrees.
 * @param longitude - GPS longitude in decimal degrees.
 * @param mimeType - Input image mime type for the vision model.
 * @returns Combined result with detected space, scene description, and native plants.
 */
export async function callVisionForSpaceAndNativePlants(
  imageBuffer: Buffer,
  latitude: number,
  longitude: number,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<SpaceVisionAndNativePlantsResult> {
  if (!imageBuffer || imageBuffer.length < 1000) {
    throw new Error(`Invalid image buffer: ${imageBuffer?.length ?? 0} bytes`);
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `You are both:
(A) a professional interior/exterior space assessor (from an image) AND
(B) a horticulture expert (from GPS coordinates).

Return ONLY valid JSON with no markdown and no extra keys.

GPS INPUT:
latitude=${latitude}
longitude=${longitude}

IMAGE TASK (must be grounded in the image only):
1) detectedSpace:
   - spaceType: one of: balcony|terrace|yard|rooftop|patio|garden|bedroom|living_room|kitchen|bathroom|dining_room|office|hallway|basement|generic_indoor|generic_outdoor
   - category: indoor or outdoor
   - confidence: high or medium or low
   - reasoning: one sentence (based on visible cues)

2) description:
   Use this exact structure (each line should be short):
   FLOOR: ...
   WALLS & CEILING: ...
   OBJECTS PRESENT: ...
   LIGHT: ...
   SURROUNDINGS: ...
   CONDITION: ...
   Start immediately with FLOOR. Do not include any intro text.

GPS TASK (plants can be based on GPS, not image):
3) nativePlants:
   - Provide region + climate
   - Provide 6–8 plants total (realistic outdoors for that location)
   - Include at least:
     * 2 flowering plants
     * 1 ground_cover
     * 1 climber

Return JSON ONLY in this format:
{
  "detectedSpace": {
    "spaceType": "string",
    "category": "indoor | outdoor",
    "confidence": "high | medium | low",
    "reasoning": "string"
  },
  "description": "string with newline separators",
  "nativePlants": {
    "region": "string",
    "climate": "string",
    "plants": [
      {
        "commonName": "string",
        "latinName": "string",
        "type": "tree | shrub | flowering | ground_cover | climber | grass",
        "sunlight": "full_sun | partial_shade | full_shade",
        "waterNeeds": "low | moderate | high",
        "notes": "short 1 sentence placement/care note"
      }
    ]
  }
}
`;

  const completion = await openai.chat.completions.create({
    model: GPT_VISION_MODEL,
    max_tokens: 1300,
    temperature: 0.2,
    response_format: { type: 'json_object' },
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

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from combined vision+plants model');

  return JSON.parse(content) as SpaceVisionAndNativePlantsResult;
}

/**
 * Single-call vision helper using onboarding survey answers instead of GPS.
 * Detects space, describes the scene, and recommends plants from quiz answers.
 *
 * @param imageBuffer - Raw image buffer
 * @param surveyAnswers - Onboarding question/answer pairs
 * @param mimeType - Image mime type
 * @returns Combined space, description, and recommended plants
 */
export async function callVisionForSpaceAndSurveyPlants(
  imageBuffer: Buffer,
  surveyAnswers: SurveyAnswerForDesign[],
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<SpaceVisionAndNativePlantsResult> {
  if (!imageBuffer || imageBuffer.length < 1000) {
    throw new Error(`Invalid image buffer: ${imageBuffer?.length ?? 0} bytes`);
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const surveyBlock = surveyAnswers
    .map((item, index) => `${index + 1}. ${item.question}: ${item.answer}`)
    .join('\n');

  const prompt = `You are both:
(A) a professional interior/exterior space assessor (from an image) AND
(B) a horticulture expert who chooses plants from a user's onboarding quiz.

Return ONLY valid JSON with no markdown and no extra keys.

ONBOARDING ANSWERS (this is the ONLY source for plant choice — do not use GPS):
${surveyBlock}

IMAGE TASK (must be grounded in the image only):
1) detectedSpace:
   - spaceType: one of: balcony|terrace|yard|rooftop|patio|garden|bedroom|living_room|kitchen|bathroom|dining_room|office|hallway|basement|generic_indoor|generic_outdoor
   - category: indoor or outdoor
   - confidence: high or medium or low
   - reasoning: one sentence (based on visible cues)

2) description:
   Use this exact structure (each line should be short):
   FLOOR: ...
   WALLS & CEILING: ...
   OBJECTS PRESENT: ...
   LIGHT: ...
   SURROUNDINGS: ...
   CONDITION: ...
   Start immediately with FLOOR. Do not include any intro text.

SURVEY TASK (plants must match the onboarding answers, not location):
3) nativePlants:
   - region: "onboarding survey"
   - climate: copy from the climate/sunlight answers
   - Provide 6–8 plants that fit the quiz (space, sunlight, watering, goal, experience)
   - Include at least 2 flowering, 1 ground_cover, 1 climber when the space is outdoor
   - For indoor space prefer indoor-friendly plants

Return JSON ONLY in this format:
{
  "detectedSpace": {
    "spaceType": "string",
    "category": "indoor | outdoor",
    "confidence": "high | medium | low",
    "reasoning": "string"
  },
  "description": "string with newline separators",
  "nativePlants": {
    "region": "onboarding survey",
    "climate": "string",
    "plants": [
      {
        "commonName": "string",
        "latinName": "string",
        "type": "tree | shrub | flowering | ground_cover | climber | grass",
        "sunlight": "full_sun | partial_shade | full_shade",
        "waterNeeds": "low | moderate | high",
        "notes": "short 1 sentence why it matches the quiz answers"
      }
    ]
  }
}
`;

  const completion = await openai.chat.completions.create({
    model: GPT_VISION_MODEL,
    max_tokens: 1300,
    temperature: 0.2,
    response_format: { type: 'json_object' },
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

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from survey vision+plants model');

  return JSON.parse(content) as SpaceVisionAndNativePlantsResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// callGroqForPlanning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a structured interior/exterior transformation plan using a GPT model.
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
 * - GPT returns an empty response
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
  const plannerPrefs: Record<string, string> | undefined = prefs
    ? Object.fromEntries(Object.entries(prefs).filter(([key]) => key !== 'style'))
    : undefined;
  const plannerContext = plannerPrefs && Object.keys(plannerPrefs).length > 0
    ? plannerPrefs
    : undefined;

  const systemPrompt = `
You are an expert ${config.persona} with 10+ years of experience designing real-world spaces.

Your job is to create a HIGH-QUALITY, PRACTICAL transformation plan based strictly on the given scene.

---

CORE DESIGN PRINCIPLES:

1. REALITY FIRST
- Base decisions ONLY on described elements.
- You MAY introduce new elements (plants, furniture, decor), but ONLY if they logically fit the space.
- Do NOT hallucinate structures (no new walls, no layout changes).

2. ADDITIVE DESIGN (VERY IMPORTANT)
- All steps must ADD or ENHANCE — never remove or redesign core structure.
- Respect existing layout, circulation, and usability.

3. SPATIAL THINKING (THIS IS CRITICAL)
Every plan MUST include:
- Focal point creation
- Layering (foreground / midground / background)
- Height variation (low / medium / tall)
- Visual balance (avoid clutter or emptiness)
- Dense planting (planting beds, not a few identical pots)
- Garden lighting (path lights, uplights, lanterns) — required for outdoor plans

4. ZONING LOGIC
Break the space into functional micro-zones:
- Primary zone (main use)
- Secondary enhancement zone
- Transition/edge areas

5. STYLE INTELLIGENCE
- NEVER use a user-requested, preferred, or client-sent style.
- Infer ONE DISTINCT garden style only from:
  - the detected space type and category (balcony, rooftop, terrace, yard, indoor room, etc.)
  - onboarding survey answers when present (sunlight, watering, climate, goal, experience)
  - region/climate/plant list when present
- Style must fit the actual area (example: a small balcony is not a luxury estate garden).
- Never default to generic "Modern" or "luxury rooftop" unless the space is actually a rooftop.
Examples of area-fit styles: ${config.styleExamples}

6. PRACTICAL EXECUTION
- Use real materials, real plants, real objects.
- Mention sizes, placement, and positioning clearly.
- Avoid vague suggestions.

7. COST-AWARE DESIGN
- Prefer smart, affordable solutions first.
- Escalate to premium only when justified.

---

OUTPUT RULES (STRICT):

Return ONLY valid JSON.

{
  "summary": "One strong, specific transformation vision",
  "style": "Inferred from space type and survey/location context only",
  "steps": [
    {
      "step": 1,
      "category": "${config.validCategories}",
      "action": "Short action title",
      "details": "Clear execution steps with placement, materials, and reasoning",
      "effort": "low | medium | high",
      "cost": "budget | moderate | premium"
    }
  ]
}

---

STEP QUALITY RULES:
- 5–7 steps total
- Order: lowest effort → highest
- NO filler steps
- For outdoor: at least one Lighting step AND dense Softscape beds (never "a few pots in a row")
- Each step must feel like a professional designer decision
`;

  const userPrompt = `
SPACE TYPE: ${detectedSpace.spaceType} (${detectedSpace.category})
DETECTION CONFIDENCE: ${detectedSpace.confidence} — ${detectedSpace.reasoning}
 
SCENE DESCRIPTION (treat this as ground truth — do not invent anything beyond it):
${sceneDescription}
 
USER PREFERENCES:
${plannerContext ? JSON.stringify(plannerContext) : 'None provided — infer style from the space type and scene only.'}
 
Do NOT treat any field as a preferred visual style. Choose style from the space type plus survey/location context only.
 
IMPORTANT: Every step must be directly informed by the scene above.
Build FROM the described baseline — do not assume anything else exists.
`;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: GPT_PLANNING_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from GPT planner');

      const plan = JSON.parse(content) as DesignPlan;
      return plan;

    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('GPT planning error:', error);
      throw new Error('Failed to generate design plan with GPT.');
    }
  }

  throw new Error('GPT planning failed after all retries.');
}

// ─────────────────────────────────────────────────────────────────────────────
// buildImagePrompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trims text to a Flux-safe length so the garden instructions are not cut off.
 *
 * @param value - Source text
 * @param maxChars - Maximum characters to keep
 * @returns Trimmed text
 */
function clipForFlux(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars).trim()}...`;
}

/**
 * Builds a compact Flux image-editing prompt for a garden transformation.
 *
 * @param plan - Generated design plan
 * @param sceneDescription - Vision model description of the original image
 * @param detectedSpace - Classified space type and category
 * @param extraPlants - Optional extra plant names (for example native plants)
 * @returns Compact garden prompt within Flux size limits
 */
export function buildImagePrompt(
  plan: DesignPlan,
  sceneDescription: string,
  detectedSpace: DetectedSpace,
  extraPlants?: string
): string {

  const isAfternoon = sceneDescription.toLowerCase().includes('afternoon');
  const lightingCondition = isAfternoon
    ? 'warm golden-hour light with long soft shadows'
    : 'natural diffused daylight with balanced exposure';

  const plants = plan.steps
    .filter(s => s.category === 'Softscape')
    .map(s => s.details.split('.')[0])
    .join(', ');

  const hardscape = plan.steps
    .filter(s => s.category === 'Hardscape')
    .map(s => s.action)
    .join(', ');

  const lighting = plan.steps
    .filter(s => s.category === 'Lighting')
    .map(s => s.action)
    .join(', ');

  const water = plan.steps
    .filter(s => s.category === 'Water Feature')
    .map(s => s.action)
    .join(', ');

  const derivedStyle = plan.style?.trim() || `${detectedSpace.spaceType} garden`;
  const plantList = clipForFlux([plants, extraPlants].filter(Boolean).join(', '), 280);
  const hardscapeList = clipForFlux(hardscape, 140);
  const lightingList = clipForFlux(lighting, 100);
  const waterList = clipForFlux(water, 80);
  const isOutdoor = detectedSpace.category === 'outdoor';

  if (isOutdoor) {
    return `Lush overflowing garden with many plants, colorful flowers, and warm garden lights. Creative ${derivedStyle} landscape, not an empty lawn with a few pots.

KEEP: building, fence, sky, camera angle.
CHANGE: fill this ${detectedSpace.spaceType} with a dense mature garden.

PLANT DENSITY (MANDATORY):
- Continuous mixed planting beds along BOTH sides, all corners, and the far end
- Dozens of plants, mixed sizes: groundcover, flowering clusters, mid shrubs, tall plants
- NO identical white pots in a straight row
- NO sparse leftover lawn in the middle with nothing else
- Flowers clearly visible: pink, yellow, orange, red, purple, white

GARDEN LIGHTS (MANDATORY, must be visible):
- Warm path bollard lights along the walkway
- Uplights on shrubs and trees
- Wall lanterns or string lights
- Soft golden evening garden glow

CREATIVITY:
- Curved or staggered stepping-stone path, not two boring parallel paver strips
- One seating nook or feature planter as a focal point
- Layered heights and varied textures

${plantList ? `Include these plants: ${plantList}.` : ''}
${hardscapeList ? `Hardscape: ${hardscapeList}.` : ''}
${lightingList ? `Lights: ${lightingList}.` : ''}
Photorealistic, ${lightingCondition}.`;
  }

  return `Lush indoor plant styling of this ${detectedSpace.spaceType}: many plants, mixed heights, warm accent lights. ${derivedStyle} look.

Keep walls, floor, windows, camera angle. Fill empty corners and unused floor.
Dense planters, trailing plants, a few flowering plants. Add warm floor lamps or plant uplights.
${plantList ? `Plants: ${plantList}.` : ''}
Photorealistic, ${lightingCondition}.`;
}


// export async function compressPromptForFlux(longPrompt: string): Promise<string> {
//   const completion = await groq.chat.completions.create({
//     model: 'llama-3.3-70b-versatile',
//     max_tokens: 500,
//     messages: [
//       {
//         role: 'system',
//         content: `You compress image generation prompts for Flux models.
// Flux has a 512 token limit.
// Rules:
// - Output ONLY the compressed prompt, no explanation
// - Keep: style, key objects, materials, lighting, mood
// - Use comma-separated dense descriptors
// - Max 500 tokens
// - Prioritize the most visually impactful instructions`
//       },
//       {
//         role: 'user',
//         content: longPrompt
//       }
//     ]
//   });

//   return completion.choices[0]?.message?.content ?? longPrompt;
// }




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
  // maskBase64: string,
  prompt: string,
  fileName: string
): Promise<string> {
  const ENDPOINT = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-max';

  const rawImageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  // const rawMaskBase64 = maskBase64.replace(/^data:image\/\w+;base64,/, '');

  // Style-first prompt: Flux weights earlier tokens more. Do not override with a generic plant-only look.
  const anchoredPrompt = `${prompt}

Photorealistic garden makeover of the original photo. Keep the same camera. Add dense plants, flowers, and visible warm garden lights.`.trim();

  const negativePrompt = `
    empty lawn, sparse plants, few plants, identical white pots in a row, only pots, no lights,
    unlit garden, barren fence, two parallel paver strips, minimal empty space,
    bare concrete, plastic turf, cgi, cartoon, new building, different camera
  `.trim();

  const submitResponse = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: rawImageBase64,
      // mask_image: rawMaskBase64,
      prompt: anchoredPrompt,
      negative_prompt: negativePrompt,
      num_inference_steps: 40,
      guidance_scale: 8.5,
      // strength: 0.75,
      num_images: 1,
      output_format: 'jpeg',
      seed: -1,
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


