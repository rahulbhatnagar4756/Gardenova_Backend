import sharp from 'sharp';
// import { getSignedFileUrl, uploadBufferToS3 } from '../../core/services/s3UploadService';
import { buildImagePrompt, callGroqForPlanning, callInpainting, callVisionForSceneDescription, uploadBufferLocal } from './landScapeDesignRepo';
// const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';
const BASE_URL = process.env.APPDEV_URL 
export interface DesignResult {
  originalUrl:    string;   // saved input image
  gardenUrl:      string;   // AI-generated garden image
  // maskUrl:        string;   // segmentation mask
  description:    string;   // scene analysis
}
/**
 * Processes an uploaded image and generates a garden design based on user preferences.
 *
 * Pipeline steps:
 * 1. Decodes and preprocesses the base64 image (resize + compress)
 * 2. Stores the processed image locally
 * 3. Calls segmentation API to generate a mask for editable regions
 * 4. Uses vision model to describe the scene
 * 5. Generates a garden plan using LLM (based on description + preferences)
 * 6. Performs inpainting to create the final garden design image
 *
 * @param {Object} data - Input data object
 * @param {string} data.image_base64 - Base64 encoded image (with or without data URI prefix)
 * @param {Record<string, any>} [data.prefs] - Optional user preferences (e.g., style, space_type)
 *
 * @returns {Promise<DesignResult>} Resolves with:
 *  - originalUrl {string}: URL of the uploaded original image
 *  - gardenUrl {string}: URL of the generated garden design image
 *  - description {string}: AI-generated description of the input scene
 *
 * @throws Will throw an error if any processing step fails (image processing, API calls, or upload)
 */
export const processDesign = async (
  data: { image_base64: string; prefs?: Record<string, string> }
): Promise<DesignResult> => {

  const { image_base64, prefs } = data;

  const matches   = image_base64.match(/^data:(.+);base64,(.+)$/);
  const rawBuffer = matches?.[2]
    ? Buffer.from(matches[2], 'base64')
    : Buffer.from(image_base64, 'base64');

  const processedBuffer = await sharp(rawBuffer)
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const processedBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
  // console.log(`[1/6] Preprocessed: ${processedBuffer.length} bytes`);

  const fileName    = `design-${Date.now()}`;
  const fileKey     = await uploadBufferLocal(processedBuffer, `${fileName}.jpg`, 'design-uploads');
  const originalUrl = `${BASE_URL}/uploads/${fileKey}`;
  // console.log(`[2/6] Saved: ${originalUrl}`);

  // const spaceType = prefs?.space_type ?? 'generic';
  // const { mask_url, mask_base64 } = await callSegmentationAPI(processedBase64, spaceType);
  // // console.log(`[3/6] Mask: ${mask_url}`);

  const description = await callVisionForSceneDescription(processedBuffer, "image/jpeg");
  // console.log(`[4/6] Description:\n${description}`);

  const plan = await callGroqForPlanning(description, prefs);
  // console.log(`[5/6] Plan: ${plan.style} — ${plan.summary}`);

  const imagePrompt = buildImagePrompt(plan, description);
  const gardenUrl   = await callInpainting(processedBase64, imagePrompt, fileName);
  // console.log(`[6/6] Garden image: ${gardenUrl}`);

  return { originalUrl, gardenUrl, description };
};