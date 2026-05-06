import Groq from "groq-sdk";
import fs from 'fs/promises';
import path from 'path';
import dotenv from "dotenv";
dotenv.config();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * Saves a buffer as a file in the local upload directory.
 *
 * This function:
 * 1. Ensures the target folder exists (creates it if needed)
 * 2. Writes the provided buffer to disk as a file
 * 3. Returns a relative file path that can be used for public URLs
 *
 * @async
 * @function uploadBufferLocal
 *
 * @param {Buffer} buffer - The file data to be saved
 * @param {string} fileName - Name of the file to store (including extension)
 * @param {string} folder - Subfolder inside the upload directory
 *
 * @returns {Promise<string>} Relative file path (e.g. "design-uploads/image.jpg")
 *
 * @example
 * const path = await uploadBufferLocal(buffer, "image.jpg", "design-uploads");
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
  return path.posix.join(folder, fileName); // relative path for URL
}

// ---- Types for WaveSpeed API ----
interface WaveSpeedSubmitResponse {
  code: number;
  message: string;
  data: {
    id: string;
    model: string;
    outputs: string[];
    urls: {
      get: string;                 // polling URL
    };
    status: 'created' | 'processing' | 'completed' | 'failed';
    error: string;
    executionTime: number;
  };
}

interface WaveSpeedPollResponse {
  code: number;
  message: string;
  data: {
    id: string;
    outputs: string[];             // mask URL when completed
    status: 'created' | 'processing' | 'completed' | 'failed';
    error: string;
  };
}

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY!;
const SAM_ENDPOINT = process.env.WAVESPEED_SAM_URL!;   // "https://api.wavespeed.ai/api/v3/wavespeed-ai/sam3-image"

/**
 * Calls WaveSpeed AI SAM 3 to segment an image.
 *
 * @param imageBase64 - The full base64 string, including "data:image/...;base64,..."
 * @param prompt - Text description of what to segment (default: "the landscape and garden objects")
 * @param spaceType
 * @returns The task ID and the URL of the generated mask image.
 */
export async function callSegmentationAPI(
  imageBase64: string,
  spaceType: 'balcony' | 'terrace' | 'yard' | 'rooftop' | 'generic' = 'generic'
): Promise<{ task_id: string; mask_url: string; mask_buffer: Buffer; mask_base64: string }> {

  // ✅ All under 32 chars — WaveSpeed hard limit
  const segmentationPrompts = {
    balcony: "balcony floor tiles",       // 19 ✅
    terrace: "terrace floor ground",      // 20 ✅
    yard: "lawn and open ground",      // 20 ✅
    rooftop: "rooftop floor surface",     // 21 ✅
    generic: "floor and open ground",     // 21 ✅
  };

  const prompt = segmentationPrompts[spaceType];
  // console.log(`[Segmentation] prompt: "${prompt}" (${prompt.length} chars)`);

  // ── 1. Submit ────────────────────────────────────────────
  const submitResponse = await fetch(SAM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,
      prompt,
      output_format: "png",
    }),
  });

  if (!submitResponse.ok) {
    const errorBody = await submitResponse.text();
    throw new Error(`Segmentation submit failed [${submitResponse.status}]: ${errorBody}`);
  }

  const submitData = (await submitResponse.json()) as WaveSpeedSubmitResponse;
  if (submitData.code !== 200) throw new Error(`WaveSpeed error: ${submitData.message}`);

  const taskId = submitData.data.id;
  const pollUrl = submitData.data.urls.get;
  let status = submitData.data.status;
  let attempts = 0;
  const MAX = 30;

  // ── 2. Poll ──────────────────────────────────────────────
  while (status !== 'completed' && status !== 'failed') {
    if (attempts >= MAX) throw new Error(`Segmentation timed out after ${MAX * 2}s`);

    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    const pollResponse = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
    });

    if (!pollResponse.ok) {
      const err = await pollResponse.text();
      throw new Error(`Segmentation poll failed [${pollResponse.status}]: ${err}`);
    }

    const pollData = (await pollResponse.json()) as WaveSpeedPollResponse;
    status = pollData.data.status;
    // console.log(`[Segmentation] Attempt ${attempts}: ${status}`);

    if (status === 'failed') {
      throw new Error(`Segmentation failed: ${pollData.data.error ?? 'Unknown'}`);
    }

    if (status === 'completed') {
      const maskUrl = pollData.data.outputs?.[0];
      if (!maskUrl) throw new Error('Segmentation completed but no mask URL');

      // ── 3. Download mask — ready for inpainting ──────────
      const maskRes = await fetch(maskUrl);
      if (!maskRes.ok) throw new Error(`Mask download failed [${maskRes.status}]`);

      const mask_buffer = Buffer.from(await maskRes.arrayBuffer());
      const mask_base64 = `data:image/png;base64,${mask_buffer.toString('base64')}`;

      // console.log(`[Segmentation] ✅ Done. Mask: ${mask_buffer.length} bytes`);
      return { task_id: taskId, mask_url: maskUrl, mask_buffer, mask_base64 };
    }
  }

  throw new Error('Segmentation ended with unexpected status');
}

