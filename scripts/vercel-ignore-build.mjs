import { execFileSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const ref = process.env.VERCEL_GIT_COMMIT_REF;

if (!env) {
  console.log("Not running on Vercel; allowing build.");
  process.exit(1);
}

if (env !== "production") {
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
