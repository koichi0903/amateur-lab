import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const port = Number(process.env.MYFANS_PORT || 3000);
const baseUrl = `http://127.0.0.1:${port}`;
const manifest = JSON.parse(readFileSync(new URL("../public/myfans-companion/manifest.json", import.meta.url), "utf8"));
let head = "unknown";
try {
  head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {}
let http = "unreachable";
try {
  const response = await fetch(`${baseUrl}/api/admin/myfans/quote-refresh?approvedMediaId=1`);
  http = `${response.status}`;
} catch {}
console.log(JSON.stringify({
  role: "myfans-integration",
  expectedPort: 3000,
  observedPort: port,
  worktree: process.cwd(),
  head,
  companionVersion: manifest.version,
  http,
  secrets: "not displayed",
}, null, 2));