/**
 * Generates a structured visual scene description of an image using a vision LLM.
 *
 * This function:
 * 1. Validates the input image buffer
 * 2. Converts it to a base64 data URI
 * 3. Sends it to a vision-capable LLM (Groq LLaMA vision model)
 * 4. Requests a strict, structured architectural scene analysis
 * 5. Validates the model response to ensure it actually processed the image
 *
 * The model is instructed to extract:
 * - Floor details (material, color, size, condition)
 * - Walls/railings (materials and structure)
 * - Visible objects
 * - Lighting conditions
 * - Surroundings beyond the space
 * - Overall condition/mood
 *
 * @async
 * @function callVisionForSceneDescription
 *
 * @param {Buffer} imageBuffer - Raw image buffer to analyze
 * @param {"image/jpeg" | "image/png" | "image/webp"} [mimeType="image/jpeg"] -
 * The MIME type of the input image
 *
 * @returns {Promise<string>} Structured scene description generated by the vision model
 *
 * @throws Will throw an error if:
 * - Image buffer is invalid or too small
 * - Vision model returns an empty response
 * - Model indicates it could not process the image
 */
export async function callVisionForSceneDescription(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<string> {

  if (!imageBuffer || imageBuffer.length < 1000) {
    throw new Error(`Invalid image buffer: ${imageBuffer?.length ?? 0} bytes`);
  }

  const base64Image = imageBuffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `You are a landscape architect doing a visual site assessment from a photograph.

RULES:
- Describe ONLY what is physically visible in the image.
- Make confident inferences from visual cues (light, shadows, tile count for scale).
- Do NOT say "cannot be determined" for things that ARE visible.
- Do NOT hallucinate objects not in the image.
- If the space is empty, write "No furniture or plants present." — do not invent them.

Use this exact structure. Omit a section only if truly nothing is visible:

FLOOR: [material, color, pattern, condition, estimated size from tile count]
RAILINGS & WALLS: [material, color, style, panel type, condition]
OBJECTS PRESENT: [every visible item, or "None"]
LIGHT: [direction, intensity, time-of-day from shadows]
SURROUNDINGS: [what is visible beyond the space]
CONDITION: [one sentence — overall state and mood]

Start immediately with FLOOR. No preamble. No suggestions.`;

  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",  // free vision model
    max_tokens: 700,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
  });

  const description = completion.choices[0]?.message?.content;
  if (!description) throw new Error("Empty response from Groq Vision");

  const blindPhrases = [
    "i don't have a photograph",
    "no image was provided",
    "i cannot see",
    "i'm unable to view",
  ];
  if (blindPhrases.some(p => description.toLowerCase().includes(p))) {
    throw new Error(`Groq did not process the image: "${description.slice(0, 100)}"`);
  }

  return description;
}


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// ─── Types ───────────────────────────────────────────────
export interface PlanStep {
  step: number;
  category: 'Hardscape' | 'Softscape' | 'Water Feature' | 'Lighting' | 'Maintenance';
  action: string;        // short title
  details: string;       // detailed how‑to
}

export interface GardenPlan {
  summary: string;
  style: string;   // ← add this
  steps: PlanStep[];
}

/**
 * Generates a structured landscape/garden transformation plan using an LLM.
 *
 * This function:
 * 1. Takes a detailed scene description from vision analysis
 * 2. Optionally includes user preferences (style, space type, etc.)
 * 3. Sends both to Groq LLM for deterministic garden planning
 * 4. Enforces strict JSON output format for downstream processing
 * 5. Retries automatically on rate-limit errors (exponential backoff)
 *
 * The model is strictly constrained to:
 * - Only use information present in the scene description
 * - Select a context-aware design style (not generic like "Modern")
 * - Use real plant species and realistic landscaping materials
 * - Output a structured step-by-step transformation plan
 *
 * @async
 * @function callGroqForPlanning
 *
 * @param {string} sceneDescription - Structured visual description of the space (ground truth input)
 * @param {Record<string, any>} [prefs] - Optional user preferences (e.g., garden type, budget, style hints)
 *
 * @returns {Promise<GardenPlan>} A structured garden design plan including:
 *  - summary: transformation vision
 *  - style: selected design style
 *  - steps: ordered execution plan with materials and plants
 *
 * @throws Will throw an error if:
 * - LLM response is empty or invalid JSON
 * - Rate limits persist after retries
 * - Planning generation fails for any reason
 */
