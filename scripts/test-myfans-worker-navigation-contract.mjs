import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const backgroundSource = fs.readFileSync(path.join(root, "public", "myfans-companion", "background.js"), "utf8");
const stateSource = fs.readFileSync(path.join(root, "public", "myfans-companion", "state.js"), "utf8");

async function createHarness(initialTab) {
  const tab = { id: 99, status: "complete", ...initialTab };
  const updates = [];
  const storage = {};
  const chrome = {
    runtime: { getManifest: () => ({ version: "0.1.38" }), onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener() {} } },
    storage: { local: { get: async () => storage, set: async (value) => Object.assign(storage, value), remove: async () => {} } },
    tabs: {
      get: async () => ({ ...tab }),
      update: async (_tabId, value) => {
        updates.push(value);
        tab.url = value.url;
        tab.status = "complete";
        return { ...tab };
      },
      create: async () => ({ ...tab }),
      remove: async () => {},
      query: async () => [{ id: 1, url: "http://localhost:3000/admin/myfans" }],
      onUpdated: { addListener() {} }
    },
    scripting: { executeScript: async () => [{ result: {} }] }
  };
  const context = {
    chrome,
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "{}" }),
    URL,
    URLSearchParams,
    Date,
    console,
    setTimeout,
    clearTimeout,
    crypto: { randomUUID: () => "test-run" },
    document: {},
    location: { href: "about:blank" },
    __MYFANS_COMPANION_TEST__: true,
    importScripts: () => vm.runInNewContext(stateSource, context)
  };
  vm.runInNewContext(backgroundSource, context);
  return { hooks: context.__myfansCompanionTestHooks, updates };
}

const target = "https://x.com/KEN_TAKI_7?myfans_creator_id=1&myfans_refresh_job_id=67&myfans_refresh_item_id=2";

// Regression: a stale candfans.jp tab must not be accepted as a completed X page.
const stale = await createHarness({ url: "https://candfans.jp/posts/old", status: "complete" });
const staleResult = await stale.hooks.navigateWorkerTabToProfile(99, target, 1000);
assert.equal(staleResult.navigated, true);
assert.equal(staleResult.observedUrl, target);
assert.equal(stale.updates.length, 1);

// A completed X page with the requested handle is safe to reuse without navigation.
const correct = await createHarness({ url: "https://x.com/KEN_TAKI_7", status: "complete" });
const correctResult = await correct.hooks.navigateWorkerTabToProfile(99, target, 1000);
assert.equal(correctResult.navigated, false);
assert.equal(correct.updates.length, 0);

// A different handle must never pass the profile gate.
const wrongHandle = await createHarness({ url: "https://x.com/other_creator", status: "complete" });
await assert.rejects(
  wrongHandle.hooks.waitForWorkerProfileNavigation(99, target, 1),
  /NAVIGATION_TIMEOUT/
);
assert.equal(wrongHandle.updates.length, 0);

const statusPage = await createHarness({ url: "https://x.com/KEN_TAKI_7/status/123", status: "complete" });
await assert.rejects(
  statusPage.hooks.waitForWorkerProfileNavigation(99, target, 1),
  /NAVIGATION_TIMEOUT/
);

// Login redirects remain retryable/diagnostic and never reach collection.
const login = await createHarness({ url: "https://x.com/i/flow/login", status: "complete" });
await assert.rejects(
  login.hooks.waitForWorkerProfileNavigation(99, target, 1000),
  /LOGIN_OR_CHALLENGE/
);

console.log("myfans worker navigation contract: ok");
