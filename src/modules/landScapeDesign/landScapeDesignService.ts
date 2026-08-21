import {
  buildImagePrompt,
  callGroqForPlanning,
  callInpainting,
  callVisionForSceneDescription,
  // compressPromptForFlux,
  DesignResult,
  NativePlantsResult,
  detectSpaceType,
  callVisionForSpaceAndNativePlants,
  callVisionForSpaceAndSurveyPlants,
  getUserSurveyAnswersForDesign,
  SurveyAnswerForDesign,
  uploadBufferLocal
} from './landScapeDesignRepo';
// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
 
// const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';

/**
 * Maps onboarding rows into the API response shape.
 *
 * @param answers - Survey question/answer pairs
 * @returns Question and answer objects for the client
 */
function toQuestionsAndAnswers(
  answers: SurveyAnswerForDesign[]
): Array<{ question: string; answer: string }> {
  return answers.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
}

/**
 * Loads onboarding Q&A for a user without failing the garden pipeline.
 *
 * @param userId - Authenticated user id
 * @param responseId - Optional survey response id
 * @returns Question/answer pairs, or an empty list
 */
async function loadQuestionsAndAnswers(
  userId: string,
  responseId?: string
): Promise<Array<{ question: string; answer: string }>> {
  try {
    const answers = await getUserSurveyAnswersForDesign(userId, responseId);
    return toQuestionsAndAnswers(answers);
  } catch {
    return [];
  }
}
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
 * - Deterministic preprocessing (fixed resolution 2048px max)
 * - Robust fallback behavior in segmentation pipeline
 * - Strict grounding of design decisions in vision output
 * - Mask-based editing (not full image regeneration)
 *
 * @param data - Input payload containing:
 *   - image_base64: input image (base64 or data URI)
 * @param data.image_base64 - The input image to be processed, provided as a base64 string or data URI.
 * @param data.userId - Authenticated user id used to load onboarding Q&A.
 * @returns A structured `DesignResult` containing:
 * - originalUrl: stored preprocessed input image
 * - gardenUrl: final inpainted result image
 * - description: vision model scene analysis
 * - detectedSpace: classified space metadata
 */
export const processDesign = async (
  data: { image_base64: string; userId: string }
): Promise<DesignResult> => {

  const { image_base64, userId } = data;

  // ── Preprocess ────────────────────────────────────────────────────────────
  const sharp = (await import('sharp')).default;

  const matches = image_base64.match(/^data:(.+);base64,(.+)$/);
  const rawBuffer = matches?.[2]
    ? Buffer.from(matches[2], 'base64')
    : Buffer.from(image_base64, 'base64');

  const processedBuffer = await sharp(rawBuffer)
  .rotate()                              // ← strips EXIF, bakes orientation into pixels
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
  // const { mask_base64 } = await callSegmentationAPI(processedBase64, detectedSpace.spaceType);
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
  const plan = await callGroqForPlanning(description, detectedSpace);
//  console.log(`[5/6] Plan: ${plan.style} — ${plan.summary}`);
  // ── Step 5: Build editing prompt ──────────────────────────────────────────
  const imagePrompt = buildImagePrompt(plan, description, detectedSpace);
  // console.log(`[6/6] Prompt: ${imagePrompt}`);
  // const compressedPrmpt = await compressPromptForFlux(imagePrompt);
  // console.log(`[6/6] Compressed Prompt: ${compressedPrmpt}`);
  // ── Step 6: Inpaint masked region only ────────────────────────────────────
  const resultUrl = await callInpainting(processedBase64,  imagePrompt, fileName);
  // console.log(`[✅] Done: ${resultUrl}`);

  const questionsAndAnswers = await loadQuestionsAndAnswers(userId);

  return {
    originalUrl,
    gardenUrl: resultUrl,
    description,
    detectedSpace,
    style: plan.style,
    questionsAndAnswers,
  };
};

export interface DesignResultWithLocation extends DesignResult {
  nativePlants: NativePlantsResult;
}

/**
 * Full single-call pipeline that combines image analysis with GPS-based
 * native plant recommendations.
 *
 * Pipeline:
 * 1. Preprocess image (resize + normalize)
 * 2. Detect space type via vision model
 * 3. Describe scene via vision model
 * 4. Lookup native/climate-appropriate plants for the given coordinates
 * 5. Generate transformation plan (grounded in scene + native plant list)
 * 6. Build inpainting prompt (plant-aware)
 * 7. Generate final garden image
 *
 * @param {object} data - Input payload
 * @param {string} data.image_base64 - Input image as base64 or data URI
 * @param {number} data.latitude - GPS latitude of the garden location
 * @param {number} data.longitude - GPS longitude of the garden location
 * @param {string} data.userId - Authenticated user id used to load onboarding Q&A
 * @returns {Promise<DesignResultWithLocation>} Location-aware design result
 */
