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
const REPLICATE_API_KEY = requireEnv('REPLICATE_API_KEY');

// meta/sam-2 on Replicate — pinned version for stability
const REPLICATE_SAM2_URL    = 'https://api.replicate.com/v1/predictions';
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

  // Normalise: strip prefix for sharp & Replicate; both want raw base64
  const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const inputBuffer = Buffer.from(rawBase64, 'base64');

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

4. ZONING LOGIC
Break the space into functional micro-zones:
- Primary zone (main use)
- Secondary enhancement zone
- Transition/edge areas

5. STYLE INTELLIGENCE
- NEVER use generic styles like "Modern".
- Choose a DISTINCT, CONTEXT-AWARE style.
- Style must reflect the actual space conditions.
Examples: ${config.styleExamples}

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
  "style": "Specific non-generic style",
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
- Each step must feel like a professional designer decision
`;

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

  const planSections = [
    plants    && `Softscape: ${plants}`,
    hardscape && `Hardscape: ${hardscape}`,
    lighting  && `Lighting: ${lighting}`,
    water     && `Water features: ${water}`,
  ].filter(Boolean).join('\n');

  return `
Ultra-photorealistic architectural garden transformation of an existing ${detectedSpace.spaceType}.

Transform this space into a visually rich, dense, and immersive premium garden environment.
The final result must feel like a fully developed, mature garden — NOT a minimally decorated space.

--------------------------------------------------
SCENE CONTEXT
--------------------------------------------------
${sceneDescription}

--------------------------------------------------
⚠️ STRUCTURAL PRESERVATION — ABSOLUTE
--------------------------------------------------
DO NOT modify, remove, move, redesign, or reinterpret:
- Walls, textures, paint
- Windows, doors, glass
- Railings, staircase, pergola, structures
- Floor levels or geometry
- Camera angle or perspective

Architecture must remain EXACTLY identical (pixel-preserved).
ONLY ADD garden elements layered on top.

--------------------------------------------------
🚫 SURROUNDING PROTECTION (CRITICAL)
--------------------------------------------------
- DO NOT change or reinterpret surroundings in ANY way
- Do NOT add, remove, or alter background buildings, sky, or external environment
- Do NOT extend or shrink the visible space
- Only work strictly WITHIN the existing visible boundaries

❗ Any modification outside the original space is strictly forbidden

--------------------------------------------------
🌸 FLOWER DENSITY BOOST (CRITICAL)
--------------------------------------------------
- Flower presence must be HIGH and clearly visible
- At least 40–60% of plants must include flowering species

- Distribute flowers across:
  - ground level clusters
  - mid-height shrubs
  - trailing plants on railings

- Use bold contrasting colors:
  pink, magenta, yellow, orange, red, purple

- Flowers must appear:
  - dense
  - vibrant
  - naturally spread (not isolated)

❗ Green-only foliage is NOT acceptable — flowers must dominate visually


--------------------------------------------------
🌿 GROUND TRANSFORMATION — PREMIUM TRIMMED LAWN (MANDATORY)
--------------------------------------------------
- Convert entire visible floor into a perfectly maintained natural grass lawn

- Grass must appear:
  - evenly trimmed to a consistent height
  - dense and well-maintained
  - soft and lush with fine blade detail
  - clean and professionally landscaped

- Subtle realism is still required:
  - slight tonal variation (light and dark greens)
  - natural sunlight variation across surface
  - very minor imperfections ONLY (not messy or overgrown)

- Strictly avoid:
  ❌ irregular growth
  ❌ patchy or wild grass
  ❌ dry or uneven areas
  ❌ artificial turf or plastic-like texture

- Lawn must feel like a high-end residential garden (manicured, premium quality)

- Blend edges cleanly into walls and structures
- Maintain neat boundaries around all edges

--------------------------------------------------
🔥 DENSITY ENFORCEMENT (CRITICAL RULE)
--------------------------------------------------
- Increase plant and flower presence by MINIMUM 4x, with strong floral dominance
- Empty or unused spaces are NOT allowed
- Every edge, corner, and boundary must contain greenery-mandatory
- The space must feel surrounded by plants, not empty with plants

--------------------------------------------------
🌺 EDGE & BOUNDARY ACTIVATION (VERY IMPORTANT)
--------------------------------------------------
- All wall edges must have continuous planting strips
- Corners must include dense plant clusters
- No bare perimeter lines should remain visible

