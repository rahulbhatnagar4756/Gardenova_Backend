import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { Pool, PoolClient } from "pg";
import { getDB } from "../../core/config/db";
import { addPlantToUserService } from "./myPlantServices";
import { AddUserPlantInput } from "../../interface/myPlants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GPT_PLANT_LOOKUP_MODEL =
  process.env.GPT_PLANT_LOOKUP_MODEL ||
  process.env.GPT_PLANNING_MODEL ||
  "gpt-4.1";

const PLANT_IMAGES_DIR = path.join(process.cwd(), "plant_images");
const WIKI_USER_AGENT =
  "KasagardenBackend/1.0 (https://kasagarden.com; plant-catalog)";

interface GptPlantCare {
  watering?: string | null;
  sunlight?: string | null;
  pruning?: string | null;
}

interface GptPlantDetails {
  found?: boolean;
  common_name?: string | null;
  scientific_name?: string | null;
  other_name?: unknown;
  family?: string | null;
  genus?: string | null;
  species_epithet?: string | null;
  hybrid?: string | null;
  authority?: string | null;
  subspecies?: string | null;
  cultivar?: string | null;
  variety?: string | null;
  origin?: unknown;
  type?: string | null;
  cycle?: string | null;
  watering?: string | null;
  watering_benchmark_value?: string | number | null;
  watering_benchmark_unit?: string | null;
  sunlight?: unknown;
  hardiness_min?: string | number | null;
  hardiness_max?: string | number | null;
  dimension_type?: string | null;
  dimension_min_value?: string | number | null;
  dimension_max_value?: string | number | null;
  dimension_unit?: string | null;
  growth_rate?: string | null;
  maintenance?: string | null;
  care_level?: string | null;
  soil?: unknown;
  pruning_month?: unknown;
  propagation?: unknown;
  attracts?: unknown;
  pest_susceptibility?: unknown;
  plant_anatomy?: unknown;
  drought_tolerant?: boolean | null;
  salt_tolerant?: boolean | null;
  thorny?: boolean | null;
  invasive?: boolean | null;
  tropical?: boolean | null;
  indoor?: boolean | null;
  flowers?: boolean | null;
  flowering_season?: string | null;
  cones?: boolean | null;
  fruits?: boolean | null;
  edible_fruit?: boolean | null;
  harvest_season?: string | null;
  leaf?: boolean | null;
  edible_leaf?: boolean | null;
  seeds?: boolean | null;
  cuisine?: boolean | null;
  medicinal?: boolean | null;
  poisonous_to_humans?: boolean | null;
  poisonous_to_pets?: boolean | null;
  description?: string | null;
  care_guides_url?: string | null;
  image_url?: string | null;
  image_license?: string | null;
  care?: GptPlantCare | null;
}

export interface AddPlantByScientificNameResult {
  created_from_gpt: boolean;
  plant_id: number;
  scientific_name: string;
  common_name: string | null;
  image_url: string | null;
  local_image_path: string | null;
  user_plant: Record<string, unknown>;
}

/**
 * Flattens GPT arrays/objects into a plain TEXT column value.
 * `["part shade"]` becomes `part shade`; nested objects become `key: value`.
 *
 * @param {unknown} value - Raw GPT field.
 * @returns {string | null} Database text or null.
 */
function toDbText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const looksLikeJson =
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"));
    if (looksLikeJson) {
      try {
        return toDbText(JSON.parse(trimmed) as unknown);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toDbText(item))
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("part" in obj) {
      const part = toDbText(obj.part);
      const color = toDbText(obj.color);
      if (part && color) return `${part}: ${color}`;
      return part ?? color;
    }
    const parts = Object.entries(obj)
      .map(([key, nested]) => {
        const flat = toDbText(nested);
        return flat ? `${key}: ${flat}` : null;
      })
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }

  const str = String(value).trim();
  return str.length ? str : null;
}

/**
 * Converts mixed GPT values into a boolean column.
 *
 * @param {unknown} value - Raw GPT field.
 * @returns {boolean | null} Boolean or null.
 */
function toDbBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const str = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(str)) return true;
  if (["false", "0", "no"].includes(str)) return false;
  return null;
}

