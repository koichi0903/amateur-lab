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
    ".next-*/**",
    ".next-isolated/**",
    ".next-ux-verify*/**",
    ".next-local-playwright-*/**",
    ".next-local-update-*/**",
    ".worktrees/**",
    ".actress-pagination-release/**",
    ".amateur-actress-prod-release/**",
    ".fanza-release-candidate/**",
    ".fanza-release-candidate-baseline/**",
    "fanza-release-candidate-verify/**",
    ".recovery-temp-0030/**",
    ".vercel/**",
    "scheduled-update-recovery-logs/**",
    "tools/fanza-inspector/output/**",
    "work/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
