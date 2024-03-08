// @ts-check

import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";

export default tsEslint.config(
  eslint.configs.recommended,
  ...tsEslint.configs.strict,
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
