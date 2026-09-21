import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const companion = path.join(root, "public", "myfans-companion");
const manifest = JSON.parse(fs.readFileSync(path.join(companion, "manifest.json"), "utf8"));
const background = fs.readFileSync(path.join(companion, "background.js"), "utf8");
const bridge = fs.readFileSync(path.join(companion, "myfans-admin-bridge.js"), "utf8");
const popup = fs.readFileSync(path.join(companion, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(companion, "popup.html"), "utf8");
const companionStateSource = fs.readFileSync(path.join(companion, "state.js"), "utf8");
const stateContext = { globalThis: {} };
vm.runInNewContext(companionStateSource, stateContext);
const companionState = stateContext.globalThis.MyfansCompanionState;

assert.match(manifest.version, /^0\.1\.\d+$/);
assert.match(background, /chrome\.runtime\.getManifest\(\)\.version/);
assert.match(bridge, /chrome\.runtime\.getManifest\(\)\.version/);
assert.match(background, /resultsが空でした/);
assert.match(background, /resultがundefinedでした/);
assert.match(background, /resultをJSON化できませんでした/);
assert.match(background, /requireResult: true/);
assert.match(background, /collectionError/);
assert.match(background, /別のCompanion収集が実行中です/);
assert.match(background, /frameId === 0/);
assert.match(background, /INJECTED_FUNCTION_ERROR/);
assert.match(background, /RESULT_SERIALIZATION_FAILED/);
assert.match(background, /allFrames: false/);
assert.match(background, /extractSourceTextInPage/);
assert.match(background, /complete_thread_first_v2/);
assert.match(background, /THREAD_NOT_FULLY_OBSERVED/);
assert.match(background, /NO_OWN_MYFANS_LINK/);
assert.match(background, /observeVisibleThread/);
assert.match(background, /myfansLinkSource/);
assert.match(background, /parentStatusUrl/);
assert.match(background, /waitForStatusReady/);
assert.match(background, /inspectXStatusReady/);
assert.match(background, /STATUS_PARENT_NOT_FOUND/);
assert.match(background, /MEDIA_STATUS_QUEUE/);
assert.match(background, /NAVIGATE_STATUS/);
assert.match(background, /WAIT_STATUS_READY/);
assert.match(background, /COLLECT_THREAD/);
assert.match(background, /RESOLVE_LINK/);
assert.match(background, /stateTransitions/);
assert.match(background, /ownReplyStatusUrl/);
assert.match(popupHtml, /画像\/動画＋本人myfansリンク付き投稿を最大5件収集/);
assert.match(background, /attemptDiagnostics/);
assert.match(background, /MyfansCompanionState\.successPatch/);
assert.match(background, /MyfansCompanionState\.isCompleted/);
assert.deepEqual(JSON.parse(JSON.stringify(companionState.successPatch(4))), {
  finalStatus: "success",
  errorCode: null,
  lastError: null,
  failureDiagnostics: null,
  lastCandidatesCount: 4,
});
const attempt = { errorCode: "EXECUTE_SCRIPT_NO_RESULT", message: "old diagnostic" };
assert.deepEqual(JSON.parse(JSON.stringify(companionState.appendAttemptDiagnostic({ attemptDiagnostics: ["kept"] }, attempt))), ["kept", attempt]);
assert.equal(companionState.isCompleted({ status: "completed", processed_creators: 1, total_creators: 1 }), true);
assert.equal(companionState.isCompleted({ status: "running", processed_creators: 1, total_creators: 1 }), true);
assert.equal(companionState.isCompleted({ status: "running", processed_creators: 0, total_creators: 1 }), false);
assert.match(popup, /blocked \$\{/);
assert.match(popup, /\(partial\)/);
assert.match(popup, /finalStatus !== "success"/);

const normalize = (value) => value === undefined ? { ok: false, reason: "undefined" } : JSON.parse(JSON.stringify(value));
assert.deepEqual(normalize(undefined), { ok: false, reason: "undefined" });
assert.deepEqual(normalize({ ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" }), { ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" });

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} was not found`);
  return source.slice(start, end).trim();
}

const collectorSource = extractFunction(background, "function collectXQuoteCandidates()", "function inspectXPageState");
const collectXQuoteCandidates = new Function(`return (${collectorSource});`)();
const statusLink = {
  href: "/creator/status/123/video/1",
  getAttribute(name) { return name === "href" ? "/creator/status/123/video/1" : null; },
};
const article = {
  innerText: "fixture post body",
  querySelectorAll(selector) { return selector === "a[href]" ? [statusLink] : []; },
  querySelector() { return null; },
};
globalThis.location = { href: "https://x.com/creator?myfans_creator_id=7" };
globalThis.document = {
  readyState: "complete",
  body: { innerText: "fixture post body" },
  querySelector() { return null; },
  querySelectorAll(selector) { return selector === 'article[data-testid="tweet"]' ? [article] : []; },
};
const fixtureResult = collectXQuoteCandidates();
assert.equal(fixtureResult.ok, true);
assert.equal(fixtureResult.errorCode, null);
assert.equal(fixtureResult.diagnostics.articleCount, 1);
assert.equal(fixtureResult.diagnostics.ownPostCount, 1);
assert.equal(fixtureResult.quoteCandidates.length, 1);
assert.equal(Object.getPrototypeOf(fixtureResult), Object.prototype);
assert.equal(JSON.parse(JSON.stringify(fixtureResult)).quoteCandidates[0].xPostUrl, "https://x.com/creator/status/123");
assert.equal(JSON.parse(JSON.stringify(fixtureResult)).quoteCandidates[0].generatedVideoPermalink, "https://x.com/creator/status/123/video/1");

const serializationSource = background.slice(background.indexOf("const serializePlainJson"), background.indexOf("const finalize", background.indexOf("const serializePlainJson")));
assert.match(serializationSource, /undefined/);
assert.match(serializationSource, /circular/);
assert.match(background, /RESULT_UNDEFINED/);
assert.match(background, /RESULT_EMPTY/);
assert.match(background, /RESULT_FRAME_MISSING/);

console.log(`Myfans Companion checks passed (manifest ${manifest.version})`);