/**
 * Converts mixed GPT values into a numeric column.
 *
 * @param {unknown} value - Raw GPT field.
 * @returns {number | null} Finite number or null.
 */
function toDbNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Builds a public plant-images URL from a stored local path.
 *
 * @param {string | null} localPath - Stored local_image_path value.
 * @returns {string | null} Public URL or null.
 */
function toImageUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const filename = localPath.split("/").pop();
  const base = (process.env.APPDEV_URL || "").replace(/\/$/, "");
  return filename ? `${base}/plant-images/${filename}` : null;
}

/**
 * Finds a catalog plant by scientific name, ignoring case and accents.
 * Also matches rows that append an authority after the binomial.
 *
 * @param {Pool | PoolClient} db - Queryable pool or client.
 * @param {string} scientificName - Scientific name from the request.
 * @returns {Promise<{ id: number; scientific_name: string; common_name: string | null; local_image_path: string | null } | null>}
 */
async function findPlantByScientificName(
  db: Pool | PoolClient,
  scientificName: string
): Promise<{
  id: number;
  scientific_name: string;
  common_name: string | null;
  local_image_path: string | null;
} | null> {
  const result = await db.query(
    `
    SELECT id, scientific_name, common_name, local_image_path
    FROM plant_table_final
    WHERE unaccent(LOWER(TRIM(scientific_name))) = unaccent(LOWER(TRIM($1)))
       OR unaccent(LOWER(TRIM(scientific_name))) LIKE unaccent(LOWER(TRIM($1))) || ' %'
    ORDER BY
      CASE
        WHEN unaccent(LOWER(TRIM(scientific_name))) = unaccent(LOWER(TRIM($1))) THEN 0
        ELSE 1
      END,
      id
    LIMIT 1
    `,
    [scientificName]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: Number(row.id),
    scientific_name: row.scientific_name,
    common_name: row.common_name ?? null,
    local_image_path: row.local_image_path ?? null,
  };
}

/**
 * Calls GPT to fill every `plant_table_final` field for a scientific name.
 *
 * @param {string} scientificName - Plant scientific name.
 * @returns {Promise<GptPlantDetails>} Structured plant details.
 */
async function fetchPlantDetailsFromGpt(
  scientificName: string
): Promise<GptPlantDetails> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const completion = await openai.chat.completions.create({
    model: GPT_PLANT_LOOKUP_MODEL,
    temperature: 0.1,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a botanist. Return accurate horticultural data for a plant species as JSON only. Never invent a species; set found=false if the name is not a real plant.",
      },
      {
        role: "user",
        content: `Look up the plant with scientific name: "${scientificName}"

Return ONLY valid JSON:
{
  "found": true,
  "common_name": "string",
  "scientific_name": "accepted binomial",
  "other_name": "Bat Flower, Devil Flower, Cat's Whiskers",
  "family": "string",
  "genus": "string",
  "species_epithet": "string",
  "hybrid": null,
  "authority": "author abbreviation or null",
  "subspecies": null,
  "cultivar": null,
  "variety": null,
  "origin": "Southeast Asia, Malaysia, Thailand",
  "type": "tree|shrub|herb|vine|fern|cactus|succulent|palm|grass|flower|bulb",
  "cycle": "Perennial|Annual|Biennial|Biannual",
  "watering": "Frequent|Average|Minimum|None",
  "watering_benchmark_value": "7",
  "watering_benchmark_unit": "days",
  "sunlight": "full sun, part shade",
  "hardiness_min": "9",
  "hardiness_max": "11",
  "dimension_type": "Height",
  "dimension_min_value": 30,
  "dimension_max_value": 90,
  "dimension_unit": "cm",
  "growth_rate": "Low|Medium|High",
  "maintenance": "Low|Moderate|High",
  "care_level": "Easy|Moderate|Hard",
  "soil": "well-draining, moist",
  "pruning_month": "March, April",
  "propagation": "cuttings, division",
  "attracts": "butterflies",
  "pest_susceptibility": "spider mites, mealybugs",
  "plant_anatomy": "leaf: green",
  "drought_tolerant": false,
  "salt_tolerant": false,
  "thorny": false,
  "invasive": false,
  "tropical": true,
  "indoor": true,
  "flowers": true,
  "flowering_season": "Summer",
  "cones": false,
  "fruits": false,
  "edible_fruit": false,
  "harvest_season": null,
  "leaf": true,
  "edible_leaf": false,
  "seeds": true,
  "cuisine": false,
  "medicinal": false,
  "poisonous_to_humans": false,
  "poisonous_to_pets": false,
  "description": "2-4 sentence botanical description",
  "care_guides_url": null,
  "image_url": "direct https URL to a real Wikimedia Commons or Wikipedia image file of this species",
  "image_license": "CC BY-SA 4.0 or similar",
  "care": {
    "watering": "detailed watering instructions",
    "sunlight": "detailed sunlight instructions",
    "pruning": "detailed pruning instructions"
  }
}

Rules:
- found must be false if this is not a real plant species
- Prefer the accepted scientific name
- ALL text fields must be plain strings, never JSON arrays or objects
- If a field has multiple values, join them with commas (example: "full sun, part shade")
- image_url MUST be a direct image file URL (jpg/png/webp), preferably upload.wikimedia.org, never a wiki HTML page
- Use null for unknown fields, never empty placeholder text
- Booleans must be true or false`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from GPT plant lookup");
  }

  try {
    return JSON.parse(content) as GptPlantDetails;
  } catch {
    throw new Error("Failed to parse GPT plant details");
  }
}

