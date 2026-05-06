import { Request, Response } from "express";
import multer from "multer";
import csvParser from "csv-parser";
import * as XLSX from "xlsx";
import fs from "fs";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { from as copyFrom } from "pg-copy-streams";
import { connectDB } from "../../core/config/db";

// ── Types ──────────────────────────────────────────────────────────────────

interface PlantCareRow {
  common_name?: string;
  scientific_name?: string;
  family?: string;
  genus?: string;
  watering?: string;
  sunlight?: string;
  care_level?: string;
  growth_rate?: string;
  indoor?: string;
  temperature_min?: string;
  temperature_max?: string;
  humidity_min?: string;
  humidity_max?: string;
  light_min?: string;
  light_max?: string;
  soil_moisture_min?: string;
  soil_moisture_max?: string;
  poisonous_to_humans?: string;
  poisonous_to_pets?: string;
  drought_tolerant?: string;
  tropical?: string;
  medical?: string;
  edible?: string;
  soil?: string;
  fertilizer?: string;
  pruning?: string;
  cycle?: string;
  pest?: string;
  diseases?: string;
  origin?: string;
  category?: string;
  climate?: string;
  color?: string;
  blooming?: string;
  description?: string;
  image_url?: string;
  source?: string;
  common_name_pt?: string;
  watering_pt?: string;
  sunlight_pt?: string;
  care_level_pt?: string;
  growth_rate_pt?: string;
  indoor_pt?: string;
  soil_pt?: string;
  fertilizer_pt?: string;
  pruning_pt?: string;
  cycle_pt?: string;
  climate_pt?: string;
  poisonous_to_humans_pt?: string;
  poisonous_to_pets_pt?: string;
  drought_tolerant_pt?: string;
  tropical_pt?: string;
  medical_pt?: string;
  edible_pt?: string;
  brazil_region?: string;
  description_pt?: string;
  temperature_source?: string;
  fertilizer_source?: string;
  description_source?: string;
}

/** Tracks inserted and skipped row counts during an import run. */
interface ImportStats {
  inserted: number;
  skipped: number;
}

// ── Multer – disk only, never memory ──────────────────────────────────────

/**
 * Multer configuration for handling plant-care file uploads.
 *
 * - Stores files on disk under `/tmp` with a timestamped filename.
 * - Limits file size to 500 MB.
 * - Accepts only CSV or Excel files (.csv, .xls, .xlsx).
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    /**
     * Generates a collision-safe filename by prepending the current timestamp.
     * @param _req - Express request object (not used)
     * @param file - Uploaded file metadata
     * @param cb - Callback to pass the resolved filename
     * @returns void
     */
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  /**
   * Rejects uploads whose extension is not `.csv`, `.xls`, or `.xlsx`.
   * @param _req - Express request object (not used)
   * @param file - Uploaded file metadata
   * @param cb - Callback to accept or reject the file
   * @returns void
   */
  fileFilter: (_req, file, cb) => {
    const validExt = /\.(csv|xls|xlsx)$/i.test(file.originalname);
    validExt ? cb(null, true) : cb(new Error("Only CSV / Excel files accepted."));
  },
});

// ── TSV coercions (Postgres COPY format) ──────────────────────────────────

/** NULL sentinel used by Postgres COPY text format. */
const N = "\\N";

/**
 * Escapes special characters for Postgres COPY text format.
 * @param s - Raw string value
 * @returns Escaped string safe for TSV COPY ingestion
 */
const esc = (s: string): string =>
  s.replace(/\\/g, "\\\\")
   .replace(/\t/g, "\\t")
   .replace(/\n/g, "\\n")
   .replace(/\r/g, "\\r");

/**
 * Coerces an optional string value to a TSV-safe string or NULL sentinel.
 * @param v - Raw value from the parsed row
 * @returns Escaped string, or `\\N` if blank
 */
const toStr = (v?: string): string => { const s = v?.trim(); return s ? esc(s) : N; };

/**
 * Coerces an optional string to an integer string or NULL sentinel.
 * @param v - Raw value from the parsed row
 * @returns Integer string, or `\\N` if not parseable
 */
const toInt = (v?: string): string => { const n = parseInt(v ?? "", 10); return isNaN(n) ? N : String(n); };

/**
 * Coerces an optional string to a decimal string or NULL sentinel.
 * @param v - Raw value from the parsed row
 * @returns Decimal string, or `\\N` if not parseable
 */
const toDec = (v?: string): string => { const n = parseFloat(v ?? ""); return isNaN(n) ? N : String(n); };

