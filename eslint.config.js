// SPDX-License-Identifier: Apache-2.0
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import security from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig(
  globalIgnores(["dist/**", "node_modules/**", "vendor/**", "coverage/**"]),

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  prettierConfig,

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // Internal table lookups (FIELDS[kind], MIRRORS[network], steps[index]) —
  // the object-injection rule exists for attacker-chosen property KEYS;
  // every key here is our own enum-like string or a loop counter.
  {
    files: ["src/builder.ts", "src/mirror.ts", "src/tour.ts"],
    rules: {
      "security/detect-object-injection": "off",
    },
  },

  // Tests and repo scripts run in Node and read their own files by
  // constructed paths — the non-literal-fs rule is for request-driven
  // servers, not a test harness.
  {
    files: ["test/**", "scripts/**"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-child-process": "off",
    },
  },

  // Type-aware parsing only where the tsconfig project reaches; config
  // files and repo scripts lint fine without it.
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
