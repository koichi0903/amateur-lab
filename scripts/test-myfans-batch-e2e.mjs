import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root = process.cwd();
const backgroundSource = fs.readFileSync(path.join(root, "public", "myfans-companion", "background.js"), "utf8");
const stateSource = fs.readFileSync(path.join(root, "public", "myfans-companion", "state.js"), "utf8");

async function createHarness({ itemCount = 5, workerStopAfter = 0, retryItem = 0, jobStatus = "running", staleRunning = false } = {}) {
  const storage = {};
  const audits = [];
  const alarms = new Map();
  const listeners = { alarm: null };
  const job = { id: 77, status: jobStatus, total_creators: itemCount, processed_creators: 0, batch_size: itemCount, collection_session_id: "session-a", collection_run_token: "run-a", collector_version: "0.1.37" };
  const items = Array.from({ length: itemCount }, (_, index) => ({ id: 500 + index, job_id: 77, creator_id: 600 + index, creator_x_url: `https://x.com/creator${index}`, attempts: 0, status: index === 0 && jobStatus === "completed" ? "success" : "pending", processed_at: null, myfans_creators: { display_name: `creator-${index + 1}` } }));
  if (jobStatus === "completed") items.forEach((item) => { item.status = "success"; item.processed_at = new Date().toISOString(); });
  if (staleRunning) { items[0].status = "running"; items[0].processed_at = new Date(Date.now() - 10 * 60_000).toISOString(); }
  job.processed_creators = items.filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const callbacks = {
    runtimeInstalled: () => {},
    tabsUpdated: () => {},
  };
  const chrome = {
    runtime: { getManifest: () => ({ version: "0.1.37" }), onInstalled: { addListener: (fn) => { callbacks.runtimeInstalled = fn; } }, onMessage: { addListener: () => {} } },
    alarms: { create: async (name, info) => alarms.set(name, info), clear: async (name) => alarms.delete(name), onAlarm: { addListener: (fn) => { listeners.alarm = fn; } } },
    storage: { local: {
      get: async (keys) => { if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, storage[key]])); return { [keys]: storage[keys] }; },
      set: async (values) => Object.assign(storage, values),
      remove: async (keys) => (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete storage[key]),
    } },
    tabs: {
      query: async () => [{ id: 1, url: "http://localhost/admin/myfans?media=1" }],
      create: async () => ({ id: 99 }), get: async (id) => ({ id, url: "about:blank" }), update: async () => {}, remove: async () => {},
      onUpdated: { addListener: (fn) => { callbacks.tabsUpdated = fn; } },
    },
    scripting: { executeScript: async () => [{ result: {} }] },
  };
  const jsonResponse = (body, ok = true, status = ok ? 200 : 409) => ({ ok, status, text: async () => JSON.stringify(body), json: async () => body, headers: { get: () => "application/json" } });
  let collectCount = 0;
  let workerStopped = false;
  const fetchMock = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/quote-refresh") && (!init.method || init.method === "GET")) return jsonResponse({ job, items });
    if (url.pathname.endsWith("/quote-refresh")) {
      const body = JSON.parse(init.body || "{}");
      if (body.action === "start") { job.status = "running"; return jsonResponse({ job, items }); }
      if (body.action === "audit") { audits.push({ action: body.continuationAction, metadata: body.metadata }); return jsonResponse({ ok: true }); }
      if (body.action === "next") {
        if (job.status !== "pending" && job.status !== "running") return jsonResponse({ done: true, job, items });
        const running = items.find((item) => item.status === "running");
        if (running) return jsonResponse({ done: false, busy: true, jobId: job.id, job });
        const item = items.find((candidate) => candidate.status === "pending" && candidate.attempts < 3);
        if (!item) { job.status = "completed"; return jsonResponse({ done: true, job, items }); }
        item.status = "running"; item.attempts += 1; item.processed_at = new Date().toISOString(); audits.push({ action: "NEXT_CLAIMED", metadata: { itemId: item.id } });
        return jsonResponse({ done: false, jobId: job.id, batchSize: job.batch_size, item });
      }
      return jsonResponse({ job, items });
    }
    if (url.pathname.endsWith("/companion")) {
      const body = JSON.parse(init.body || "{}");
      const item = items.find((candidate) => candidate.id === Number(body.refreshJobItemId)) || items.find((candidate) => candidate.status === "running");
      if (body.quoteCandidates && !body.failureReason && retryItem && item?.id === retryItem && item.attempts === 1) return jsonResponse({ ok: false, retryable: true, errorCode: "THREAD_NOT_FULLY_OBSERVED", error: "fixture retry" }, false, 202);
      if (item) {
        item.status = body.failureReason ? (item.attempts < 3 ? "pending" : "failed") : "success";
        item.processed_at = new Date().toISOString();
        job.processed_creators = items.filter((candidate) => ["success", "failed", "skipped"].includes(candidate.status)).length;
        if (job.processed_creators === items.length) job.status = "completed";
      }
      return jsonResponse({ ok: true, candidatesCount: body.fixtureNoMatch ? 0 : 1, collectionStatuses: [] });
    }
    throw new Error(`unexpected fixture request: ${url}`);
  };
  const context = { chrome, fetch: fetchMock, crypto: webcrypto, URL, URLSearchParams, Date, console, setTimeout, clearTimeout, document: {}, location: { href: "about:blank" }, __MYFANS_COMPANION_TEST__: true, importScripts: () => vm.runInNewContext(stateSource, context) };
  vm.runInNewContext(backgroundSource, context);
  context.ensureWorkerTab = async () => 99;
  context.collectFromWorkerTab = async (_tabId, item) => {
    collectCount += 1;
    if (workerStopAfter && collectCount === workerStopAfter) { workerStopped = true; throw Object.assign(new Error("simulated worker termination"), { code: "TAB_NOT_READY" }); }
    return { type: "x_quote_scan", refreshJobId: job.id, refreshJobItemId: item.id, creatorId: item.creator_id, creatorXUrl: item.creator_x_url, sourceXHandle: `creator${item.creator_id - 600}`, quoteCandidates: [], fixtureNoMatch: item.id === 500, collectionStatuses: [], diagnostics: { fullyObservedThreads: 1 } };
  };
  context.prepareRetry = async () => {};
  context.wait = async () => {};
  return { context, storage, alarms, audits, listeners, job, items, get collectCount() { return collectCount; }, get workerStopped() { return workerStopped; } };
}