export async function callGroqForPlanning(
  sceneDescription: string,
  prefs?: Record<string, string>
): Promise<GardenPlan> {

  // Build the user prompt


  const systemPrompt = `You are an expert landscape architect creating a transformation plan.

STRICT RULES:
- Base EVERY step ONLY on what is in the scene description. Never invent objects.
- Treat the space as a blank slate unless the description says otherwise.
- Steps must be additive (ADD/BUILD), not corrective, unless the description names a specific problem.

STYLE SELECTION RULES:
- NEVER default to "Modern" as a style — it is too generic and will be rejected.
- Choose a style that specifically matches the visible conditions:
  * Afternoon sun + warm tones → Mediterranean, Moroccan, or Spanish Courtyard
  * Neutral tones + minimal space → Japandi, Wabi-sabi, or Zen Minimalist
  * Urban + trees visible → Biophilic Urban, Dark Moody Botanical
  * Weathered/worn surfaces → Rustic Farmhouse, Industrial Botanical
- The style must feel like it belongs in THIS specific space, not a catalog.

SOFTSCAPE RULES:
- Always name real plant species (Latin or common), never just "succulents" or "plants".
- Match species to the light condition described (e.g. afternoon sun = drought-tolerant).
- Specify pot material, size, and placement position on the balcony.

Return ONLY valid JSON — no markdown, no extra text:
{
  "summary": "One bold sentence describing the transformation vision for THIS specific space",
  "style": "Specific named style (not 'Modern')",
  "steps": [
    {
      "step": 1,
      "category": "Hardscape | Softscape | Water Feature | Lighting | Maintenance",
      "action": "Action title (max 8 words)",
      "details": "Specific how-to: real species names, real materials, real dimensions. Min 2 sentences.",
      "effort": "low | medium | high",
      "cost": "budget | moderate | premium"
    }
  ]
}

Order steps: lowest effort first. Aim for 5-7 steps. No filler.`;

  const userPrompt = `
SCENE DESCRIPTION (treat this as ground truth — do not invent anything beyond it):
${sceneDescription}

USER PREFERENCES:
${prefs ? JSON.stringify(prefs) : 'None provided — create a general plan for this exact space.'}

IMPORTANT: Every step must be directly informed by the scene above.
If the scene describes a bare balcony with tiles and railings, your steps should build FROM that baseline — not assume anything else exists.
`;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",   // free, fast, JSON‑native
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: "json_object" },   // forces valid JSON
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from Groq");

      const parsed: GardenPlan = JSON.parse(content);
      return parsed;

    } catch (error: unknown) {
      const err = error as { status?: number };

      if (err.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error("Groq planning error:", error);
      throw new Error("Failed to generate garden plan with Groq.");
    }
  }
  throw new Error("Groq planning failed after all retries.");
}



/**
 * Builds a detailed image generation prompt for garden inpainting based on a design plan.
 *
 * This function:
 * 1. Extracts softscape, hardscape, and lighting elements from the garden plan
 * 2. Derives plant actions, materials, and lighting setup
 * 3. Infers lighting condition from scene description (e.g. afternoon vs daylight)
 * 4. Constructs a photorealistic prompt for image generation/inpainting models
 *
 * The prompt enforces:
 * - Preservation of original architecture and structure
 * - Realistic landscape transformation based on the plan
 * - High-quality photorealistic output expectations
 *
 * A negative prompt is also defined internally to discourage:
 * - Structural changes (walls, buildings, layout)
 * - Non-photorealistic styles (cartoon, illustration)
 * - Irrelevant subjects (people, animals, indoor scenes)
 *
 * @function buildImagePrompt
 *
 * @param {GardenPlan} plan - Structured garden design plan containing style and transformation steps
 * @param {string} sceneDescription - Original scene description used to infer lighting conditions
 *
 * @returns {string} Final prompt string used for image generation/inpainting models
 */
export function buildImagePrompt(plan: GardenPlan, sceneDescription: string): string {

  // Extract plant species and materials from steps
  const softscapeSteps = plan.steps.filter(s => s.category === 'Softscape');
  const hardscapeSteps = plan.steps.filter(s => s.category === 'Hardscape');
  const lightingSteps = plan.steps.filter(s => s.category === 'Lighting');

  const plants = softscapeSteps.map(s => s.action).join(', ');
  const hardscape = hardscapeSteps.map(s => s.action).join(', ');
  const lighting = lightingSteps.map(s => s.action).join(', ');

  // Detect time of day from description for lighting realism
  const isAfternoon = sceneDescription.toLowerCase().includes('afternoon');
  const lighting_condition = isAfternoon ? 'warm golden afternoon sunlight' : 'soft natural daylight';

  const prompt = [
    `A beautiful ${plan.style} balcony garden transformation,`,
    `${plants},`,
    `${hardscape},`,
    lighting ? `${lighting},` : '',
    `${lighting_condition},`,
    `lush greenery, photorealistic, high detail,`,
    `same balcony structure and architecture preserved,`,
    `professional landscape photography, 4k`,
  ].filter(Boolean).join(' ');

  // const negativePrompt = [
  //   'different building, different structure, changed walls,',
  //   'changed railing, changed floor layout,',
  //   'cartoon, illustration, low quality, blurry,',
  //   'people, animals, indoor',
  // ].join(' ');

  // console.log('Image prompt:', prompt);
  return prompt;
}


