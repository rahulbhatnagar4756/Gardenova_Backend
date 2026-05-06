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

interface PlantToxicRow {
  popular_name_en?: string;
  popular_name_pt?: string;
  scientific_name?: string;
  family?: string;
  other_names?: string;
  toxic_dogs?: string;
  toxic_cats?: string;
  toxic_horse?: string;
  pet_friendly?: string;
  severity?: string;
  severity_source?: string;
  toxic_principle?: string;
  toxic_principle_pt?: string;
  clinical_symptoms?: string;
  clinical_symptoms_pt?: string;
  origin?: string;
}

/** Tracks inserted and skipped row counts during an import run. */
interface ImportStats {
  inserted: number;
  skipped: number;
}

// ── Multer ─────────────────────────────────────────────────────────────────

/**
 * Multer configuration for handling toxic-plant file uploads.
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
  limits: { fileSize: 500 * 1024 * 1024 },
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

// ── TSV coercions ──────────────────────────────────────────────────────────

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

// ── Row → TSV line ─────────────────────────────────────────────────────────

/**
 * Converts a {@link PlantToxicRow} into a TSV line for Postgres COPY.
 * Returns `null` when the required `scientific_name` field is missing.
 * @param r - Parsed plant-toxic row from CSV or Excel
 * @returns TSV line string ending with `\n`, or `null` if the row should be skipped
 */
function rowToTSV(r: PlantToxicRow): string | null {
  if (!r.scientific_name?.trim()) {
    console.error("SKIPPED:", JSON.stringify(r));
    return null;
  }

  return [
    toStr(r.popular_name_en),
    toStr(r.popular_name_pt),
    toStr(r.scientific_name),
    toStr(r.family),
    toStr(r.other_names),
    toStr(r.toxic_dogs),
    toStr(r.toxic_cats),
    toStr(r.toxic_horse),
    toStr(r.pet_friendly),
    toStr(r.severity),
    toStr(r.severity_source),
    toStr(r.toxic_principle),
    toStr(r.toxic_principle_pt),
    toStr(r.clinical_symptoms),
    toStr(r.clinical_symptoms_pt),
    toStr(r.origin),
  ].join("\t") + "\n";
}

// ── Transform: row objects → TSV lines ────────────────────────────────────

/**
 * Creates a Node.js Transform stream that converts {@link PlantToxicRow} objects
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
    transform(row: PlantToxicRow, _enc, cb):void {
      const line = rowToTSV(row);
      if (line) { stats.inserted++; cb(null, line); }
      else { stats.skipped++; cb(); }
    },
  });
}

// ── COPY SQL ───────────────────────────────────────────────────────────────

const COPY_SQL = `
  COPY plant_toxic_to_pets (
    popular_name_en, popular_name_pt,
    scientific_name, family, other_names,
    toxic_dogs, toxic_cats, toxic_horse, pet_friendly,
    severity, severity_source,
    toxic_principle, toxic_principle_pt,
    clinical_symptoms, clinical_symptoms_pt,
    origin
  ) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')
`;

// ── CSV streaming import ───────────────────────────────────────────────────

/**
 * Streams a CSV file into `plant_toxic_to_pets` via Postgres COPY.
 * Uses a pipeline of: file read → CSV parse → TSV transform → COPY stream.
 * @param filePath - Absolute path to the uploaded CSV file
 * @param stats - Mutable counters updated with inserted/skipped row counts
 * @returns Promise that resolves when the pipeline completes
 */
async function importCSV(filePath: string, stats: ImportStats): Promise<void> {
  const pool = await connectDB();
  const client = await pool.connect?.() ?? pool;
  try {
    await pipeline(
      fs.createReadStream(filePath),
      csvParser(),
      makeTSVTransform(stats),
      client.query(copyFrom(COPY_SQL)),
    );
  } finally {
    client.release?.();
  }
}

// ── Excel streaming import ─────────────────────────────────────────────────

/**
 * Reads an Excel file and bulk-inserts its first sheet into `plant_toxic_to_pets`
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

    const allRows = XLSX.utils.sheet_to_json<PlantToxicRow>(ws, { defval: "" });
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
 * Express route handler for `POST /import-plant-toxic-to-pets`.
 *
 * Accepts a single multipart file upload (CSV or Excel), streams the rows
 * into the `plant_toxic_to_pets` table via Postgres COPY, and responds with
 * the number of inserted and skipped rows.
 *
 * @param req - Express request object containing the uploaded file
 * @param res - Express response object for sending the JSON result
 *
 * @example
 * router.post("/import-plant-toxic-to-pets", ...importPlantToxicToPetsHandler);
 */
export const importPlantToxicToPetsHandler = [
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

      console.error("[importPlantToxicToPets] import started");

      if (isExcel) {
        await importExcel(filePath, stats);
      } else {
        await importCSV(filePath, stats);
      }

      console.error("[importPlantToxicToPets] import finished", stats);

      res.status(200).json({ success: true, ...stats });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error.";
      console.error("[importPlantToxicToPets]", err);
      res.status(500).json({ success: false, error: message });
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  },
];