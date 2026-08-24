import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";
import config from "./core/config/env";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GARDEOVA Backend API",
      version: "1.0.0",
      description: "User Authentication REST API documentation",
    },
    servers: [
      {
        url: config.APPDEV_URL,
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token with 'Bearer {token}'",
        },
      },
      parameters: {
        AcceptLanguage: {
          in: "header",
          name: "Accept-Language",
          required: false,
          schema: {
            type: "string",
            enum: ["en", "pt"],
            default: "pt",
          },
          description: "Language preference (default: pt)",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },

  apis: [
    "./src/modules/auth/*.ts",
    "./src/modules/roles/*.ts",
    "./src/modules/userProfile/*.ts",
    "./src/modules/admin/questions/*.ts",
    "./src/modules/admin/rules/*.ts",
    "./src/modules/admin/leads/*.ts",
    "./src/modules/partnerProfile/*.ts",
    "./src/modules/answers/*.ts",
    "./src/modules/plant/*.ts",
    "./src/modules/stateCity/*.ts",
    "./src/modules/admin/dashboard/*.ts",
    "./src/modules/admin/users/*.ts",
    "./src/modules/admin/diagnosisScans/*.ts",
    "./src/modules/admin/plantCatalog/*.ts",
    "./src/modules/subscription/*.ts",
    "./src/modules/admin/externalLinks/*.ts",
    "./src/modules/myPlants/*.ts",
    "./src/modules/professional/*.ts",
    "./src/modules/suppliers/*.ts",
    "./src/modules/landScapeDesign/*.ts",
    "./src/modules/gardenChat/*.ts",
    "./src/modules/gardenInsights/*.ts",
    "./src/modules/soil/*.ts",
    "./src/modules/contactus/*.ts",
    "./src/modules/Blog/*.ts",
    "./src/modules/reminder/*.ts",
  ],
};

// Build swagger docs
const specs = swaggerJsdoc(options);

// Convert specs to a safe mutable object
const specDoc = specs as unknown as {
  paths?: Record<string, unknown>;
};

// Inject Accept-Language into ALL routes
if (specDoc.paths) {
  Object.entries(specDoc.paths).forEach(([_, pathItem]) => {
    const item = pathItem as Record<string, unknown>;

    Object.entries(item).forEach(([__, operation]) => {
      const op = operation as Record<string, unknown>;

      // Ensure parameters exists
      if (!op.parameters) {
        op.parameters = [];
      }

      const params = op.parameters as Array<Record<string, string>>;

      const exists = params.some(
        (p) => p.$ref === "#/components/parameters/AcceptLanguage"
      );

      if (!exists) {
        params.push({
          $ref: "#/components/parameters/AcceptLanguage",
        });
      }
    });
  });
}

/**
 * Configures Swagger UI for API documentation.
 *
 * @param app - Express application instance
 * @returns void
 */
function setupSwagger(app: Application): void {
  const swaggerUiOptions = {
    swaggerOptions: {
      persistAuthorization: true,

      /**
       * Inject default Accept-Language header into all Swagger requests.
       *
       * @param req - Swagger outgoing request object
       * @returns Modified request object
       */
      requestInterceptor: (
        req: Record<string, unknown>
      ): Record<string, unknown> => {
        if (!req.headers) req.headers = {};

        const headers = req.headers as Record<string, string>;

        if (!headers["accept-language"]) {
          headers["accept-language"] = "pt"; // default
        }

        return req;
      },
    },
  };

  app.use(
    "/swagger",
    swaggerUi.serve,
    swaggerUi.setup(specDoc, swaggerUiOptions)
  );
}

export default setupSwagger;
