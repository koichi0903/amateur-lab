import { execFileSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const ref = process.env.VERCEL_GIT_COMMIT_REF;

if (!env) {
  console.log("Not running on Vercel; allowing build.");
  process.exit(1);
}

if (env !== "production") {
  if (env === "preview" && ["codex/amateur-affiliate-id-991-preview", "codex/fanza-amateur-click-measurement-20261021", "codex/admin-amateur-scan-button", "codex/fanza-amateur-works-20261015", "codex/amateur-daily-api-schedule-20261015", "codex/fanza-catalog-reconcile-20261019"].includes(ref ?? "")) {
    console.log(`Allowing the requested isolated preview for ${ref}.`);
    process.exit(1);
  }
  console.log(`Skipping ${env} deployment for ${ref ?? "unknown branch"}.`);
  process.exit(0);
}

if (ref && ref !== "main") {
  console.log(`Skipping production build for non-main branch: ${ref}.`);
  process.exit(0);
}

let changedFiles;
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
} catch {
  console.log("Could not inspect changed files; allowing build.");
  process.exit(1);
}

const relevantPatterns = [
  /^src\//,
  /^public\//,
  /^package(-lock)?\.json$/,
  /^next\.config\.ts$/,
  /^postcss\.config\.mjs$/,
  /^tsconfig\.json$/,
  /^vercel\.json$/,
  /^scripts\/vercel-ignore-build\.mjs$/,
  /^scripts\/start-local-dev\.ps1$/,
];

const hasRelevantChange = changedFiles.some((file) =>
  relevantPatterns.some((pattern) => pattern.test(file)),
);

if (hasRelevantChange) {
  console.log("Application change detected; allowing build.");
  process.exit(1);
}

console.log("Only non-runtime files changed; skipping build.");
process.exit(0);
