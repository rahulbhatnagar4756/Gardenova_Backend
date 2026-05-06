import csv from "csv-parser";
import { Readable } from "stream";
/**
 * Parses a CSV buffer and extracts its rows as objects of type T.
 *
 * @template T - The type of each row object. Defaults to `any`.
 * @param {Buffer} buffer - The CSV file content as a Buffer.
 * @returns {Promise<T[]>} Promise that resolves with an array of parsed rows.
 * @throws {Error} If parsing fails.
 *
 * @example
 * const csvBuffer = fs.readFileSync("file.csv");
 * const rows = await extractCsvData<{ name: string; email: string }>(csvBuffer);
 */
export const extractCsvData = <T>(buffer: Buffer): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const rows: T[] = [];

        Readable.from(buffer)
            .pipe(
                csv({
                     /**
                     * Trim whitespace from CSV headers.
                     * @param {{ header: string }} param0
                     * @returns {string}
                     */
                    mapHeaders: ({ header }) => header.trim(),       // fixes "name " → "name"
                     /**
                     * Trim whitespace from all CSV cell values.
                     * @param {{ value: string }} param0
                     * @returns {string | undefined}
                     */
                    mapValues: ({ value }) => value?.trim() ?? value, // trim all cell values
                })
            )
            /**
             * Fired for each parsed row.
             */
            .on("data", (row) => rows.push(row as T))

            /**
             * Fired when parsing completes successfully.
             */
            .on("end", () => resolve(rows))

            /**
             * Fired if an error occurs during parsing.
             */
            .on("error", reject);
    });
};