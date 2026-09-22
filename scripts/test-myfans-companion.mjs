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
const adminForms = fs.readFileSync(path.join(root, "src", "app", "admin", "myfans", "MyfansAdminForms.tsx"), "utf8");
const companionApi = fs.readFileSync(path.join(root, "src", "app", "api", "admin", "myfans", "companion", "route.ts"), "utf8");
const quoteRefreshApi = fs.readFileSync(path.join(root, "src", "app", "api", "admin", "myfans", "quote-refresh", "route.ts"), "utf8");
const identityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260922100000_add_myfans_collection_run_identity.sql"), "utf8");
const companionStateSource = fs.readFileSync(path.join(companion, "state.js"), "utf8");
const stateContext = { globalThis: {} };
vm.runInNewContext(companionStateSource, stateContext);
const companionState = stateContext.globalThis.MyfansCompanionState;

assert.match(manifest.version, /^0\.1\.\d+$/);
assert.equal(manifest.version, "0.1.26");
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
assert.match(background, /LINK_FOUND_THREAD_INCOMPLETE/);
assert.match(background, /OBSERVATION_NULL/);
assert.match(background, /THREAD_RESULT_NOT_OK/);
assert.match(background, /PARENT_NOT_FOUND/);
assert.match(background, /THREAD_INCOMPLETE_WITHOUT_LINK/);
assert.match(background, /collectionStatuses: \[\]/);
assert.match(background, /candidateCount: 0/);
assert.match(background, /JOB_IDENTITY_MISMATCH/);
assert.match(background, /runToken/);
assert.match(background, /collection_run_token/);
assert.match(background, /NO_OWN_MYFANS_LINK/);
assert.match(background, /observeVisibleThread/);
assert.match(background, /parentFound/);
assert.match(background, /observationCompleteness/);
assert.match(background, /statusThreadsObserved/);
assert.match(background, /fullyObservedThreads/);
assert.match(background, /No tab with id/);
assert.match(background, /myfansQuoteRefreshCancelRequested/);
assert.match(background, /sessionId/);
assert.match(background, /current-session/);
assert.match(background, /sanitizeForDisplay/);
assert.match(background, /isCurrentActiveRun/);
assert.match(background, /collector_version === WORKER_VERSION/);
assert.match(background, /launchMode/);
assert.match(background, /sameSession/);
assert.match(background, /resumable/);
assert.match(background, /crypto\.randomUUID\(\)/);
assert.match(background, /payload && payload.ok === false/);
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
assert.match(background, /\$\{stage\}_START/);
assert.match(background, /\$\{stage\}_END/);
assert.match(background, /elapsedMs/);
assert.match(background, /articleCountBefore/);
assert.match(background, /articleCountAfter/);
assert.match(background, /parentHasMedia/);
assert.match(background, /WORKER_TAB_RECREATED/);
assert.match(background, /recreateWorkerTabForStatus/);
assert.match(background, /statusRetryEvidence/);
assert.match(background, /retriedStatusTab/);
assert.match(background, /INVALID_STATUS_URL/);
assert.match(background, /WORKER_TAB_CREATE_FAILED/);
assert.match(background, /RECREATE_WORKER_TAB/);
assert.match(background, /GET_ORIGINAL_TAB/);
assert.match(background, /COLLECT_THREAD_RESULT/);
assert.match(background, /observationDiagnostics/);
assert.match(background, /threadResultDiagnostics/);
assert.match(background, /workerRetryCount/);
assert.match(background, /new URL\(raw\)/);
assert.match(background, /url\.pathname/);
assert.match(background, /authorMatch/);
assert.match(background, /sameAuthorReplyCount/);
assert.match(background, /reply\.authorHandle\?\.toLowerCase\(\) === expectedHandle\.toLowerCase\(\)/);
assert.match(background, /payload\.ok === false/);
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
assert.equal(companionState.successPatch(0, { ok: false, retryable: true, errorCode: "THREAD_NOT_FULLY_OBSERVED" }).finalStatus, "retryable");
const attempt = { errorCode: "EXECUTE_SCRIPT_NO_RESULT", message: "old diagnostic" };
assert.deepEqual(JSON.parse(JSON.stringify(companionState.appendAttemptDiagnostic({ attemptDiagnostics: ["kept"] }, attempt))), ["kept", attempt]);
assert.equal(companionState.isCompleted({ status: "completed", processed_creators: 1, total_creators: 1 }), true);
assert.equal(companionState.isCompleted({ status: "running", processed_creators: 1, total_creators: 1 }), true);
assert.equal(companionState.isCompleted({ status: "running", processed_creators: 0, total_creators: 1 }), false);
const identity = { job_id: 36, collection_session_id: "session-a", run_token: "run-a", collector_version: "0.1.26" };
const activeJob = { id: 36, status: "running", collection_session_id: "session-a", collection_run_token: "run-a", collector_version: "0.1.26" };
assert.equal(companionState.isCurrentActiveRun({ running: true, status: "running", identity }, activeJob, "0.1.26"), true);
for (const status of ["completed", "cancelled", "failed"]) {
  assert.equal(companionState.isCurrentActiveRun({ running: true, status: "scheduled", identity }, { ...activeJob, status }, "0.1.26"), false);
}
assert.equal(companionState.isCurrentActiveRun({ running: true, status: "scheduled", identity }, { ...activeJob, collection_session_id: null }, "0.1.26"), false);
assert.equal(companionState.isCurrentActiveRun({ running: true, status: "scheduled", identity }, { ...activeJob, collection_run_token: null }, "0.1.26"), false);
assert.equal(companionState.isCurrentActiveRun({ running: true, status: "scheduled", identity: { ...identity, collector_version: "0.1.25" } }, activeJob, "0.1.26"), false);
assert.equal(companionState.sanitizeForDisplay({ running: true, status: "scheduled", identity }, { ...activeJob, status: "completed" }, "0.1.26").history, true);
assert.equal(companionState.sanitizeForDisplay({ running: true, status: "scheduled", identity }, activeJob, "0.1.26").current, true);
assert.equal(companionState.shouldInvalidateStoredRun({ collectorVersion: "0.1.25" }, { running: true, identity }, "0.1.26"), true);
assert.equal(companionState.shouldInvalidateStoredRun({}, { running: true, identity: { job_id: 36 } }, "0.1.26"), true);
assert.match(popup, /blocked \$\{/);
assert.match(popup, /\(partial\)/);
assert.match(popup, /finalStatus !== "success"/);
assert.match(companionApi, /JOB_IDENTITY_MISMATCH/);
assert.match(companionApi, /final_collection_state/);
assert.match(companionApi, /profileScan/);
assert.match(companionApi, /THREAD_INCOMPLETE_WITHOUT_LINK/);
assert.match(quoteRefreshApi, /collection_run_token/);
assert.match(quoteRefreshApi, /JOB_IDENTITY_MISMATCH/);
assert.match(adminForms, /identityMatches/);
assert.match(adminForms, /legacy jobはcurrent-sessionとして扱いません/);
assert.match(identityMigration, /add column if not exists collection_run_token/);
assert.match(identityMigration, /collection_session_id, collection_run_token, collector_version/);

const normalize = (value) => value === undefined ? { ok: false, reason: "undefined" } : JSON.parse(JSON.stringify(value));
assert.deepEqual(normalize(undefined), { ok: false, reason: "undefined" });
assert.deepEqual(normalize({ ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" }), { ok: true, sourceXHandle: "creator", sourceStatusUrl: "https://x.com/creator/status/1" });

const diagnosticUrlSource = background.slice(background.indexOf("function diagnosticStatusUrl"), background.indexOf("async function runDiagnosticStatus"));
const diagnosticStatusUrl = new Function(`${diagnosticUrlSource}; return diagnosticStatusUrl;`)();
assert.equal(diagnosticStatusUrl("https://x.com/lumi_reviw/status/209979316390920203?s=20"), "https://x.com/lumi_reviw/status/209979316390920203");
assert.equal(diagnosticStatusUrl("https://twitter.com/lumi_reviw/status/209979316390920203?utm_source=x"), "https://x.com/lumi_reviw/status/209979316390920203");
assert.equal(diagnosticStatusUrl("https://x.com/lumi_reviw/status/209979316390920203/not-a-status"), "");

const threadSource = background.slice(background.indexOf("async function collectXStatusThreadReplies"), background.indexOf("async function executeMain", background.indexOf("async function collectXStatusThreadReplies")));
const collectXStatusThreadReplies = new Function(`return (${threadSource.trim()});`)();
const link = (href, text = "", parentElement = null, attributes = {}) => ({ href, textContent: text, parentElement, matches() { return false; }, getAttribute(name) { return name === "href" ? href : attributes[name] || null; } });
const card = (label = "card.layoutLarge.media") => ({ parentElement: null, className: "", matches() { return false; }, getAttribute(name) { return name === "data-testid" ? label : null; } });
const threadArticle = (author, statusId, myfansUrl = "", options = {}) => {
  const statusLink = link(`/${author}/status/${statusId}`);
  const authorLink = link(`/${author}`, `@${author}`);
  const links = [authorLink, statusLink];
  if (myfansUrl) links.push(link(myfansUrl, myfansUrl));
  if (options.cardHref) links.push(link(options.cardHref, options.cardText || "mfco.link/から", options.cardParent || card()));
  if (options.quotedCardHref) {
    const quotedArticle = { parentElement: null, matches(selector) { return selector === 'article[data-testid="tweet"]'; }, getAttribute() { return null; } };
    links.push(link(options.quotedCardHref, "mfco.link/quoted", quotedArticle));
  }
  return {
    innerText: "fixture thread post",
    querySelectorAll(selector) {
      if (selector === "a[href]") return links;
      if (selector === '[data-testid="User-Name"] a[href]') return [authorLink];
      return [];
    },
    querySelector() { return null; }
  };
};
globalThis.document = {
  body: { innerText: "fixture thread" },
  querySelectorAll(selector) {
    return selector === 'article[data-testid="tweet"]'
      ? [threadArticle("lumi_reviw", "209979316390920203"), threadArticle("lumi_reviw", "2", "https://mfco.link/p/own"), threadArticle("lumi_reviw", "4", "", { cardHref: "https://t.co/card-own" }), threadArticle("lumi_reviw", "5", "", { quotedCardHref: "https://t.co/card-quoted" }), threadArticle("other_user", "3", "https://mfco.link/p/foreign")]
      : [];
  }
};
globalThis.location = { href: "https://x.com/lumi_reviw/status/209979316390920203" };
const threadResult = await collectXStatusThreadReplies({ sourceXHandle: "lumi_reviw", sourceStatusUrl: "https://x.com/lumi_reviw/status/209979316390920203?s=20" });
assert.equal(threadResult.ok, true, JSON.stringify(threadResult));
assert.equal(threadResult.authorReplyCount, 3);
assert.equal(threadResult.foreignReplyCount, 1);
assert.equal(threadResult.quoteCandidates.length, 3);
assert.equal(threadResult.quoteCandidates[0].myfansUrls[0], "https://mfco.link/p/own");
const cardReply = threadResult.quoteCandidates.find((reply) => reply.xPostUrl.endsWith("/4"));
assert.deepEqual(cardReply.myfansUrls, ["https://t.co/card-own"]);
assert.equal(cardReply.linkDiagnostics.cardAnchorCount, 1);
assert.equal(cardReply.linkDiagnostics.tcoCount, 1);
assert.equal(cardReply.linkDiagnostics.acceptedMyfansLinkCount, 0);
assert.equal(threadResult.quoteCandidates.find((reply) => reply.xPostUrl.endsWith("/5")).myfansUrls.length, 0);

globalThis.document.querySelectorAll = (selector) => selector === 'article[data-testid="tweet"]'
  ? [threadArticle("lumi_reviw", "209979316390920203"), threadArticle("lumi_reviw", "2")]
  : [];
const noLinkThreadResult = await collectXStatusThreadReplies({ sourceXHandle: "lumi_reviw", sourceStatusUrl: "https://x.com/lumi_reviw/status/209979316390920203" });
assert.equal(noLinkThreadResult.authorReplyCount, 1);
assert.equal(noLinkThreadResult.myfansLinkCount, 0);

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
