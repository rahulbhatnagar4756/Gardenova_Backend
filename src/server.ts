import app from "./app";
import config from "./core/config/env";

/**
 * Initializes the database connection and starts the Express server.
 * Exits the process if startup fails.
 * @returns {Promise<void>} Resolves when the server is running.
 */
const startServer = async (): Promise<void> => {
  try {
    // Start server
    app.listen(config.PORT, () => {
      console.error(
        `Server running at: ${config.APPDEV_URL} in ${config.NODE_ENV} mode`
      );
      console.error(
        `Swagger Docs available at: ${config.APPDEV_URL}/swagger/`
      );
    });
  } catch {
    process.exit(1);
  }
};
startServer();