export const processDesignWithLocation = async (data: {
  image_base64: string;
  latitude: number;
  longitude: number;
  userId: string;
}): Promise<DesignResultWithLocation> => {

  const { image_base64, latitude, longitude, userId } = data;

  // ── Preprocess ────────────────────────────────────────────────────────────
  const sharp = (await import('sharp')).default;

  const matches = image_base64.match(/^data:(.+);base64,(.+)$/);
  const rawBuffer = matches?.[2]
    ? Buffer.from(matches[2], 'base64')
    : Buffer.from(image_base64, 'base64');

  const processedBuffer = await sharp(rawBuffer)
    .rotate()
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const processedBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

  const fileName = `design-loc-${Date.now()}`;
  const fileKey = await uploadBufferLocal(processedBuffer, `${fileName}.jpg`, 'design-uploads');
  const originalUrl = `${BASE_URL}/uploads/${fileKey}`;

  // Single call: detect space + describe + native plants (lat/long).
  const combined = await callVisionForSpaceAndNativePlants(
    processedBuffer,
    latitude,
    longitude,
    'image/jpeg'
  );

  const { detectedSpace, description, nativePlants } = combined;

  // ── Build location-enriched prefs for the planner ─────────────────────────
  const plantNames = nativePlants.plants
    .map(p => `${p.commonName} (${p.latinName})`)
    .join(', ');

  const locationContext: Record<string, string> = {
    region: nativePlants.region,
    climate: nativePlants.climate,
    nativePlants: plantNames,
  };

  // ── Plan transformation (location-aware) ─────────────────────────────────
  const plan = await callGroqForPlanning(description, detectedSpace, locationContext);

  // ── Build prompt & inpaint ────────────────────────────────────────────────
  const imagePrompt = buildImagePrompt(plan, description, detectedSpace, plantNames);
  const resultUrl = await callInpainting(processedBase64, imagePrompt, fileName);

  const questionsAndAnswers = await loadQuestionsAndAnswers(userId);

  return {
    originalUrl,
    gardenUrl: resultUrl,
    description,
    detectedSpace,
    nativePlants,
    style: plan.style,
    questionsAndAnswers,
  };
};

export type DesignResultWithSurvey = Omit<DesignResult, "questionsAndAnswers"> & {
  recommendedPlants: NativePlantsResult;
};

/**
 * Full pipeline that chooses plants from onboarding survey answers, not GPS.
 *
 * @param {object} data - Input payload
 * @param {string} data.image_base64 - Input image as base64 or data URI
 * @param {string} data.userId - Authenticated user id
 * @param {string} [data.responseId] - Optional survey response id
 * @returns {Promise<DesignResultWithSurvey>} Survey-based design result
 */
export const processDesignWithSurvey = async (data: {
  image_base64: string;
  userId: string;
  responseId?: string;
}): Promise<DesignResultWithSurvey> => {

  const { image_base64, userId, responseId } = data;

  const surveyAnswers = await getUserSurveyAnswersForDesign(userId, responseId);
  if (surveyAnswers.length === 0) {
    throw new Error("No onboarding survey answers found for this user");
  }

  const sharp = (await import('sharp')).default;

  const matches = image_base64.match(/^data:(.+);base64,(.+)$/);
  const rawBuffer = matches?.[2]
    ? Buffer.from(matches[2], 'base64')
    : Buffer.from(image_base64, 'base64');

  const processedBuffer = await sharp(rawBuffer)
    .rotate()
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const processedBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

  const fileName = `design-survey-${Date.now()}`;
  const fileKey = await uploadBufferLocal(processedBuffer, `${fileName}.jpg`, 'design-uploads');
  const originalUrl = `${BASE_URL}/uploads/${fileKey}`;

  const combined = await callVisionForSpaceAndSurveyPlants(
    processedBuffer,
    surveyAnswers,
    'image/jpeg'
  );

  const { detectedSpace, description, nativePlants } = combined;
  const recommendedPlants = nativePlants;

  const plantNames = recommendedPlants.plants
    .map(p => `${p.commonName} (${p.latinName})`)
    .join(', ');

  const surveySummary = surveyAnswers
    .map((item) => `${item.question}: ${item.answer}`)
    .join(' | ');

  const surveyContext: Record<string, string> = {
    surveyAnswers: surveySummary,
    recommendedPlants: plantNames,
    climate: recommendedPlants.climate,
  };

  const plan = await callGroqForPlanning(description, detectedSpace, surveyContext);
  const imagePrompt = buildImagePrompt(plan, description, detectedSpace, plantNames);
  const resultUrl = await callInpainting(processedBase64, imagePrompt, fileName);

  return {
    originalUrl,
    gardenUrl: resultUrl,
    description,
    detectedSpace,
    recommendedPlants,
    style: plan.style,
  };
};