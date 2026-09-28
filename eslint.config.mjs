import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    ".next-isolated/**",
    ".next-ux-verify*/**",
    ".next-local-playwright-*/**",
    ".next-local-update-*/**",
    "work/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
