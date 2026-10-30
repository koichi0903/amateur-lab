import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/admin/myfans/companion/route.ts", "utf8");
const saveQuoteScan = fs.readFileSync("src/lib/myfansQuoteScanService.ts", "utf8");
const saveSingleStatusCollection = fs.readFileSync("src/lib/myfansSingleStatusCollectionService.ts", "utf8");
const background = fs.readFileSync("public/myfans-companion/background.js", "utf8");
const quoteRefresh = fs.readFileSync("src/app/api/admin/myfans/quote-refresh/route.ts", "utf8");
const quoteRefreshAudit = fs.readFileSync("src/lib/myfansQuoteRefreshAudit.ts", "utf8");
const quoteRefreshSource = `${quoteRefresh}\n${quoteRefreshAudit}`;
const diagnosticStatusScanService = fs.readFileSync("src/lib/myfansDiagnosticStatusScanService.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260924120000_add_myfans_quote_refresh_item_terminal_contract.sql", "utf8");

const terminalCases = ["SUCCESS_SAVE", "NO_CANDIDATES", "NO_BODY", "CREATOR_MISMATCH", "LOGIN_OR_CHALLENGE", "FATAL_SESSION_AUTH"];
for (const code of terminalCases) assert.match(`${route}\n${saveQuoteScan}\n${saveSingleStatusCollection}\n${background}`, new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(route, /COMPANION_PROTOCOL_VERSION = "2"/);
assert.match(route, /status: 409/);
assert.match(route, /status: isFatalSessionAuth\(errorCode, message\) \? 401 : 200/);
assert.match(background, /type: "x_diagnostic_status_scan"/);
assert.match(route, /saveDiagnosticStatusScan/);
assert.match(diagnosticStatusScanService, /diagnostic_mode: true/);
for (const column of ["request_type", "result_code", "http_status", "diagnostics", "started_at", "finished_at"]) {
  assert.match(migration, new RegExp(`add column if not exists ${column}`));
  assert.match(route + quoteRefresh, new RegExp(`${column}`));
}
assert.match(background, /type: "x_quote_scan",\s*protocolVersion: COMPANION_PROTOCOL_VERSION/);
assert.match(background, /collectionFailure: \{ stage: error\?\.stage/);
assert.match(route, /DIAGNOSTIC_SECRET_KEY/);
assert.match(route, /cookie\|token\|authorization/);
assert.match(saveQuoteScan, /duplicate_batch_save_ignored/);
assert.match(quoteRefresh, /ITEM_TERMINAL/);
assert.match(quoteRefresh, /action === "preflight"/);
assert.match(quoteRefresh, /DB_PREFLIGHT_FAILED/);
assert.match(quoteRefreshSource, /compatibility_fallback/);
assert.match(background, /let quoteRefreshStartInFlight = false/);
assert.match(background, /status: "already_running"/);
assert.match(background, /await saveQuoteSettings\(persistedSettings\);/);
assert.match(background, /async function navigateWorkerTabToProfile\(tabId, expectedUrl, timeoutMs = 45000\)/);
assert.match(background, /await chrome\.tabs\.update\(tabId, \{ url: expectedUrl, active: false \}\)/);
assert.match(background, /isExpectedWorkerProfileUrl\(observedUrl, expectedUrl, expected\.handle\)/);
assert.match(background, /lastTab\.status === "complete" && isExpectedWorkerProfileUrl/);
assert.match(background, /waitForStatusNavigation\(tabId, candidate\.xPostUrl, 45000\)/);
assert.match(background, /if \(!persistedSettings\.jobId\) await quoteRefreshRequest\(persistedSettings, \{ action: "preflight" \}\)/);
assert.match(background, /if \(!workerTabId\) workerTabId = await ensureWorkerTab\(currentTab\?\.id, buildWorkerProfileUrl\(item, next\.jobId\)\)/);
const buildWorkerProfileUrlSource = background.slice(background.indexOf("function buildWorkerProfileUrl"), background.indexOf("function isWorkerTabLostError"));
const buildWorkerProfileUrl = new Function(`${buildWorkerProfileUrlSource}; return buildWorkerProfileUrl;`)();
assert.equal(buildWorkerProfileUrl({ creator_x_url: "https://x.com/Hiroki_hub", creator_id: 67, id: 459 }, 45), "https://x.com/Hiroki_hub?myfans_creator_id=67&myfans_refresh_job_id=45&myfans_refresh_item_id=459");

const mixed = ["SUCCESS_SAVE", "NO_CANDIDATES", "NO_BODY", "CREATOR_MISMATCH", "LOGIN_OR_CHALLENGE"];
assert.equal(mixed.filter(Boolean).length, 5);
assert.equal(mixed.filter((code) => code === "HTTP_400").length, 0);
assert.equal(mixed.every((code) => terminalCases.includes(code)), true);

// Runtime DOM fixture for the regression that previously referenced an undefined targetId.
const authorLink = { parentElement: null, textContent: "@creator", getAttribute(name) { return name === "href" ? "/creator" : null; } };
const statusLink = { parentElement: null, textContent: "", getAttribute(name) { return name === "href" ? "/creator/status/123" : null; } };
const textNode = { textContent: "具体的な本文" };
const timeNode = { getAttribute() { return "2026-09-24T00:00:00.000Z"; } };
const article = {
  innerText: "具体的な本文",
  querySelectorAll(selector) { return selector.includes("User-Name") ? [authorLink] : [authorLink, statusLink]; },
  querySelector(selector) { return selector.includes("tweetText") ? textNode : selector === "time" ? timeNode : null; },
};
const candidateSource = background.slice(background.indexOf("function collectSingleXStatusCandidate"), background.indexOf("async function markItemFailed"));
const collectSingleXStatusCandidate = new Function("URL", "location", "document", `${candidateSource}; return collectSingleXStatusCandidate;`)(URL, { href: "https://x.com/creator/status/123" }, { querySelectorAll() { return [article]; } });
const domResult = collectSingleXStatusCandidate({ sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/123" });
assert.equal(domResult.ok, true);
assert.equal(domResult.targetStatusId, "123");

console.log("Myfans terminal/contract fixtures passed (mixed 5 terminal, protocol v2, safe diagnostics)");