/**
 * Coerces an optional string to a boolean string or NULL sentinel.
 * @param v - Raw value from the parsed row
 * @returns `"true"`, `"false"`, or `\\N` if blank
 */
const toBool = (v?: string): string => {
  if (!v?.trim()) return N;
  return ["true", "1", "yes", "sim"].includes(v.trim().toLowerCase()) ? "true" : "false";
};

// ── Row → TSV line ─────────────────────────────────────────────────────────

/**
 * Converts a {@link PlantCareRow} into a TSV line for Postgres COPY.
 * Returns `null` when the required `scientific_name` field is missing.
 * @param r - Parsed plant-care row from CSV or Excel
 * @returns TSV line string ending with `\n`, or `null` if the row should be skipped
 */
function rowToTSV(r: PlantCareRow): string | null {
  if (!r.scientific_name?.trim()) return null;

  return [
    toStr(r.common_name),
    toStr(r.scientific_name),
    toStr(r.family),
    toStr(r.genus),
    toStr(r.watering),
    toStr(r.sunlight),
    toStr(r.care_level),
    toStr(r.growth_rate),
    toStr(r.indoor),
    toDec(r.temperature_min),
    toInt(r.temperature_max),
    toInt(r.humidity_min),
    toInt(r.humidity_max),
    toInt(r.light_min),
    toInt(r.light_max),
    toInt(r.soil_moisture_min),
    toInt(r.soil_moisture_max),
    toBool(r.poisonous_to_humans),
    toBool(r.poisonous_to_pets),
    toBool(r.drought_tolerant),
    toBool(r.tropical),
    toBool(r.medical),
    toBool(r.edible),
    toStr(r.soil),
    toStr(r.fertilizer),
    toStr(r.pruning),
    toStr(r.cycle),
    toStr(r.pest),
    toStr(r.diseases),
    toStr(r.origin),
    toStr(r.category),
    toStr(r.climate),
    toStr(r.color),
    toStr(r.blooming),
    toStr(r.description),
    toStr(r.image_url),
    toStr(r.source),
    toStr(r.common_name_pt),
    toStr(r.watering_pt),
    toStr(r.sunlight_pt),
    toStr(r.care_level_pt),
    toStr(r.growth_rate_pt),
    toStr(r.indoor_pt),
    toStr(r.soil_pt),
    toStr(r.fertilizer_pt),
    toStr(r.pruning_pt),
    toStr(r.cycle_pt),
    toStr(r.climate_pt),
    toStr(r.poisonous_to_humans_pt),
    toStr(r.poisonous_to_pets_pt),
    toStr(r.drought_tolerant_pt),
    toStr(r.tropical_pt),
    toStr(r.medical_pt),
    toStr(r.edible_pt),
    toStr(r.brazil_region),
    toStr(r.description_pt),
    toStr(r.temperature_source),
    toStr(r.fertilizer_source),
    toStr(r.description_source),
  ].join("\t") + "\n";
}

// ── Transform: row objects → TSV lines ────────────────────────────────────

/**
 * Creates a Node.js Transform stream that converts {@link PlantCareRow} objects
 * into TSV-formatted lines suitable for Postgres COPY FROM STDIN.
 * @param stats - Mutable counters incremented as rows are processed
 * @returns A Transform stream in object-write / string-read mode
 */
function makeTSVTransform(stats: ImportStats): Transform {
  return new Transform({
    writableObjectMode: true,
    readableObjectMode: false,
    /**
     * Transform function called for each `PlantRow` object.
     *
     * Converts the row to a TSV line using `rowToTSV`.
     * - If valid, pushes the line downstream and increments `stats.inserted`.
     * - If invalid/missing `scientific_name`, skips the row and increments `stats.skipped`.
     *
     * @param row - A single `PlantRow` object from the input stream
     * @param _enc - Encoding (ignored, required by Transform interface)
     * @param cb - Callback to signal completion or push data
     *  @returns void
     */
    transform(row: PlantCareRow, _enc, cb):void {
      const line = rowToTSV(row);
      if (line) { stats.inserted++; cb(null, line); }
      else { stats.skipped++; cb(); }
    },
  });
}

// ── COPY SQL ───────────────────────────────────────────────────────────────