--------------------------------------------------
🌿 VERTICAL GREENERY (MANDATORY)
--------------------------------------------------
- All large walls MUST include climbers or vertical planting-mandatory
- Use ivy, jasmine, creepers, or flowering vines
- Coverage must be clearly visible (not sparse)

❗ Bare walls are NOT allowed

--------------------------------------------------
🌺 RAILING / PERIMETER ZONE
--------------------------------------------------
- Fully cover railings with cascading flowering plants
- Plants must spill outward and downward naturally
- Add base shrubs or grasses at railing level
- This area must appear lush, overflowing, and continuous

--------------------------------------------------
🌼 COLOR & FLOWER DISTRIBUTION
--------------------------------------------------
- Strong visible flowering presence (NOT only foliage)
- Include contrasting colors:
  - pink / magenta
  - yellow
  - red or purple
- Flowers must be clearly visible across the scene

--------------------------------------------------
🎯 FOCAL ELEMENT (REQUIRED)
--------------------------------------------------
Include at least ONE visual anchor:
- seating area OR
- feature planter OR
- small deck OR
- garden feature

Scene must not feel empty or directionless

--------------------------------------------------
🌿 DEPTH & LAYERING (MANDATORY)
--------------------------------------------------
- Foreground: grass + low plants
- Midground: shrubs + clusters
- Background: climbers + vertical greenery

❗ Flat composition is NOT acceptable

--------------------------------------------------
🌞 LIGHTING & REALISM
--------------------------------------------------
${lightingCondition}

- Natural sunlight with soft realistic shadows
- Slight warmth
- Light interacting with leaves (subtle highlights)

--------------------------------------------------
📸 RENDER QUALITY
--------------------------------------------------
- Ultra photorealistic (NO CGI look)
- Real textures (grass, soil, leaves)
- Slight imperfections for realism
- Depth of field with subtle foreground softness
- Professional architectural photography look

--------------------------------------------------
🪨 PATHWAY INTEGRATION (MANDATORY)
--------------------------------------------------
- Introduce a natural stepping stone pathway across the grass
- Stones must:
  - be irregular in shape
  - be slightly embedded into grass
  - follow a logical walking path (not random placement)

- Spacing must feel natural and walkable
- Grass should slightly overlap stone edges for realism

❗ Path must enhance composition, not dominate the scene

--------------------------------------------------
🌿 MID-HEIGHT PLANT ENFORCEMENT (VERY IMPORTANT)
--------------------------------------------------
- Add a strong layer of medium-height plants (2–4 feet tall)
- Use shrubs, bushy plants, and compact ornamental plants
- These must fill the MIDGROUND space visually

- Avoid over-reliance on:
  ❌ only grass (too flat)
  ❌ only tall climbers (too vertical)

- Ensure smooth transition:
  low plants → medium shrubs → tall vertical greens

❗ Mid-height density is mandatory for realistic depth

--------------------------------------------------
✅ FINAL VALIDATION (STRICT)
--------------------------------------------------
Reject output if:
- Grass looks flat or artificial
- Any wall is bare
- Edges are empty
- Plants look sparse
- No focal point exists

Accept ONLY if:
- Space feels dense, lush, and immersive
- Plant coverage is visually dominant
- Garden feels mature and established
- Architecture is perfectly preserved
`.trim();
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
  const ENDPOINT = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-max';

  const rawImageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const rawMaskBase64 = maskBase64.replace(/^data:image\/\w+;base64,/, '');

  // Anchor prompt — tells model to PRESERVE the scene, only ADD plants
 const anchoredPrompt = `
  Photorealistic. Preserve all existing structures, walls, floor, railings, architecture exactly.
  Only add: potted plants, flowering plants, green foliage, small garden pots placed naturally 
  in the masked region. Same lighting, same perspective, same camera angle as original photo.
  Do not alter anything outside the masked area.
  ${prompt}
`.trim();

  const negativePrompt = `
    completely new scene, different room, different location, changed architecture,
    distorted perspective, different layout, unrealistic geometry, cartoon, painting,
    low quality, blurry, watermark, text, extra limbs
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
      guidance_scale: 15,   // ← lowered: lets model respect original image more
      // strength: 0.75,
      num_images: 4,
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


