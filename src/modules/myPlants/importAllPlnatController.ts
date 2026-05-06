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

interface PlantRow {
  common_name?: string;
  scientific_name?: string;
  family?: string;
  genus?: string;
  light?: string;
  ground_humidity?: string;
  atmospheric_humidity?: string;
  soil_nutriments?: string;
  soil_salinity?: string;
  ph_minimum?: string;
  ph_maximum?: string;
  growth_rate?: string;
  growth_habit?: string;
  average_height_cm?: string;
  maximum_height_cm?: string;
  minimum_root_depth_cm?: string;
  edible?: string;
  vegetable?: string;
  flower_color?: string;
  foliage_color?: string;
  foliage_texture?: string;
  bloom_months?: string;
  growth_months?: string;
  fruit_months?: string;
  image_url?: string;
  common_names?: string;
  distributions?: string;
  growth_rate_pt?: string;
  gowth_habit_pt?: string;
  edible_pt?: string;
  vegetable_pt?: string;
  flower_color_pt?: string;
  foliage_color_pt?: string;
  foliage_texture_pt?: string;
}

/**
 * Multer configuration for handling plant data file uploads.
 *
 * - Stores files on disk under `/tmp` with a timestamped filename.
 * - Limits file size to 500 MB.
 * - Accepts only CSV or Excel files (.csv, .xls, .xlsx).
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    /**
     * Destination folder for uploaded files.
     * @param _req - Express request object (not used)
     * @param file - Uploaded file object
     * @param cb - Callback to pass the destination path
     * @returns void
     */
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  /**
   * Filename for the uploaded file.
   * Prepends current timestamp to the original filename to avoid collisions.
   * @param _req - Express request object (not used)
   * @param file - Uploaded file object
   * @param cb - Callback to pass the filename
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

/**
 * Converts a {@link PlantRow} object into a TSV line for Postgres COPY.
 * Returns `null` when the row is missing the required `scientific_name` field.
 * @param r - Parsed plant row from CSV or Excel
 * @returns TSV line string ending with `\n`, or `null` if the row should be skipped
 */
function rowToTSV(r: PlantRow): string | null {
  if (!r.scientific_name?.trim()) {
    console.error("SKIPPED ROW KEYS:", Object.keys(r));
    console.error("SKIPPED ROW SAMPLE:", JSON.stringify(r).slice(0, 300));
    return null; // scientific_name is required
  }
  return [
    toStr(r.common_name), toStr(r.scientific_name), toStr(r.family), toStr(r.genus),
    toInt(r.light), toInt(r.ground_humidity), toInt(r.atmospheric_humidity),
    toInt(r.soil_nutriments), toInt(r.soil_salinity),
    toDec(r.ph_minimum), toDec(r.ph_maximum),
    toStr(r.growth_rate), toStr(r.growth_habit),
    toInt(r.average_height_cm), toInt(r.maximum_height_cm), toInt(r.minimum_root_depth_cm),
    toBool(r.edible), toBool(r.vegetable),
    toStr(r.flower_color), toStr(r.foliage_color), toStr(r.foliage_texture),
    toStr(r.bloom_months), toStr(r.growth_months), toStr(r.fruit_months),
    toStr(r.image_url), toStr(r.common_names), toStr(r.distributions),
    toStr(r.growth_rate_pt), toStr(r.gowth_habit_pt),
    toStr(r.edible_pt), toStr(r.vegetable_pt),
    toStr(r.flower_color_pt), toStr(r.foliage_color_pt), toStr(r.foliage_texture_pt),
  ].join("\t") + "\n";
}

// ── Transform: PlantRow objects → TSV lines ───────────────────────────────

/** Tracks inserted and skipped row counts during an import run. */
interface ImportStats {
  inserted: number;
  skipped: number;
}

/**
 * Creates a Transform stream that converts PlantRow objects into TSV lines for PostgreSQL COPY.
 *
 * Each row is processed:
 * - If `scientific_name` exists, it is converted to a TSV line and pushed downstream.
 * - Updates the `stats` object with counts of inserted and skipped rows.
 *
 * @param stats - Object tracking number of inserted and skipped rows
 * @returns Transform stream that converts PlantRow objects to TSV text
 */
function makeTSVTransform(stats: ImportStats): Transform {
  return new Transform({
    objectMode: true,
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
     // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    transform(row: PlantRow, _enc, cb) {
      const line = rowToTSV(row);
      if (line) { stats.inserted++; cb(null, line); }
      else { stats.skipped++; cb(); }
    },
  });
}

// ── COPY SQL ───────────────────────────────────────────────────────────────

const COPY_SQL = `
  COPY All_plants (
    common_name, scientific_name, family, genus,
    light, ground_humidity, atmospheric_humidity,
    soil_nutriments, soil_salinity,
    ph_minimum, ph_maximum,
    growth_rate, growth_habit,
    average_height_cm, maximum_height_cm, minimum_root_depth_cm,
    edible, vegetable,
    flower_color, foliage_color, foliage_texture,
    bloom_months, growth_months, fruit_months,
    image_url, common_names, distributions,
    growth_rate_pt, gowth_habit_pt,
    edible_pt, vegetable_pt,
    flower_color_pt, foliage_color_pt, foliage_texture_pt
  ) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')
`;

// ── CSV streaming import ───────────────────────────────────────────────────

/**
 * Streams a CSV file into the `All_plants` table via Postgres COPY.
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

// ── Excel streaming import (row-by-row, never full array in memory) ────────

/**
 * Reads an Excel file and bulk-inserts its first sheet into `All_plants`
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

    const allRows: PlantRow[] = XLSX.utils.sheet_to_json<PlantRow>(ws, { defval: "" });

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
 * Express route handler for `POST /import-all-plants`.
 *
 * Accepts a single multipart file upload (CSV or Excel), streams the rows
 * into the `All_plants` table via Postgres COPY, and responds with the
 * number of inserted and skipped rows.
 *
 * @param req - Express request object containing the uploaded file
 * @param res - Express response object for sending the JSON result
 * @example
 * router.post("/import-all-plants", ...importAllPlantsHandler);
 */
export const importAllPlantsHandler = [
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

      console.error("[importAllPlants] import started");

      if (isExcel) {
        await importExcel(filePath, stats);
      } else {
        await importCSV(filePath, stats);
      }

      console.error("[importAllPlants] import finished", stats);

      res.status(200).json({ success: true, ...stats });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error.";
      console.error("[importAllPlants]", err);
      res.status(500).json({ success: false, error: message });
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  },
];