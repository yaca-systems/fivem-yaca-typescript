// @ts-check

import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";
// import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tsEslint.config(
  eslint.configs.recommended,
  ...tsEslint.configs.recommended,
  // eslintPluginPrettierRecommended,
  {
    rules: {
      "eqeqeq": "error",
    }
  },
  {
    ignores: ["build.js"],
  },
  {
    ignores: ["dist"],
  },
  {
    ignores: ["web"],
  },
);
