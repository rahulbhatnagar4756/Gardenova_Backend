import {
  buildImagePrompt,
  callGroqForPlanning,
  callInpainting,
  callSegmentationAPI,
  callVisionForSceneDescription,
  DesignResult,
  detectSpaceType,
  uploadBufferLocal
} from './landScapeDesignRepo';
// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
 
// const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';
// const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY!;
// const SAM_ENDPOINT = process.env.WAVESPEED_SAM_URL!;
/**
 * Orchestrates the full AI design pipeline for a single image.
 *
 * Pipeline stages:
 * 1. Preprocess input image (resize, normalize, compress)
 * 2. Save original processed image locally
 * 3. Detect architectural space type (indoor/outdoor classification)
 * 4. Generate segmentation mask (floor/region detection)
 * 5. Generate structured scene description using vision LLM
 * 6. Create transformation plan using Groq LLM
 * 7. Convert plan into an inpainting prompt
 * 8. Generate final edited image using mask-guided inpainting
 *
 * The system ensures:
 * - Deterministic preprocessing (fixed resolution 1024px max)
 * - Robust fallback behavior in segmentation pipeline
 * - Strict grounding of design decisions in vision output
 * - Mask-based editing (not full image regeneration)
 *
 * @param data - Input payload containing:
 *   - image_base64: input image (base64 or data URI)
 *   - prefs: optional user design preferences
 * @param data.image_base64 - The input image to be processed, provided as a base64 string or data URI.
 * @param data.prefs - Optional user preferences that may influence design decisions (e.g., style, budget).
 * @returns A structured `DesignResult` containing:
 * - originalUrl: stored preprocessed input image
 * - gardenUrl: final inpainted result image
 * - description: vision model scene analysis
 * - detectedSpace: classified space metadata
 */
export const processDesign = async (
  data: { image_base64: string; prefs?: Record<string, string> }
): Promise<DesignResult> => {

  const { image_base64, prefs } = data;

  // ── Preprocess ────────────────────────────────────────────────────────────
  const sharp = (await import('sharp')).default;

  const matches = image_base64.match(/^data:(.+);base64,(.+)$/);
  const rawBuffer = matches?.[2]
    ? Buffer.from(matches[2], 'base64')
    : Buffer.from(image_base64, 'base64');

  const processedBuffer = await sharp(rawBuffer)
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const processedBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

  const fileName = `design-${Date.now()}`;
  const fileKey = await uploadBufferLocal(processedBuffer, `${fileName}.jpg`, 'design-uploads');
  const originalUrl = `${BASE_URL}/uploads/${fileKey}`;
  // console.log(`[1/6] Preprocessed & saved: ${originalUrl}`);

  // ── Step 1: Detect space ──────────────────────────────────────────────────
  const detectedSpace = await detectSpaceType(processedBuffer);
  // console.log(`[2/6] Space: ${detectedSpace.spaceType} (${detectedSpace.category}, ${detectedSpace.confidence}) — ${detectedSpace.reasoning}`);

  // ── Step 2: Segment (get mask) ────────────────────────────────────────────
  const { mask_base64 } = await callSegmentationAPI(processedBase64, detectedSpace.spaceType);
  // console.log(`[3/6] Mask generated`);

// ← ADD THIS DEBUG BLOCK
// const maskMatches = mask_base64.match(/^data:(.+);base64,(.+)$/);
// const maskBuffer = Buffer.from(maskMatches?.[2] ?? mask_base64, 'base64');
// const maskDebugPath = await uploadBufferLocal(maskBuffer, `debug-mask-${Date.now()}.png`, 'design-uploads');
// console.log(`[DEBUG] Mask saved: ${BASE_URL}/uploads/${maskDebugPath}`);

  // ── Step 3: Describe the scene ────────────────────────────────────────────
  const description = await callVisionForSceneDescription(processedBuffer, 'image/jpeg');
  // console.log(`[4/6] Description:\n${description}`);

  // ── Step 4: Plan the transformation ──────────────────────────────────────
  const plan = await callGroqForPlanning(description, detectedSpace, prefs);
  // console.log(`[5/6] Plan: ${plan.style} — ${plan.summary}`);

  // ── Step 5: Build editing prompt ──────────────────────────────────────────
  const imagePrompt = buildImagePrompt(plan, description);
  // console.log(`[6/6] Prompt: ${imagePrompt}`);

  // ── Step 6: Inpaint masked region only ────────────────────────────────────
  const resultUrl = await callInpainting(processedBase64, mask_base64, imagePrompt, fileName);
  // console.log(`[✅] Done: ${resultUrl}`);

  return {
    originalUrl,
    gardenUrl: resultUrl,
    description,
    detectedSpace,
  };
};