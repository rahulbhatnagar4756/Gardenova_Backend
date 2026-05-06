import { Pool } from "pg";
import config from "../config/env";

let dbPool: Pool | null = null;

/**
 * Establishes a new connection pool to the PostgreSQL database.
 *
 * This function reads PostgreSQL credentials from environment variables,
 * creates a connection pool with optimized performance settings,
 * tests the connection, and stores it in a global variable for reuse.
 *
 * @returns {Promise<Pool>} A promise that resolves with the PostgreSQL connection pool instance.
 * @throws {Error} If environment variables are missing or connection fails.
 */
export const connectDB = async (): Promise<Pool> => {
  if (     
    !config.POSTGRE_HOST ||
    !config.POSTGRE_PORT ||
    !config.POSTGRE_DATABASE ||
    !config.POSTGRE_USER ||
    !config.POSTGRE_PASSWORD
  ) {
    throw new Error(
      "PostgreSQL environment variables are not properly defined"
    );
  }

  const pool = new Pool({
    host: config.POSTGRE_HOST,
    port: Number(config.POSTGRE_PORT),
    database: config.POSTGRE_DATABASE,
    user: config.POSTGRE_USER,
    password: config.POSTGRE_PASSWORD,
    ssl:false, // Disable SSL for local development; enable in production if needed
    // ssl: {
    //   rejectUnauthorized: false,
    // },
    // Connection pool settings for better performance
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 50000,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Test the connection
    const client = await pool.connect();
    client.release();
    console.error("PostgreSQL pool connected successfully");
    dbPool = pool;
    return pool;
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    process.exit(1);
  }
};

/**
 * Retrieves the existing PostgreSQL connection pool instance.
 *
 * This helper function ensures that a database connection exists before use.
 * It must be called after `connectDB()` has successfully initialized the pool.
 *
 * @returns {Pool} The active PostgreSQL pool instance.
 * @throws {Error} If no connection pool has been initialized.
 */
export const getDB = (): Pool => {
  if (!dbPool) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return dbPool;
};

/**
 * Gracefully closes the PostgreSQL connection pool.
 *
 * This function releases all active database connections and
 * resets the internal `dbPool` reference to `null`.
 * It should be called during application shutdown to free resources.
 *
 * @returns {Promise<void>} A promise that resolves when the pool is disconnected.
 */
export const disconnectDB = async (): Promise<void> => {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
    console.error("PostgreSQL pool disconnected successfully");
  }
};