// ─── Inpainting via Hugging Face (FREE) ─────────────────────────────────────
/**
 * Uses HuggingFace Stable Diffusion Inpainting to generate the garden image.
 * - Original image: the balcony photo
 * - Mask: from WaveSpeed SAM (white = area to fill with garden)
 * - Prompt: built from the garden plan
 *
 * FREE tier: ~30 req/day. No credit card needed.
 */
// interface FalInpaintingResponse {
//   images: { url: string; content_type: string }[];
//   timings?: Record<string, number>;
//   seed?: number;
// }
const BASE_URL = process.env.APPDEV_URL || 'http://localhost:3000';


/**
 * Performs image inpainting using the WaveSpeed FLUX model to generate a garden transformation.
 *
 * This function:
 * 1. Sends the base image and generated prompt to the WaveSpeed inpainting API
 * 2. Polls the job status until completion or failure
 * 3. Retrieves the generated image from the model output
 * 4. Downloads the final image buffer
 * 5. Stores it locally and returns a public URL
 *
 * The model is configured for:
 * - High-quality photorealistic generation
 * - Controlled transformation using prompt guidance
 * - Single output image generation per request
 *
 * @async
 * @function callInpainting
 *
 * @param {string} imageBase64 - Base64 encoded input image (data URI format expected)
 * @param {string} prompt - Detailed transformation prompt for the inpainting model
 * @param {string} fileName - Base filename used for saving the generated output
 *
 * @returns {Promise<string>} Public URL of the final generated garden image
 *
 * @throws Will throw an error if:
 * - API submission fails
 * - Polling exceeds timeout limit
 * - Inpainting generation fails or returns invalid output
 */
export async function callInpainting(
  imageBase64: string,
  // mask_base64: string,
  prompt: string,
  fileName: string
): Promise<string> {

  const ENDPOINT = "https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-dev";
  // console.log(`[Inpainting] Image base64 size: ${imageBase64.length} chars`);
  // console.log(`[Inpainting] Prompt: ${prompt}`);

  const submitResponse = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,   // ✅ real base64 from pipeline
      prompt,                             // ✅ real prompt from buildImagePrompt
      num_inference_steps: 28,
      guidance_scale: 2.5,
      num_images: 1,
      output_format: "jpeg",
      seed: -1,
    }),
  });

  if (!submitResponse.ok) {
    const err = await submitResponse.text();
    throw new Error(`flux-kontext submit failed [${submitResponse.status}]: ${err}`);
  }

  const submitData = (await submitResponse.json()) as WaveSpeedSubmitResponse;
  // console.log('[Inpainting] Submit:', JSON.stringify(submitData, null, 2));
  if (submitData.code !== 200) throw new Error(`WaveSpeed error: ${submitData.message}`);

  const pollUrl = submitData.data.urls.get;
  let status = submitData.data.status;
  let attempts = 0;
  const MAX = 40;

  while (status !== 'completed' && status !== 'failed') {
    if (attempts >= MAX) throw new Error('[Inpainting] Timed out after 80s');

    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
    });
    const pollData = (await pollRes.json()) as WaveSpeedPollResponse;
    status = pollData.data.status;
    // console.log(`[Inpainting] Attempt ${attempts}: ${status}`);

    if (status === 'failed') {
      throw new Error(`[Inpainting] Failed: ${pollData.data.error ?? 'Unknown'}`);
    }

    if (status === 'completed') {
      const imageUrl = pollData.data.outputs?.[0];
      if (!imageUrl) throw new Error('[Inpainting] No output URL');
      // console.log(`[Inpainting] Raw output URL: ${imageUrl}`);

      const imgBuffer = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
      const outKey = await uploadBufferLocal(imgBuffer, `${fileName}-garden.jpg`, 'design-outputs');
      const localUrl = `${BASE_URL}/uploads/${outKey}`;

      // console.log(`[Inpainting] ✅ Done: ${localUrl}`);
      return localUrl;
    }
  }

  throw new Error('[Inpainting] Ended with unexpected status');
}