const COPY_SQL = `
  COPY plant_care (
    common_name, scientific_name, family, genus,
    watering, sunlight, care_level, growth_rate, indoor,
    temperature_min, temperature_max,
    humidity_min, humidity_max,
    light_min, light_max,
    soil_moisture_min, soil_moisture_max,
    poisonous_to_humans, poisonous_to_pets,
    drought_tolerant, tropical, medical, edible,
    soil, fertilizer, pruning, cycle,
    pest, diseases, origin, category, climate, color, blooming,
    description, image_url, source,
    common_name_pt, watering_pt, sunlight_pt, care_level_pt,
    growth_rate_pt, indoor_pt, soil_pt, fertilizer_pt,
    pruning_pt, cycle_pt, climate_pt,
    poisonous_to_humans_pt, poisonous_to_pets_pt,
    drought_tolerant_pt, tropical_pt, medical_pt, edible_pt,
    brazil_region, description_pt,
    temperature_source, fertilizer_source, description_source
  ) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')
`;

// ── CSV streaming import ───────────────────────────────────────────────────

/**
 * Streams a CSV file into `plant_care` via Postgres COPY.
 * Uses a pipeline of: file read → CSV parse → TSV transform → COPY stream.
 * @param filePath - Absolute path to the uploaded CSV file
 * @param stats - Mutable counters updated with inserted/skipped row counts
 * @returns Promise that resolves when the pipeline completes
 */
async function importCSV(filePath: string, stats: ImportStats): Promise<void> {
  const pool = await connectDB();
  const client = await pool.connect?.() ?? pool;
  try {
    const copyStream = client.query(copyFrom(COPY_SQL));
    const tsvTransform = makeTSVTransform(stats);
    await pipeline(
      fs.createReadStream(filePath),
      csvParser(),
      tsvTransform,
      copyStream,
    );
  } finally {
    client.release?.();
  }
}

// ── Excel streaming import ─────────────────────────────────────────────────

/**
 * Reads an Excel file and bulk-inserts its first sheet into `plant_care`
 * via Postgres COPY, flushing data in chunks of 1 000 rows to control memory.
 * @param filePath - Absolute path to the uploaded `.xls` / `.xlsx` file
 * @param stats - Mutable counters updated with inserted/skipped row counts
 * @returns Promise that resolves when all rows have been written and the COPY stream finishes
 */
async function importExcel(filePath: string, stats: ImportStats): Promise<void> {
  const pool = await connectDB();
  const client = await pool.connect?.() ?? pool;

  try {
    const copyStream = client.query(copyFrom(COPY_SQL));

    const wb = XLSX.readFile(filePath, { dense: false, cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("Excel file has no sheets.");
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`Sheet "${sheetName}" not found.`);

    const allRows = XLSX.utils.sheet_to_json<PlantCareRow>(ws, { defval: "" });

    const CHUNK = 1000;
    let tsvBuffer = "";

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row) continue;

      const line = rowToTSV(row);
      if (line) { tsvBuffer += line; stats.inserted++; }
      else { stats.skipped++; }

      if ((i + 1) % CHUNK === 0 || i === allRows.length - 1) {
        if (tsvBuffer) {
          const canContinue = copyStream.write(tsvBuffer);
          tsvBuffer = "";
          if (!canContinue) await new Promise(r => copyStream.once("drain", r));
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      copyStream.end();
      copyStream.on("finish", resolve);
      copyStream.on("error", reject);
    });
  } finally {
    client.release?.();
  }
}

// ── Route handler ──────────────────────────────────────────────────────────
/**
 * Express route handler for `POST /import-plant-care`.
 *
 * Accepts a single multipart file upload (CSV or Excel), streams the rows
 * into the `plant_care` table via Postgres COPY, and responds with the
 * number of inserted and skipped rows.
 *
 * @param req - Express request object containing the uploaded file
 * @param res - Express response object used to send the JSON result
 *
 * @example
 * router.post("/import-plant-care", ...importPlantCareHandler);
 */
export const importPlantCareHandler = [
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const filePath = (req.file as Express.Multer.File | undefined)?.path;

    try {
      if (!req.file || !filePath) {
        res.status(400).json({ success: false, error: "No file uploaded." });
        return;
      }

      const isExcel = /\.xlsx?$/i.test(req.file.originalname);
      const stats: ImportStats = { inserted: 0, skipped: 0 };

      console.error("[importPlantCare] import started");

      if (isExcel) {
        await importExcel(filePath, stats);
      } else {
        await importCSV(filePath, stats);
      }

      console.error("[importPlantCare] import finished", stats);

      res.status(200).json({ success: true, ...stats });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error.";
      console.error("[importPlantCare]", err);
      res.status(500).json({ success: false, error: message });
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  },
];