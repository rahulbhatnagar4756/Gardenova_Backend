import { Pool } from "pg";
import { getDB } from "../config/db";
import { LogOptions } from "../../interface/logs";
import type { Request } from "express";

/**
 * Logger class for writing logs to PostgreSQL.
 * Handles connection and log insertion with flattened fields (no JSON).
 */
class Logger {
  private client: Pool | null = null;
  public isConnected = false;

  /**
   * Initializes the PostgreSQL connection.
   */
  async initialize(): Promise<void> {
    if (!this.isConnected) {
      this.client = getDB();
      this.isConnected = true;
    }
  }

  /**
   * Inserts a log entry into PostgreSQL logs table.
   *
   * @param level - Log level ("info", "error", "warn", "debug")
   * @param message - Log message
   * @param meta - Metadata fields (flattened)
   * @param options - Optional logging options like userId, source, sessionId, req
   */
  async log(
    level: string,
    message: string,
    meta: Record<string, unknown> = {},
    options: LogOptions & { req?: Request } = {}
  ): Promise<void> {
    try {
      if (!this.isConnected) await this.initialize();
      if (!this.client) throw new Error("PostgreSQL client not available");

      const req = options.req;

      // Auto-detect metadata from request if not provided
      const method = meta.method ?? req?.method ?? null;
      const url = meta.url ?? req?.originalUrl ?? null;
      const ip =
        meta.ip ??
        (req?.headers["x-forwarded-for"] as string) ??
        req?.socket.remoteAddress ??
        null;
      const userAgent = meta.userAgent ?? req?.headers["user-agent"] ?? null;

      const email = meta.email ?? null;
      const role = meta.role ?? null;
      const tokenExp = meta.tokenExp ? new Date(meta.tokenExp as string) : null;
      const hasAuthHeader =
        meta.hasAuthHeader ?? (req?.headers.authorization ? true : null);

      const timestamp = new Date();
      const createdAt = new Date();

      const query = `
        INSERT INTO logs (
          level, message, "timestamp", source,
          method, url, ip, user_agent, email, role,
          token_exp, has_auth_header, "userId", "sessionId", "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
      `;

      const values = [
        level.toLowerCase(),
        message,
        timestamp,
        options.source || "application",
        method,
        url,
        ip,
        userAgent,
        email,
        role,
        tokenExp,
        hasAuthHeader,
        options.userId ?? null,
        options.sessionId ?? null,
        createdAt,
      ];

      await this.client.query(query, values);
    } catch (error) {
      console.error("❌ Failed to insert log:", (error as Error).message);
    }
  }

  /**
   * Fetch logs with filters, limit, and sorting.
   *
   * @param filter - Object with filter fields.
   * @param options - Query options like limit, offset, sorting.
   * @param options.limit
   * @param options.offset
   * @param options.orderBy
   * @param options.orderDir
   * @returns Promise<any[]> - Array of log records.
   */
  async getLogs(
    filter: Partial<Record<string, unknown>> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
    } = {}
  ): Promise<Record<string, unknown>[]> {
    if (!this.isConnected) await this.initialize();
    if (!this.client) throw new Error("PostgreSQL client not available");

    const {
      limit = 100,
      offset = 0,
      orderBy = "createdAt",
      orderDir = "DESC",
    } = options;

    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(filter)) {
      whereClauses.push(`${key} = $${i++}`);
      values.push(value);
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const query = `
      SELECT *
      FROM logs
      ${whereSQL}
      ORDER BY "${orderBy}" ${orderDir}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const result = await this.client.query(query, values);
    return result.rows as Record<string, unknown>[];
  }

  /**
   * Gracefully closes the PostgreSQL client connection.
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// ---------- Singleton Setup ----------
const logger = new Logger();
let initPromise: Promise<void> | null = null;

/**
 * Ensures logger is initialized before logging.
 * @returns Promise<void>
 */
const ensureInitialized = async (): Promise<void> => {
  if (!initPromise) initPromise = logger.initialize();
  await initPromise;
};

// ---------- LOGGING HELPERS (Now with `req`) ----------

/**
 * Logs an informational message.
 * @param message
 * @param meta
 * @param options
 * @returns Promise<void>
 */
export const info = async (
  message: string,
  meta: Record<string, unknown> = {},
  options: LogOptions & { req?: Request } = {}
): Promise<void> => {
  await ensureInitialized();
  return logger.log("info", message, meta, options);
};

/**
 * Logs an error message.
 * @param message
 * @param meta
 * @param options
 * @returns Promise<void>
 */
export const error = async (
  message: string,
  meta: Record<string, unknown> = {},
  options: LogOptions & { req?: Request } = {}
): Promise<void> => {
  await ensureInitialized();
  return logger.log("error", message, meta, options);
};

/**
 * Logs a warning message.
 * @param message
 * @param meta
 * @param options
 * @returns Promise<void>
 */
export const warn = async (
  message: string,
  meta: Record<string, unknown> = {},
  options: LogOptions & { req?: Request } = {}
): Promise<void> => {
  await ensureInitialized();
  return logger.log("warn", message, meta, options);
};

/**
 * Logs a debug message.
 * @param message
 * @param meta
 * @param options
 * @returns Promise<void>
 */
export const debug = async (
  message: string,
  meta: Record<string, unknown> = {},
  options: LogOptions & { req?: Request } = {}
): Promise<void> => {
  await ensureInitialized();
  return logger.log("debug", message, meta, options);
};

/**
 * Closes the logger.
 * @returns Promise<void>
 */
export const close = (): Promise<void> => logger.close();

export default logger;
