import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc"; // ✅ add plugin

export default [
  // Global ignores
  {
    ignores: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.spec.ts"],
  },

  // JavaScript files configuration
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      jsdoc, // ✅ enable plugin
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": ["error", { allow: ["error"] }],
      "no-unused-vars": "error",
      semi: ["error", "always"],
      indent: ["error", 2],
      "object-curly-spacing": ["error", "always"],
      eqeqeq: ["error", "always"],

      // ✅ enforce JSDoc for functions & const methods
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
    },
  },

  // TypeScript files configuration
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.node,
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      jsdoc, // ✅ enable jsdoc here too
    },
    rules: {
      // Core ESLint rules
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["error"] }],

      // Disable conflicting core rules for TypeScript
      "no-unused-vars": "off",
      "no-undef": "off",

      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // ✅ enforce JSDoc
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
    },
  },

  // Migration files override - disable type-aware linting
  {
    files: ["migrations/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: null, // disables parser project for migrations
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // Optional: relax JSDoc in migrations
      "jsdoc/require-jsdoc": "off",
    },
  },
];