/**
 * Turns a Commons File: page URL into a direct file URL.
 *
 * @param {string} url - Image or wiki URL.
 * @returns {string} Direct-download URL when possible.
 */
function toDirectImageUrl(url: string): string {
  const fileMatch = url.match(/wiki\/File:(.+)$/i);
  if (fileMatch?.[1]) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileMatch[1]}`;
  }
  return url;
}

/**
 * Downloads a remote image with a Wikipedia-friendly User-Agent.
 *
 * @param {string} imageUrl - Public image URL.
 * @returns {Promise<Buffer | null>} Image bytes, or null if download fails.
 */
async function downloadImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(toDirectImageUrl(imageUrl), {
      redirect: "follow",
      headers: {
        "User-Agent": WIKI_USER_AGENT,
        Accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1024) return null;
    return buffer;
  } catch {
    return null;
  }
}

/**
 * Looks up a Wikipedia page thumbnail for the scientific name.
 *
 * @param {string} scientificName - Plant scientific name.
 * @returns {Promise<string | null>} Original image URL or null.
 */
async function fetchWikipediaImageUrl(
  scientificName: string
): Promise<string | null> {
  const titles = [
    scientificName,
    scientificName.replace(/\s+/g, "_"),
    scientificName.split(/\s+/).slice(0, 2).join("_"),
  ];

  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const response = await fetch(url, {
        headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as {
        originalimage?: { source?: string };
        thumbnail?: { source?: string };
      };
      const source = data.originalimage?.source || data.thumbnail?.source;
      if (source) return source;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Saves an image buffer under plant_images and returns the stored relative path.
 *
 * @param {Buffer} buffer - Image bytes.
 * @param {string} scientificName - Used to name the file.
 * @param {string} sourceUrl - Source URL, used to pick an extension.
 * @returns {Promise<string>} Relative path stored in local_image_path.
 */
async function savePlantImage(
  buffer: Buffer,
  scientificName: string,
  sourceUrl: string
): Promise<string> {
  await fs.mkdir(PLANT_IMAGES_DIR, { recursive: true });

  let extFromUrl = ".jpg";
  try {
    extFromUrl = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  } catch {
    extFromUrl = ".jpg";
  }
  const ext = [".jpg", ".jpeg", ".png", ".webp"].includes(extFromUrl)
    ? extFromUrl === ".jpeg"
      ? ".jpg"
      : extFromUrl
    : ".jpg";

  const safeName = scientificName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 60) || "plant";
  const filename = `${safeName}_${Date.now()}${ext}`;
  await fs.writeFile(path.join(PLANT_IMAGES_DIR, filename), buffer);
  return `plant_images/${filename}`;
}

/**
 * Resolves a plant photo: GPT URL first, Wikipedia thumbnail as fallback.
 *
 * @param {string} scientificName - Plant scientific name.
 * @param {string | null | undefined} gptImageUrl - Image URL from GPT.
 * @returns {Promise<{ localPath: string | null; sourceUrl: string | null }>}
 */
async function resolvePlantImage(
  scientificName: string,
  gptImageUrl?: string | null
): Promise<{ localPath: string | null; sourceUrl: string | null }> {
  if (gptImageUrl && /^https?:\/\//i.test(gptImageUrl)) {
    const buffer = await downloadImage(gptImageUrl);
    if (buffer) {
      const localPath = await savePlantImage(buffer, scientificName, gptImageUrl);
      return { localPath, sourceUrl: gptImageUrl };
    }
  }

  const wikiUrl = await fetchWikipediaImageUrl(scientificName);
  if (wikiUrl) {
    const buffer = await downloadImage(wikiUrl);
    if (buffer) {
      const localPath = await savePlantImage(buffer, scientificName, wikiUrl);
      return { localPath, sourceUrl: wikiUrl };
    }
  }

  return { localPath: null, sourceUrl: gptImageUrl || wikiUrl || null };
}

/**
 * Inserts a GPT-filled row into plant_table_final and plant_care_table.
 *
 * @param {PoolClient} client - Transaction client.
 * @param {GptPlantDetails} details - Structured plant data.
 * @param {string} scientificName - Requested scientific name.
 * @param {string | null} localImagePath - Saved image path.
 * @param {string | null} sourceImageUrl - Remote image URL.
 * @returns {Promise<number>} New plant id.
 */
async function insertCatalogPlant(
  client: PoolClient,
  details: GptPlantDetails,
  scientificName: string,
  localImagePath: string | null,
  sourceImageUrl: string | null
): Promise<number> {
  const result = await client.query(
    `
    INSERT INTO plant_table_final (
      id, common_name, scientific_name, other_name,
      family, genus, species_epithet, hybrid, authority,
      subspecies, cultivar, variety, origin, type, cycle,
      watering, watering_benchmark_value, watering_benchmark_unit,
      sunlight, hardiness_min, hardiness_max,
      dimension_type, dimension_min_value, dimension_max_value, dimension_unit,
      growth_rate, maintenance, care_level, soil,
      pruning_month, propagation, attracts, pest_susceptibility, plant_anatomy,
      drought_tolerant, salt_tolerant, thorny, invasive, tropical, indoor,
      flowers, flowering_season, cones, fruits, edible_fruit, harvest_season,
      leaf, edible_leaf, seeds, cuisine, medicinal,
      poisonous_to_humans, poisonous_to_pets,
      description, care_guides_url,
      image_original_url, image_regular_url, image_medium_url,
      image_small_url, image_thumbnail, image_license,
      local_image_path
    )
    SELECT
      COALESCE((SELECT MAX(id) FROM plant_table_final), 0) + 1,
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
      $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
      $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56,
      $57, $58, $59, $60, $61
    RETURNING id
    `,
    [
      toDbText(details.common_name) ?? scientificName,
      toDbText(details.scientific_name) ?? scientificName,
      toDbText(details.other_name),
      toDbText(details.family),
      toDbText(details.genus),
      toDbText(details.species_epithet),
      toDbText(details.hybrid),
      toDbText(details.authority),
      toDbText(details.subspecies),
      toDbText(details.cultivar),
      toDbText(details.variety),
      toDbText(details.origin),
      toDbText(details.type),
      toDbText(details.cycle),
      toDbText(details.watering),
      toDbText(details.watering_benchmark_value),
      toDbText(details.watering_benchmark_unit),
      toDbText(details.sunlight),
      toDbText(details.hardiness_min),
      toDbText(details.hardiness_max),
      toDbText(details.dimension_type),
      toDbNumber(details.dimension_min_value),
      toDbNumber(details.dimension_max_value),
      toDbText(details.dimension_unit),
      toDbText(details.growth_rate),
      toDbText(details.maintenance),
      toDbText(details.care_level),
      toDbText(details.soil),
      toDbText(details.pruning_month),
      toDbText(details.propagation),
      toDbText(details.attracts),
      toDbText(details.pest_susceptibility),
      toDbText(details.plant_anatomy),
      toDbBool(details.drought_tolerant),
      toDbBool(details.salt_tolerant),
      toDbBool(details.thorny),
      toDbBool(details.invasive),
      toDbBool(details.tropical),
      toDbBool(details.indoor),
      toDbBool(details.flowers),
      toDbText(details.flowering_season),
      toDbBool(details.cones),
      toDbBool(details.fruits),
      toDbBool(details.edible_fruit),
      toDbText(details.harvest_season),
      toDbBool(details.leaf),
      toDbBool(details.edible_leaf),
      toDbBool(details.seeds),
      toDbBool(details.cuisine),
      toDbBool(details.medicinal),
      toDbBool(details.poisonous_to_humans),
      toDbBool(details.poisonous_to_pets),
      toDbText(details.description),
      toDbText(details.care_guides_url),
      sourceImageUrl,
      sourceImageUrl,
      sourceImageUrl,
      sourceImageUrl,
      sourceImageUrl,
      toDbText(details.image_license),
      localImagePath,
    ]
  );

  const plantId = Number(result.rows[0].id);

  await client.query(
    `
    INSERT INTO plant_care_table (plant_id, watering, sunlight, pruning)
    VALUES ($1, $2, $3, $4)
    `,
    [
      plantId,
      toDbText(details.care?.watering) ?? toDbText(details.watering),
      toDbText(details.care?.sunlight) ?? toDbText(details.sunlight),
      toDbText(details.care?.pruning),
    ]
  );

  return plantId;
}

/**
 * Adds a plant to the user's collection by scientific name.
 * Uses the catalog when the species already exists; otherwise GPT fills
 * `plant_table_final`, the image is downloaded locally, then the plant is linked.
 *
 * @param {string} userId - Authenticated user UUID.
 * @param {string} scientificName - Scientific name from the request body.
 * @returns {Promise<AddPlantByScientificNameResult>} Added plant payload.
 */
export const addPlantByScientificNameService = async (
  userId: string,
  scientificName: string
): Promise<AddPlantByScientificNameResult> => {
  const pool = getDB();
  const name = scientificName.trim();

  const existing = await findPlantByScientificName(pool, name);
  if (existing) {
    const userPlant = await addPlantToUserService(userId, {
      plant_id: existing.id,
    } as AddUserPlantInput);

    return {
      created_from_gpt: false,
      plant_id: existing.id,
      scientific_name: existing.scientific_name,
      common_name: existing.common_name,
      image_url: toImageUrl(existing.local_image_path),
      local_image_path: existing.local_image_path,
      user_plant: userPlant,
    };
  }

  const details = await fetchPlantDetailsFromGpt(name);
  if (details.found === false) {
    throw new Error("Plant not found");
  }

  const acceptedName = (toDbText(details.scientific_name) ?? name).trim();
  const { localPath, sourceUrl } = await resolvePlantImage(
    acceptedName,
    details.image_url
  );

  const client = await pool.connect();
  let plantId: number;
  let createdFromGpt = true;
  let commonName = toDbText(details.common_name);
  let storedName = acceptedName;
  let storedImagePath = localPath;

  try {
    await client.query("BEGIN");

    const raced = await findPlantByScientificName(client, name);
    const racedAccepted =
      acceptedName !== name
        ? await findPlantByScientificName(client, acceptedName)
        : null;
    const catalogHit = raced ?? racedAccepted;

    if (catalogHit) {
      createdFromGpt = false;
      plantId = catalogHit.id;
      commonName = catalogHit.common_name;
      storedName = catalogHit.scientific_name;
      storedImagePath = catalogHit.local_image_path;
    } else {
      plantId = await insertCatalogPlant(
        client,
        details,
        acceptedName,
        localPath,
        sourceUrl
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const userPlant = await addPlantToUserService(userId, {
    plant_id: plantId,
  } as AddUserPlantInput);

  return {
    created_from_gpt: createdFromGpt,
    plant_id: plantId,
    scientific_name: storedName,
    common_name: commonName,
    image_url: toImageUrl(storedImagePath),
    local_image_path: storedImagePath,
    user_plant: userPlant,
  };
};