async function runFullFixture(options = {}) {
  const harness = await createHarness(options);
  const run = harness.context.__myfansCompanionTestHooks.runBulkQuoteRefresh({ baseUrl: "http://localhost", sessionId: "session-a", jobId: 77, runToken: "run-a", collectorVersion: "0.1.37", launchMode: "resumed", batchSize: 5 });
  await run;
  return harness;
}

const full = await runFullFixture();
assert.equal(full.job.status, "completed", "A/H: NO_MATCH_THIS_RUNを含む5件が完走する");
assert.equal(full.items.filter((item) => item.status === "success").length, 5);
assert.ok(full.audits.some((audit) => audit.action === "ITEM_SAVED"));
assert.ok(full.audits.some((audit) => audit.action === "CONTINUE_DIRECT"));
assert.ok(full.audits.some((audit) => audit.action === "NEXT_CLAIMED"));

const retry = await runFullFixture({ retryItem: 501 });
assert.equal(retry.job.status, "completed", "F: retryable failure後も後続itemへ進む");
assert.ok(retry.items.every((item) => item.status === "success"));

const concurrent = await createHarness();
const settings = { baseUrl: "http://localhost", sessionId: "session-a", jobId: 77, runToken: "run-a", collectorVersion: "0.1.37", launchMode: "resumed", batchSize: 5 };
await Promise.all([concurrent.context.__myfansCompanionTestHooks.runBulkQuoteRefresh(settings), concurrent.context.__myfansCompanionTestHooks.runBulkQuoteRefresh(settings)]);
assert.equal(concurrent.items.filter((item) => item.status === "success").length, 5, "D: direct/watchdog競合で重複保存しない");

const watchdog = await createHarness();
watchdog.storage.myfansQuoteRefreshSettings = settings;
watchdog.storage.myfansQuoteRefreshState = { running: true, status: "scheduled", jobId: 77, sessionId: "session-a", runToken: "run-a", collectorVersion: "0.1.37", identity: { job_id: 77, collection_session_id: "session-a", run_token: "run-a", collector_version: "0.1.37" } };
await watchdog.listeners.alarm({ name: "myfansQuoteRefreshNext" });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(watchdog.audits.some((audit) => audit.action === "WATCHDOG_FIRED"));
assert.ok(watchdog.audits.some((audit) => audit.action === "RESUME_REQUESTED"));
assert.equal(watchdog.job.status, "completed", "B/C: watchdogがDBを正として再開する");

const mismatch = await createHarness();
mismatch.storage.myfansQuoteRefreshSettings = { ...settings, runToken: "run-old" };
mismatch.storage.myfansQuoteRefreshState = { running: true, status: "scheduled", jobId: 77, sessionId: "session-a", runToken: "run-old", collectorVersion: "0.1.37", identity: { job_id: 77, collection_session_id: "session-a", run_token: "run-old", collector_version: "0.1.37" } };
await mismatch.listeners.alarm({ name: "myfansQuoteRefreshNext" });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(mismatch.items.filter((item) => item.status === "success").length, 0, "E: token不一致で別runをresumeしない");

const stale = await createHarness({ staleRunning: true });
stale.storage.myfansQuoteRefreshSettings = settings;
stale.storage.myfansQuoteRefreshState = { running: true, status: "scheduled", jobId: 77, sessionId: "session-a", runToken: "run-a", collectorVersion: "0.1.37", identity: { job_id: 77, collection_session_id: "session-a", run_token: "run-a", collector_version: "0.1.37" } };
await stale.listeners.alarm({ name: "myfansQuoteRefreshNext" });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(stale.collectCount, 0, "G: stale itemを自動resumeしない");

const cancelled = await createHarness({ jobStatus: "cancelled" });
cancelled.storage.myfansQuoteRefreshSettings = settings;
cancelled.storage.myfansQuoteRefreshState = { running: true, status: "scheduled", jobId: 77, sessionId: "session-a", runToken: "run-a", collectorVersion: "0.1.37", identity: { job_id: 77, collection_session_id: "session-a", run_token: "run-a", collector_version: "0.1.37" } };
await cancelled.listeners.alarm({ name: "myfansQuoteRefreshNext" });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(cancelled.collectCount, 0, "G: cancelled jobをwatchdogがresumeしない");

console.log("Myfans batch E2E fixtures passed (A-H runtime workflow)");
