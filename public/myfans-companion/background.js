const QUOTE_STATE_KEY = "myfansQuoteRefreshState";
importScripts("state.js");

const QUOTE_SETTINGS_KEY = "myfansQuoteRefreshSettings";
const COMPANION_SETTINGS_KEY = "myfansCompanionSettings";
const QUOTE_ALARM_NAME = "myfansQuoteRefreshNext";
const WORKER_TAB_KEY = "myfansQuoteWorkerTabId";
const QUOTE_CANCEL_KEY = "myfansQuoteRefreshCancelRequested";
const DIAGNOSTIC_STATE_KEY = "myfansDiagnosticState";
const SINGLE_STATUS_STATE_KEY = "myfansSingleStatusState";
const WORKER_VERSION = chrome.runtime.getManifest().version;
const COLLECTOR_METHOD = "complete_thread_first_v2";
const ADMIN_BRIDGE_FILE = "myfans-admin-bridge.js";
const ADMIN_HOSTS = new Set(["localhost", "127.0.0.1"]);
let diagnosticRunning = false;

function isMyfansAdminUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" && ADMIN_HOSTS.has(url.hostname) && url.pathname.startsWith("/admin/myfans");
  } catch {
    return false;
  }
}

async function inspectAdminBridge(tabId) {
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const bridge = window.__MYFANS_COMPANION_BRIDGE__ || null;
      return {
        url: window.location.href,
        dailyPageDetected: window.location.protocol === "http:" && ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.pathname.startsWith("/admin/myfans"),
        bridgeInjected: document.documentElement.dataset.myfansCompanionBridge === "connected" || Boolean(bridge),
        bridgeVersion: document.documentElement.dataset.myfansCompanionBridgeVersion || bridge?.extensionVersion || null,
        diagnosticVersion: document.documentElement.dataset.myfansCompanionBridgeDiagnosticVersion || bridge?.bridgeVersion || null,
        lastAck: bridge?.lastAck || bridge?.at || null,
        markerAt: document.documentElement.dataset.myfansCompanionBridgeAt || bridge?.at || null
      };
    }
  });
  return injection?.[0]?.result || null;
}

async function probeAdminTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!isMyfansAdminUrl(tab.url)) {
    return {
      ok: false,
      canExecuteScript: false,
      markerWritten: false,
      dailyPageDetected: false,
      reason: "not_daily_page",
      tabUrl: tab.url || "",
      workerVersion: WORKER_VERSION
    };
  }
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      document.documentElement.dataset.myfansProbe = "ok";
      return {
        url: window.location.href,
        dailyPageDetected: window.location.protocol === "http:" && ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.pathname.startsWith("/admin/myfans"),
        markerWritten: document.documentElement.dataset.myfansProbe === "ok"
      };
    }
  });
  const result = injection?.[0]?.result || null;
  return {
    ok: Boolean(result?.dailyPageDetected && result?.markerWritten),
    canExecuteScript: Boolean(result),
    markerWritten: Boolean(result?.markerWritten),
    workerVersion: WORKER_VERSION,
    ...(result || {})
  };
}

async function injectAdminBridge(tabId, reason = "auto") {
  const tab = await chrome.tabs.get(tabId);
  if (!isMyfansAdminUrl(tab.url)) {
    return { ok: false, skipped: true, reason: "not_daily_page", tabUrl: tab.url || "", workerVersion: WORKER_VERSION };
  }
  const before = await inspectAdminBridge(tabId).catch(() => null);
  if (before?.bridgeInjected && before.bridgeVersion === WORKER_VERSION) {
    return { ok: true, injected: false, reason: "already_injected", workerVersion: WORKER_VERSION, ...before };
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [ADMIN_BRIDGE_FILE]
  });
  const after = await inspectAdminBridge(tabId).catch(() => null);
  return { ok: Boolean(after?.bridgeInjected), injected: true, reason, workerVersion: WORKER_VERSION, ...after };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!isMyfansAdminUrl(url)) return;
  injectAdminBridge(tabId, changeInfo.url ? "navigation" : "updated").catch((error) => {
    console.debug("[myfans companion background] bridge inject failed", { tabId, error: error instanceof Error ? error.message : String(error) });
  });
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function observeVisibleThread(tabId, expectedHandle = "", expectedStatusUrl = "", readyEvidence = null) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let lastObservation = null;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      lastObservation = await executeMain(tabId, observeVisibleThreadSnapshot, [expectedHandle, expectedStatusUrl, pass, readyEvidence], { requireResult: true });
    } catch (error) {
      throw categorizedError(FAILURE_CATEGORY.THREAD_OBSERVATION_FAILED, error instanceof Error ? error.message : String(error), {
        statusUrl: expectedStatusUrl,
        statusId: String(expectedStatusUrl).match(/\/status\/(\d+)/)?.[1] || null,
        expectedAuthor: expectedHandle,
        elapsedMs: Date.now() - startedMs,
        failureReason: error instanceof Error ? error.message : String(error),
        causeCode: categoryFromError(error),
        causeDiagnostics: error?.diagnostics || null
      });
    }
    if (lastObservation?.parentFound && (lastObservation.fullyObserved || pass === 2)) {
      return { ...lastObservation, observationStartedAt: startedAt, elapsedMs: Date.now() - startedMs, observationAttempts: pass + 1 };
    }
    if (pass < 2) await wait(700);
  }
  if (!lastObservation || typeof lastObservation !== "object") {
    throw categorizedError(FAILURE_CATEGORY.THREAD_OBSERVATION_FAILED, "status threadのDOM観測結果が返りませんでした。", { expectedHandle, expectedStatusUrl, elapsedMs: Date.now() - startedMs });
  }
  return { ...lastObservation, observationStartedAt: startedAt, elapsedMs: Date.now() - startedMs, observationAttempts: 3 };
}

function observeVisibleThreadSnapshot(expectedHandle = "", expectedStatusUrl = "", pass = 0, readyEvidence = null) {
    const observationStartedAt = new Date().toISOString();
    const observationStartedMs = Date.now();
    const articles = () => Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const before = articles().length;
    const canonicalStatus = (value) => {
      const raw = String(value || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
      const match = raw.match(/^(?:https:\/\/x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
      return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
    };
    const targetUrl = canonicalStatus(expectedStatusUrl);
    const currentUrl = canonicalStatus(location.href);
    const handle = String(expectedHandle || "").replace(/^@/, "").toLowerCase();
    const relevantExpand = (button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.trim();
      const testId = button.getAttribute("data-testid") || "";
      const label = /返信をさらに表示|さらに返信を表示|他の返信を表示|Show more replies|Load more replies|View more replies|Show additional replies|More replies/i.test(text);
      const threadCue = /reply|repl|thread|返信/i.test(text) || /reply|repl|thread/i.test(testId);
      return !button.hasAttribute("disabled") && label && threadCue;
    };
    const clicked = [];
    const scrollPasses = [];
    for (const button of Array.from(document.querySelectorAll('button, [role="button"]'))) {
      const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.trim();
      if (relevantExpand(button)) {
        button.click();
        clicked.push(label.slice(0, 80));
      }
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    window.scrollTo({ top: Math.max(0, document.documentElement.scrollHeight - window.innerHeight), behavior: "instant" });
    scrollPasses.push(pass + 1);
    const remainingExpand = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(relevantExpand)
      .map((button) => `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.trim().slice(0, 80));
    const visibleArticles = articles();
    const articleAuthor = (article) => Array.from(article.querySelectorAll('[data-testid="User-Name"] a[href]'))
      .map((link) => String(link.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0].toLowerCase())
      .find((value) => /^[a-z0-9_]{1,15}$/i.test(value)) || "";
    const isDirectAnchor = (link, article) => {
      let node = link.parentElement;
      while (node && node !== article) {
        if (node.matches?.('article[data-testid="tweet"]')) return false;
        node = node.parentElement;
      }
      return true;
    };
    const ownArticles = visibleArticles.filter((article) => !handle || articleAuthor(article) === handle);
    const linksFound = ownArticles.flatMap((article) => Array.from(article.querySelectorAll("a[href]"))
      .map((link) => String(link.getAttribute("href") || ""))
      .filter((href) => /^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(href)));
    const exactTargetArticles = visibleArticles.filter((article) => Array.from(article.querySelectorAll("a[href]")).some((link) => isDirectAnchor(link, article) && canonicalStatus(link.getAttribute("href")) === targetUrl));
    const readyFallback = exactTargetArticles.length === 0
      && Boolean(readyEvidence?.ready)
      && currentUrl === targetUrl
      && canonicalStatus(readyEvidence.currentUrl) === targetUrl
      && String(readyEvidence.parentAuthor || "").toLowerCase() === handle
      && Number(readyEvidence.parentCandidateCount) === 1
      && ownArticles.length === 1;
    const parentFound = Boolean(targetUrl && (exactTargetArticles.length === 1 || readyFallback));
    const articleCountAfter = visibleArticles.length;
    const observationCompleteness = parentFound && pass >= 2 && remainingExpand.length === 0 ? "complete" : "partial";
    return {
      observationFinishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - observationStartedMs,
      articleCountBefore: before,
      articleCountAfter,
      parentFound,
      sameAuthorReplyCount: Math.max(0, ownArticles.length - (parentFound ? 1 : 0)),
      parentDetection: exactTargetArticles.length === 1 ? "target_status_id_exact" : readyFallback ? "ready_verified_target_identity_fallback" : "not_found",
      readyFallbackUsed: readyFallback,
      clickedExpandCount: clicked.length,
      remainingExpandCount: remainingExpand.length,
      remainingExpandLabels: remainingExpand.slice(0, 10),
      scrollPasses: scrollPasses.length,
      linksFound: [...new Set(linksFound)],
      fullyObserved: observationCompleteness === "complete",
      observationCompleteness,
      reason: !parentFound ? "PARENT_NOT_FOUND" : remainingExpand.length ? "RELEVANT_REPLY_EXPAND_REMAINS" : "OBSERVED_STABLE",
      observationPass: pass,
      observationStartedAt,
      observationElapsedMs: Date.now() - observationStartedMs
    };
}

async function waitForStatusReady(tabId, expectedHandle, expectedStatusUrl, timeoutMs = 18000) {
  const target = statusParts(expectedStatusUrl);
  if (!target) throw categorizedError(FAILURE_CATEGORY.STATUS_PARENT_NOT_FOUND, "対象status URLを解析できませんでした。", { expectedStatusUrl });
  const startedAt = Date.now();
  let lastState = null;
  let lastExecutionError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastState = await executeMain(tabId, inspectXStatusReady, [target, expectedHandle], { requireResult: true });
      lastExecutionError = null;
    } catch (error) {
      lastExecutionError = error instanceof Error ? error.message : String(error);
      await wait(300);
      continue;
    }
    if (lastState.hasChallenge) throw categorizedError(FAILURE_CATEGORY.LOGIN_OR_CHALLENGE, "Xのログイン/認証画面を検知しました。", lastState);
    if (lastState.isPrivate) throw categorizedError(FAILURE_CATEGORY.PRIVATE, "鍵付き/private statusのためthreadを閲覧できません。", lastState);
    if (lastState.hasRetry) throw categorizedError(FAILURE_CATEGORY.X_TEMPORARY_ERROR, "Xの一時エラー/Retry表示を検知しました。", lastState);
    if (lastState.ready) return lastState;
    await wait(500);
  }
  throw categorizedError(FAILURE_CATEGORY.STATUS_PARENT_NOT_FOUND, "対象statusの親articleまたはauthor一致を確認できませんでした。", { ...lastState, expectedStatusUrl, expectedHandle, lastExecutionError });
}

const FAILURE_CATEGORY = {
  EXECUTE_SCRIPT_NO_RESULT: "EXECUTE_SCRIPT_NO_RESULT",
  INJECTED_FUNCTION_ERROR: "INJECTED_FUNCTION_ERROR",
  RESULT_SERIALIZATION_FAILED: "RESULT_SERIALIZATION_FAILED",
  RESULT_UNDEFINED: "RESULT_UNDEFINED",
  RESULT_EMPTY: "RESULT_EMPTY",
  RESULT_FRAME_MISSING: "RESULT_FRAME_MISSING",
  TAB_NOT_READY: "TAB_NOT_READY",
  STATUS_PARENT_NOT_FOUND: "STATUS_PARENT_NOT_FOUND",
  NAVIGATION_TIMEOUT: "NAVIGATION_TIMEOUT",
  PAGE_LOAD_TIMEOUT: "PAGE_LOAD_TIMEOUT",
  VIDEO_VALIDATION_NO_RESULT: "VIDEO_VALIDATION_NO_RESULT",
  VIDEO_VALIDATION_TIMEOUT: "VIDEO_VALIDATION_TIMEOUT",
  API_FETCH_FAILED: "API_FETCH_FAILED",
  API_HTTP_ERROR: "API_HTTP_ERROR",
  API_RESPONSE_INVALID: "API_RESPONSE_INVALID",
  NO_TWEET_ARTICLES: "NO_TWEET_ARTICLES",
  OWN_POST_FILTER_ZERO: "OWN_POST_FILTER_ZERO",
  ONLY_REPOSTS_OR_REPLIES: "ONLY_REPOSTS_OR_REPLIES",
  SENSITIVE_CONTENT_GATE: "SENSITIVE_CONTENT_GATE",
  LOGIN_OR_CHALLENGE: "LOGIN_OR_CHALLENGE",
  DOM_SELECTOR_MISMATCH: "DOM_SELECTOR_MISMATCH",
  PROFILE_NOT_FOUND_SUSPENDED: "PROFILE_NOT_FOUND/SUSPENDED",
  PRIVATE: "PRIVATE",
  NO_POSTS: "NO_POSTS",
  X_TEMPORARY_ERROR: "X_TEMPORARY_ERROR",
  THREAD_NOT_FULLY_OBSERVED: "THREAD_NOT_FULLY_OBSERVED",
  THREAD_OBSERVATION_FAILED: "THREAD_OBSERVATION_FAILED",
  UNKNOWN: "UNKNOWN"
};

const NON_RETRYABLE_CATEGORIES = new Set([
  FAILURE_CATEGORY.LOGIN_OR_CHALLENGE,
  FAILURE_CATEGORY.PROFILE_NOT_FOUND_SUSPENDED,
  FAILURE_CATEGORY.PRIVATE,
  FAILURE_CATEGORY.NO_POSTS,
  FAILURE_CATEGORY.SENSITIVE_CONTENT_GATE,
  FAILURE_CATEGORY.INJECTED_FUNCTION_ERROR,
  FAILURE_CATEGORY.RESULT_SERIALIZATION_FAILED,
  FAILURE_CATEGORY.RESULT_UNDEFINED,
  FAILURE_CATEGORY.RESULT_EMPTY,
  FAILURE_CATEGORY.RESULT_FRAME_MISSING
]);
const LIMITED_RETRY_CATEGORIES = new Set([
  FAILURE_CATEGORY.EXECUTE_SCRIPT_NO_RESULT,
  FAILURE_CATEGORY.NAVIGATION_TIMEOUT,
  FAILURE_CATEGORY.PAGE_LOAD_TIMEOUT,
  FAILURE_CATEGORY.X_TEMPORARY_ERROR,
  FAILURE_CATEGORY.NO_TWEET_ARTICLES,
  FAILURE_CATEGORY.TAB_NOT_READY,
  FAILURE_CATEGORY.STATUS_PARENT_NOT_FOUND,
  FAILURE_CATEGORY.THREAD_NOT_FULLY_OBSERVED,
  FAILURE_CATEGORY.THREAD_OBSERVATION_FAILED
]);

function categorizedError(category, message, diagnostics = {}) {
  const error = new Error(`${category}: ${message}`);
  error.category = category;
  error.retryable = !NON_RETRYABLE_CATEGORIES.has(category);
  error.diagnostics = diagnostics;
  return error;
}

function categoryFromError(error) {
  if (error?.category) return error.category;
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/(?:^|Error:\s*)([A-Z_/]+):\s*/);
  return match?.[1] || FAILURE_CATEGORY.UNKNOWN;
}

function isRetryableError(error) {
  const category = categoryFromError(error);
  return LIMITED_RETRY_CATEGORIES.has(category) && !NON_RETRYABLE_CATEGORIES.has(category);
}

async function prepareRetry(tabId, item) {
  const url = `${item.creator_x_url}?myfans_creator_id=${item.creator_id}`;
  await chrome.tabs.update(tabId, { url, active: false });
  await waitForTabComplete(tabId, 45000);
  await wait(1500);
  await executeMain(tabId, async () => {
    window.scrollTo({ top: 700, behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 900));
    window.scrollTo({ top: 0, behavior: "instant" });
  }).catch(() => undefined);
}

function humanReasonForCategory(category) {
  return {
    EXECUTE_SCRIPT_NO_RESULT: "Xページから実行結果が返りませんでした。",
    INJECTED_FUNCTION_ERROR: "Xページ内の収集関数でエラーが発生しました。",
    RESULT_SERIALIZATION_FAILED: "Xページ内の収集結果を安全なJSONに変換できませんでした。",
    RESULT_UNDEFINED: "Xページ内の収集関数がundefinedを返しました。",
    RESULT_EMPTY: "Xページ内のexecuteScript結果が空でした。",
    RESULT_FRAME_MISSING: "Xページ内のexecuteScript結果に対象frameがありませんでした。",
    TAB_NOT_READY: "Xタブの準備が完了していません。",
    STATUS_PARENT_NOT_FOUND: "対象statusの親articleとauthor一致を確認できません。",
    NAVIGATION_TIMEOUT: "Xプロフィールへの移動が完了しませんでした。",
    PAGE_LOAD_TIMEOUT: "Xプロフィールの読み込みが完了しませんでした。",
    VIDEO_VALIDATION_NO_RESULT: "動画URL検証の結果が返りませんでした。",
    VIDEO_VALIDATION_TIMEOUT: "動画URL検証が時間切れになりました。",
    API_FETCH_FAILED: "localhost APIへ到達できませんでした。",
    API_HTTP_ERROR: "localhost APIがHTTPエラーを返しました。",
    API_RESPONSE_INVALID: "localhost APIの応答をJSONとして読めませんでした。",
    NO_TWEET_ARTICLES: "投稿DOMがまだ表示されていません。",
    OWN_POST_FILTER_ZERO: "本人投稿のURLを抽出できませんでした。",
    ONLY_REPOSTS_OR_REPLIES: "表示範囲がリポスト/返信のみでした。",
    SENSITIVE_CONTENT_GATE: "センシティブ警告で投稿一覧が見えません。",
    LOGIN_OR_CHALLENGE: "Xのログイン/認証画面を検知しました。",
    DOM_SELECTOR_MISMATCH: "XのDOM構造が想定と違います。",
    "PROFILE_NOT_FOUND/SUSPENDED": "プロフィールが存在しない、または凍結/停止されています。",
    PRIVATE: "鍵付き/privateアカウントのため投稿を閲覧できません。",
    NO_POSTS: "投稿がないことを確認しました。",
    X_TEMPORARY_ERROR: "Xの一時エラー表示を検知しました。",
    THREAD_OBSERVATION_FAILED: "status threadのDOM観測に失敗しました。次回の収集で再試行します。",
    UNKNOWN: "原因を分類できませんでした。"
  }[category] || "原因を分類できませんでした。";
}

function structuredFailure(stage, errorCode, errorMessage, diagnostics = {}) {
  return {
    ok: false,
    stage,
    quoteCandidates: [],
    errorCode,
    errorMessage: errorMessage || humanReasonForCategory(errorCode),
    diagnostics
  };
}

function ensureStructuredScanResult(value, fallbackStage = "EXTRACT") {
  if (value && typeof value === "object") {
    const quoteCandidates = Array.isArray(value.quoteCandidates) ? value.quoteCandidates : [];
    return {
      ok: value.ok !== false && quoteCandidates.length > 0,
      stage: value.stage || "FINALIZE",
      errorCode: value.errorCode || null,
      errorMessage: value.errorMessage || null,
      diagnostics: value.diagnostics || {},
      ...value,
      quoteCandidates
    };
  }
  return structuredFailure(
    fallbackStage,
    FAILURE_CATEGORY.EXECUTE_SCRIPT_NO_RESULT,
    "Xページから引用候補の実行結果が返りませんでした。",
    { returnedType: value === null ? "null" : typeof value }
  );
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function safeApiEndpoint(url) {
  try {
    const parsed = new URL(String(url || ""));
    const local = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      urlKind: local ? "localhost_api" : "non_local_api",
      hasQuery: Boolean(parsed.search),
      hasCredentials: Boolean(parsed.username || parsed.password)
    };
  } catch {
    return { origin: "", pathname: "", urlKind: "invalid_api_url", hasQuery: false, hasCredentials: false };
  }
}

async function fetchCompanionJson(url, init, operation) {
  const endpoint = safeApiEndpoint(url);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw categorizedError(FAILURE_CATEGORY.API_FETCH_FAILED, "localhost APIへ到達できませんでした。", {
      operation,
      endpoint,
      httpReached: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedMs,
      transportError: error instanceof Error ? error.message : String(error)
    });
  }
  const text = await response.text().catch((error) => {
    throw categorizedError(FAILURE_CATEGORY.API_RESPONSE_INVALID, "localhost APIの応答本文を読み取れませんでした。", {
      operation, endpoint, httpReached: true, status: response.status, statusText: response.statusText,
      readError: error instanceof Error ? error.message : String(error)
    });
  });
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw categorizedError(FAILURE_CATEGORY.API_RESPONSE_INVALID, "localhost APIの応答をJSONとして読めませんでした。", {
      operation, endpoint, httpReached: true, status: response.status, statusText: response.statusText,
      responseContentType: response.headers.get("content-type") || "", responseBodyLength: text.length,
      parseError: error instanceof Error ? error.message : String(error)
    });
  }
  if (!response.ok) {
    const error = categorizedError(FAILURE_CATEGORY.API_HTTP_ERROR, payload?.error || `localhost APIがHTTP ${response.status}を返しました。`, {
      operation, endpoint, httpReached: true, status: response.status, statusText: response.statusText,
      responseErrorCode: payload?.errorCode || null, responseRetryable: payload?.retryable ?? null
    });
    error.remotePayload = payload;
    throw error;
  }
  return payload;
}

function dailyPageContext(urlValue) {
  try {
    const url = new URL(String(urlValue || ""));
    if (!isMyfansAdminUrl(url.href)) return null;
    const media = url.searchParams.get("media");
    return {
      baseUrl: url.origin,
      approvedMediaId: /^[1-9]\d*$/.test(media || "") ? media : ""
    };
  } catch {
    return null;
  }
}

async function getCompanionSettings() {
  const stored = await chrome.storage.local.get([COMPANION_SETTINGS_KEY, QUOTE_SETTINGS_KEY, QUOTE_STATE_KEY]);
  const saved = stored[COMPANION_SETTINGS_KEY] || stored[QUOTE_SETTINGS_KEY] || {};
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const detected = dailyPageContext(tab?.url);
  const settings = { ...saved };
  if (detected) {
    settings.baseUrl = detected.baseUrl;
    if (detected.approvedMediaId) settings.approvedMediaId = detected.approvedMediaId;
    await chrome.storage.local.set({ [COMPANION_SETTINGS_KEY]: settings });
  }
  const rawState = stored[QUOTE_STATE_KEY] || null;
  const progress = rawState?.jobId ? await fetchQuoteProgress(settings, rawState).catch(() => null) : null;
  const state = MyfansCompanionState.sanitizeForDisplay(rawState, progress?.job || null, WORKER_VERSION);
  if (rawState && state.status !== rawState.status) await chrome.storage.local.set({ [QUOTE_STATE_KEY]: state });
  if (rawState && MyfansCompanionState.shouldInvalidateStoredRun(settings, rawState, WORKER_VERSION)) {
    await chrome.alarms.clear(QUOTE_ALARM_NAME).catch(() => undefined);
    await chrome.storage.local.remove([QUOTE_SETTINGS_KEY]);
  }
  return { settings, detected, state, progress };
}

async function saveCompanionSettings(settings) {
  const current = await chrome.storage.local.get([COMPANION_SETTINGS_KEY]);
  const next = { ...(current[COMPANION_SETTINGS_KEY] || {}), ...settings };
  await chrome.storage.local.set({ [COMPANION_SETTINGS_KEY]: next });
  return next;
}

async function fetchQuoteProgress(settings, state) {
  const base = normalizeBaseUrl(settings?.baseUrl);
  if (!base) return null;
  const query = new URLSearchParams();
  const jobId = state?.jobId || settings?.jobId;
  if (jobId) query.set("jobId", String(jobId));
  else if (settings?.approvedMediaId) query.set("approvedMediaId", String(settings.approvedMediaId));
  else return null;
  const response = await fetch(`${base}/api/admin/myfans/quote-refresh?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `進捗取得に失敗しました (${response.status})`);
  return payload;
}

async function setQuoteState(patch) {
  const stored = await chrome.storage.local.get([QUOTE_STATE_KEY]);
  const next = { ...(stored[QUOTE_STATE_KEY] || {}), ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [QUOTE_STATE_KEY]: next });
  return next;
}

async function appendQuoteAttemptDiagnostic(entry) {
  const stored = await chrome.storage.local.get([QUOTE_STATE_KEY]);
  const current = stored[QUOTE_STATE_KEY] || {};
  return setQuoteState({ attemptDiagnostics: MyfansCompanionState.appendAttemptDiagnostic(current, entry) });
}

async function saveQuoteSettings(settings) {
  await chrome.storage.local.set({ [QUOTE_SETTINGS_KEY]: settings });
}

async function clearQuoteContinuation() {
  await chrome.alarms.clear(QUOTE_ALARM_NAME).catch(() => undefined);
  await chrome.storage.local.remove([QUOTE_SETTINGS_KEY]);
}

async function scheduleQuoteContinuation(settings, delayMs = 5000) {
  await saveQuoteSettings(settings);
  await chrome.alarms.create(QUOTE_ALARM_NAME, { when: Date.now() + Math.max(1000, delayMs) });
}

async function quoteRefreshRequest(settings, body) {
  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/quote-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, approvedMediaId: settings.approvedMediaId || null, approvedMediaName: settings.approvedMediaName || "@lumi_reviw" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `更新キュー操作に失敗しました (${response.status})`);
  return payload;
}

async function sendPayload(settings, result) {
  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/companion`;
  const payload = await fetchCompanionJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, refreshJobId: settings.jobId || result.refreshJobId || null, collectionSessionId: settings.sessionId || result.collectionSessionId || null, runToken: settings.runToken || result.runToken || null, collectorVersion: settings.collectorVersion || WORKER_VERSION, approvedMediaId: settings.approvedMediaId || null, approvedMediaName: settings.approvedMediaName || "@lumi_reviw" })
  }, result.type === "x_single_status_collect" ? "single_status_save" : "companion_save");
  if (payload && payload.ok === false) {
    const error = new Error(payload.error || "保存側がretryable/failedを返しました。");
    error.code = payload.errorCode || (payload.retryable ? "THREAD_NOT_FULLY_OBSERVED" : "REMOTE_REJECTED");
    error.retryable = payload.retryable !== false;
    error.diagnostics = payload;
    throw error;
  }
  if (result.type === "x_single_status_collect" && (payload?.ok !== true || payload?.singleStatusRunId !== result.singleStatusRunId || payload?.saveReached !== true)) {
    const error = categorizedError(FAILURE_CATEGORY.API_RESPONSE_INVALID, "同一runの保存成功応答を確認できませんでした。", { payload, expectedRunId: result.singleStatusRunId, saveReached: payload?.saveReached ?? false });
    error.remotePayload = payload;
    throw error;
  }
  return payload;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (!["install", "update"].includes(details.reason)) return;
  chrome.storage.local.get([COMPANION_SETTINGS_KEY, QUOTE_SETTINGS_KEY, QUOTE_STATE_KEY, DIAGNOSTIC_STATE_KEY, SINGLE_STATUS_STATE_KEY]).then(async (stored) => {
    const state = stored[QUOTE_STATE_KEY];
    const settings = stored[COMPANION_SETTINGS_KEY] || stored[QUOTE_SETTINGS_KEY];
    const activeState = (value) => value?.running === true || ["starting", "running", "scheduled"].includes(value?.status);
    const staleQuote = MyfansCompanionState.shouldInvalidateStoredRun(settings, state, WORKER_VERSION);
    const staleSingleOrDiagnostic = [stored[DIAGNOSTIC_STATE_KEY], stored[SINGLE_STATUS_STATE_KEY]].some((value) => activeState(value) && value?.workerVersion !== WORKER_VERSION);
    if (!staleQuote && !staleSingleOrDiagnostic) return;
    if (staleQuote) await chrome.alarms.clear(QUOTE_ALARM_NAME).catch(() => undefined);
    await chrome.storage.local.remove([...(staleQuote ? [QUOTE_SETTINGS_KEY, QUOTE_STATE_KEY] : []), ...(staleSingleOrDiagnostic ? [DIAGNOSTIC_STATE_KEY, SINGLE_STATUS_STATE_KEY] : [])]);
  }).catch((error) => console.debug("[myfans companion background] stale state cleanup failed", error));
});

async function assertWorkerTabAlive(tabId) {
  try {
    await chrome.tabs.get(tabId);
  } catch (error) {
    throw categorizedError(FAILURE_CATEGORY.TAB_NOT_READY, error instanceof Error ? error.message : "worker tabが存在しません。", { tabId });
  }
}

async function isQuoteCancelRequested(jobId) {
  const stored = await chrome.storage.local.get([QUOTE_CANCEL_KEY]);
  return Boolean(stored[QUOTE_CANCEL_KEY] && (!jobId || stored[QUOTE_CANCEL_KEY].jobId === jobId));
}

async function requestQuoteCancel(jobId) {
  await chrome.storage.local.set({ [QUOTE_CANCEL_KEY]: { jobId, requestedAt: new Date().toISOString() } });
}

function diagnosticStatusUrl(value) {
  try {
    const raw = String(value || "").trim().replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    const url = new URL(raw);
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/i);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "x.com" && match
      ? `https://x.com/${match[1]}/status/${match[2]}`
      : "";
  } catch {
    return "";
  }
}

async function runDiagnosticStatus(settings) {
  if (diagnosticRunning) return;
  diagnosticRunning = true;
  const diagnosticRunId = settings.diagnosticRunId || `diag-${Date.now()}`;
  const requestedStatusUrl = settings.sourceStatusUrl || null;
  const transitions = [];
  let currentStage = "VALIDATE_INPUT";
  const statusUrl = diagnosticStatusUrl(requestedStatusUrl);
  const handle = statusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "";
  const writeState = (patch) => chrome.storage.local.set({ myfansDiagnosticState: {
    workerVersion: WORKER_VERSION,
    status: "running",
    diagnosticMode: true,
    diagnosticRunId,
    sourceStatusUrl: statusUrl || requestedStatusUrl,
    stage: currentStage,
    transitions,
    ...patch
  } });
  const stage = async (name, fn, diagnostics = {}) => {
    currentStage = name;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    transitions.push({ stage: name, status: "started", startedAt, diagnostics });
    await writeState({ stage: name });
    try {
      const result = await fn();
      transitions.push({ stage: name, status: "completed", startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedMs, diagnostics: result?.diagnostics || diagnostics });
      await writeState({ stage: name, elapsedMs: Date.now() - startedMs });
      return result;
    } catch (error) {
      const errorCode = categoryFromError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDiagnostics = error?.diagnostics || diagnostics;
      transitions.push({ stage: name, status: "failed", startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedMs, errorCode, errorMessage, diagnostics: errorDiagnostics });
      error.stage = name;
      error.diagnostics = errorDiagnostics;
      throw error;
    }
  };
  let diagnosticWorkerTabId = null;
  let originalTabId = null;
  let workerRetryCount = 0;
  let threadResult = null;
  let observation = null;
  try {
    await writeState({ stage: "VALIDATE_INPUT" });
    if (!statusUrl || !handle) throw categorizedError("INVALID_STATUS_URL", "診断対象はx.comのstatus URLを指定してください。", { requestedStatusUrl });
    const [currentTab] = await stage("GET_ORIGINAL_TAB", () => chrome.tabs.query({ active: true, currentWindow: true }), {});
    originalTabId = currentTab?.id || null;
    while (true) {
      try {
        diagnosticWorkerTabId = await stage("CREATE_WORKER_TAB", async () => {
          try {
            const workerTab = await chrome.tabs.create({ url: "about:blank", active: true, openerTabId: currentTab?.id });
            if (!Number.isSafeInteger(workerTab?.id)) throw new Error("worker tab IDが返りませんでした。");
            return workerTab.id;
          } catch (error) {
            throw categorizedError("WORKER_TAB_CREATE_FAILED", error instanceof Error ? error.message : String(error));
          }
        });
        await stage("NAVIGATE_STATUS", async () => {
          await assertWorkerTabAlive(diagnosticWorkerTabId);
          try {
            await chrome.tabs.update(diagnosticWorkerTabId, { url: statusUrl, active: false });
            await waitForStatusNavigation(diagnosticWorkerTabId, statusUrl, 45000);
          } catch (error) {
            if (isWorkerTabLostError(error)) throw error;
            throw categorizedError(categoryFromError(error) === FAILURE_CATEGORY.NAVIGATION_TIMEOUT ? FAILURE_CATEGORY.NAVIGATION_TIMEOUT : "NAVIGATION_FAILED", error instanceof Error ? error.message : String(error), { statusUrl, tabId: diagnosticWorkerTabId });
          }
        }, { statusUrl, tabId: diagnosticWorkerTabId });
        const ready = await stage("WAIT_STATUS_READY", () => waitForStatusReady(diagnosticWorkerTabId, handle, statusUrl, 18000), { statusUrl, tabId: diagnosticWorkerTabId });
        observation = await stage("COLLECT_THREAD", () => observeVisibleThread(diagnosticWorkerTabId, handle, statusUrl), { statusUrl, tabId: diagnosticWorkerTabId });
        threadResult = await stage("COLLECT_THREAD_RESULT", () => executeMain(diagnosticWorkerTabId, collectXStatusThreadReplies, [{ sourceXHandle: handle, sourceStatusUrl: statusUrl }], { requireResult: true }), { statusUrl, tabId: diagnosticWorkerTabId, ready });
        if (!threadResult?.ok) throw categorizedError(threadResult?.errorCode || "THREAD_RESULT_FAILED", threadResult?.errorMessage || "status threadの取得に失敗しました。", { observation, threadResult });
        break;
      } catch (error) {
        if (workerRetryCount < 1 && isWorkerTabLostError(error)) {
          workerRetryCount += 1;
          const oldTabId = diagnosticWorkerTabId;
          transitions.push({ stage: "RECREATE_WORKER_TAB", status: "started", oldTabId, retry: workerRetryCount });
          await writeState({ stage: "RECREATE_WORKER_TAB", workerRetryCount, oldTabId });
          if (oldTabId) await chrome.tabs.remove(oldTabId).catch(() => undefined);
          diagnosticWorkerTabId = null;
          continue;
        }
        throw error;
      }
    }
    if (!threadResult?.ok) throw new Error("status threadの取得に失敗しました。");
    if (String(threadResult.sourceAuthorHandle || "").toLowerCase() !== handle.toLowerCase()) throw new Error("status元投稿のauthorが指定handleと一致しません。");
    for (const candidate of threadResult.quoteCandidates || []) {
      candidate.resolverEvidence = (candidate.myfansUrls || [])
        .filter((url) => !/^https:\/\/t\.co\//i.test(url))
        .map((url) => ({ method: "direct_dom", sourceUrl: url, resolvedUrl: url, resolved: true }));
      for (const redirectUrl of (candidate.myfansUrls || []).filter((url) => /^https:\/\/t\.co\//i.test(url))) {
        const resolveStartedAt = new Date().toISOString();
        const resolveStartedMs = Date.now();
        await chrome.tabs.update(diagnosticWorkerTabId, { url: redirectUrl, active: true });
        await waitForTabComplete(diagnosticWorkerTabId, 30000);
        let resolvedUrl = "";
        for (let redirectAttempt = 0; redirectAttempt < 15; redirectAttempt += 1) {
          resolvedUrl = (await chrome.tabs.get(diagnosticWorkerTabId)).url || "";
          if (/^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(resolvedUrl)) break;
          await wait(1000);
        }
        if (!/^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(resolvedUrl)) {
          resolvedUrl = await executeMain(diagnosticWorkerTabId, () => location.href).catch(() => resolvedUrl);
        }
        if (/^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(resolvedUrl)) {
          candidate.observedMfcoLink = true;
          candidate.myfansUrls = [...new Set([...(candidate.myfansUrls || []).filter((url) => !/^https:\/\/t\.co\//i.test(url)), resolvedUrl.replace(/[?#].*$/, "")])];
        }
        candidate.resolverEvidence.push({
          method: "redirect_tracking",
          sourceUrl: redirectUrl,
          resolvedUrl: /^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(resolvedUrl) ? resolvedUrl.replace(/[?#].*$/, "") : null,
          resolved: /^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(resolvedUrl),
          startedAt: resolveStartedAt,
          finishedAt: new Date().toISOString(),
          elapsedMs: Date.now() - resolveStartedMs
        });
        if (candidate.linkDiagnostics) {
          candidate.linkDiagnostics.resolvedLinkCount = candidate.myfansUrls.length;
          candidate.linkDiagnostics.acceptedMyfansLinkCount = candidate.myfansUrls.filter((url) => /^https:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(url)).length;
          candidate.linkDiagnostics.resolverEvidenceCount = candidate.resolverEvidence.length;
        }
      }
    }
    const payload = await sendPayload({ ...settings, diagnosticMode: true, sourceStatusUrl: statusUrl, diagnosticRunId }, { type: "x_diagnostic_status_scan", diagnosticMode: true, sourceStatusUrl: statusUrl, sourceXHandle: handle, diagnosticRunId, quoteCandidates: threadResult.quoteCandidates || [] });
    await chrome.storage.local.set({ myfansDiagnosticState: { workerVersion: WORKER_VERSION, status: "done", diagnosticMode: true, diagnosticRunId, sourceStatusUrl: statusUrl, sourceXHandle: handle, sourceAuthorHandle: threadResult.sourceAuthorHandle, replyCandidates: threadResult.quoteCandidates || [], stage: "SAVE_RESULT", errorCode: null, error: null, transitions, observationDiagnostics: observation, threadResultDiagnostics: threadResult.diagnostics || null, ...payload } });
  } catch (error) {
    const errorCode = categoryFromError(error);
    await chrome.storage.local.set({ myfansDiagnosticState: { workerVersion: WORKER_VERSION, status: "error", diagnosticMode: true, diagnosticRunId, sourceStatusUrl: statusUrl || requestedStatusUrl, sourceXHandle: handle || null, stage: error.stage || currentStage, errorCode, error: error instanceof Error ? error.message : String(error), transitions, observationDiagnostics: observation, threadResultDiagnostics: threadResult?.diagnostics || null, workerRetryCount } });
  } finally {
    if (originalTabId) await chrome.tabs.update(originalTabId, { active: true }).catch(() => undefined);
    if (diagnosticWorkerTabId) await chrome.tabs.remove(diagnosticWorkerTabId).catch(() => undefined);
    diagnosticRunning = false;
  }
}

async function runSingleStatusCollection(settings) {
  const runId = String(settings.singleStatusRunId || "").trim();
  const sourceStatusUrl = diagnosticStatusUrl(settings.sourceStatusUrl);
  const runStartedAt = new Date().toISOString();
  if (!runId) {
    await chrome.storage.local.set({ myfansSingleStatusState: { status: "FAILED", runId: null, sourceStatusUrl, stage: "STARTING", reason: "missing_run_id", serverAccepted: false, saveReached: false } });
    return;
  }
  if (diagnosticRunning) {
    await chrome.storage.local.set({ myfansSingleStatusState: { status: "FAILED", runId, sourceStatusUrl, stage: "STARTING", reason: "SINGLE_RUN_ALREADY_ACTIVE", serverAccepted: false, saveReached: false, error: "別のCompanion収集が実行中です。" } });
    return;
  }
  diagnosticRunning = true;
  let workerTabId = null;
  let payloadSent = false;
  const transitions = [];
  let currentStage = "VALIDATE_INPUT";
  const writeState = (patch = {}) => chrome.storage.local.set({ myfansSingleStatusState: {
    workerVersion: WORKER_VERSION,
    status: currentStage === "SAVE_RESULT" ? "SAVING" : currentStage === "VALIDATE_INPUT" ? "STARTING" : "COLLECTING",
    runId,
    sourceStatusUrl,
    startedAt: runStartedAt,
    stage: currentStage,
    transitions,
    current: true,
    serverAccepted: false,
    saveReached: false,
    reason: null,
    ...patch
  } });
  const stage = async (name, fn, diagnostics = {}) => {
    currentStage = name;
    const startedAt = new Date().toISOString();
    transitions.push({ stage: name, status: "started", startedAt, diagnostics });
    await writeState();
    try {
      const result = await fn();
      transitions.push({ stage: name, status: "completed", startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - Date.parse(startedAt), diagnostics });
      await writeState({ stage: name });
      return result;
    } catch (error) {
      const errorCode = categoryFromError(error);
      const message = error instanceof Error ? error.message : String(error);
      error.stage = name;
      error.diagnostics = { ...diagnostics, ...(error.diagnostics || {}) };
      transitions.push({ stage: name, status: "failed", startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - Date.parse(startedAt), errorCode, error: message, diagnostics: error.diagnostics });
      throw error;
    }
  };
  await writeState();
  try {
    const handle = sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "";
    if (!sourceStatusUrl || !handle) throw categorizedError("INVALID_STATUS_URL", "収集対象はx.comの正規status URLを指定してください。");
    const dailyPageTabId = Number.isSafeInteger(Number(settings.dailyPageTabId)) ? Number(settings.dailyPageTabId) : null;
    const [currentTab] = dailyPageTabId ? [await chrome.tabs.get(dailyPageTabId).catch(() => null)] : await chrome.tabs.query({ active: true, currentWindow: true });
    const originalTabId = currentTab?.id || dailyPageTabId;
    let result = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        workerTabId = await stage("CREATE_WORKER_TAB", async () => {
          const workerTab = await chrome.tabs.create({ url: "about:blank", active: false, openerTabId: originalTabId || undefined });
          if (!Number.isSafeInteger(workerTab?.id)) throw categorizedError("WORKER_TAB_CREATE_FAILED", "worker tab IDが返りませんでした。");
          return workerTab.id;
        }, { attempt, active: false });
        await stage("NAVIGATE_STATUS", async () => {
          await assertWorkerTabAlive(workerTabId);
          await chrome.tabs.update(workerTabId, { url: sourceStatusUrl, active: false });
          await waitForStatusNavigation(workerTabId, sourceStatusUrl, 45000);
        }, { attempt, tabId: workerTabId, statusUrl: sourceStatusUrl, active: false });
        await stage("WAIT_STATUS_READY", () => waitForStatusReady(workerTabId, handle, sourceStatusUrl, 18000), { attempt, tabId: workerTabId, statusUrl: sourceStatusUrl });
        const threadObservation = await stage("COLLECT_THREAD", () => observeVisibleThread(workerTabId, handle, sourceStatusUrl), { attempt, tabId: workerTabId, statusUrl: sourceStatusUrl });
        result = await stage("COLLECT_STATUS", () => executeMain(workerTabId, collectSingleXStatusCandidate, [{ sourceXHandle: handle, sourceStatusUrl }], { requireResult: true }), { attempt, tabId: workerTabId, statusUrl: sourceStatusUrl });
        result = { ...result, threadObservationDiagnostics: threadObservation };
        result = await stage("RESOLVE_LINK", async () => {
          const resolvedCandidate = await resolveCandidateMyfansLinks(workerTabId, result.candidate, sourceStatusUrl, handle);
          if ((result.candidate.myfansUrls || []).length > 0 && resolvedCandidate.myfansUrls.length === 0) {
            throw categorizedError("LINK_RESOLUTION_FAILED", "mfco/t.coを最終myfans投稿URLへ解決できませんでした。", { resolverEvidence: resolvedCandidate.resolvedProductEvidence || [] });
          }
          return { ...result, candidate: resolvedCandidate };
        }, { attempt, tabId: workerTabId, statusUrl: sourceStatusUrl });
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= 2 || !isWorkerTabLostError(error)) throw error;
        transitions.push({ stage: "RECREATE_WORKER_TAB", status: "retrying", attempt, errorCode: categoryFromError(error), error: error instanceof Error ? error.message : String(error) });
        await writeState({ stage: "RECREATE_WORKER_TAB", workerRetryCount: attempt });
        if (workerTabId) await chrome.tabs.remove(workerTabId).catch(() => undefined);
        workerTabId = null;
      }
    }
    if (!result) throw lastError || categorizedError("UNKNOWN", "指定statusの本文取得に失敗しました。");
    if (!result?.ok) throw categorizedError(result?.errorCode || FAILURE_CATEGORY.STATUS_PARENT_NOT_FOUND, result?.errorMessage || "指定statusの本文取得に失敗しました。", result?.diagnostics || {});
    currentStage = "SAVE_RESULT";
    const payload = await stage("SAVE_RESULT", () => sendPayload(settings, { type: "x_single_status_collect", sourceStatusUrl, sourceXHandle: handle, statusCandidate: result.candidate, singleStatusRunId: runId }), { statusUrl: sourceStatusUrl });
    payloadSent = true;
    await chrome.storage.local.set({ myfansSingleStatusState: { workerVersion: WORKER_VERSION, status: "SUCCEEDED", current: false, runId, sourceStatusUrl, startedAt: runStartedAt, stage: "SAVING", errorCode: null, error: null, reason: payload.resultReason || payload.resultCode || "saved", serverAccepted: true, saveReached: true, finishedAt: new Date().toISOString(), transitions, ...payload } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = categoryFromError(error);
    const failureDiagnostics = error?.diagnostics || {};
    if (!payloadSent && sourceStatusUrl) {
      await sendPayload(settings, {
        type: "x_single_status_collect",
        sourceStatusUrl,
        sourceXHandle: sourceStatusUrl.match(/^https:\/\/x\.com\/([^/]+)\/status\//i)?.[1] || "",
        singleStatusRunId: runId,
        collectionError: `${errorCode}: ${message}`,
        collectionFailure: { stage: error.stage || currentStage, errorCode, diagnostics: failureDiagnostics, transitions: transitions.slice(-12) }
      }).catch(() => undefined);
    }
    await chrome.storage.local.set({ myfansSingleStatusState: { workerVersion: WORKER_VERSION, status: "FAILED", current: false, runId, sourceStatusUrl, startedAt: runStartedAt, stage: error.stage || currentStage, errorCode, reason: error.remotePayload?.reason || message, serverAccepted: Boolean(error.remotePayload?.serverAccepted), saveReached: Boolean(error.remotePayload?.saveReached), error: message, failureDiagnostics, finishedAt: new Date().toISOString(), transitions, workerRetryCount: transitions.filter((entry) => entry.stage === "RECREATE_WORKER_TAB").length } });
  } finally {
    if (workerTabId) await chrome.tabs.remove(workerTabId).catch(() => undefined);
    diagnosticRunning = false;
  }
}

function collectSingleXStatusCandidate({ sourceXHandle, sourceStatusUrl }) {
  const canonical = (value) => {
    const raw = String(value || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    const match = raw.match(/^(?:https:\/\/x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
    return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
  };
  const targetUrl = canonical(sourceStatusUrl);
  const targetId = targetUrl.match(/\/status\/(\d+)/)?.[1] || "";
  const cleanHandle = (value) => String(value || "").replace(/^\//, "").split(/[/?#]/)[0];
  const articleHandle = (article) => Array.from(article.querySelectorAll('[data-testid="User-Name"] a[href]'))
    .map((link) => cleanHandle(link.getAttribute("href")))
    .find((handle) => /^[A-Za-z0-9_]{1,15}$/.test(handle)) || "";
  const isDirectAnchor = (link, article) => {
    let node = link.parentElement;
    while (node && node !== article) {
      if (node.matches?.('article[data-testid="tweet"]')) return false;
      node = node.parentElement;
    }
    return true;
  };
  const extractLinkUrls = (article) => {
    const urls = [];
    for (const link of Array.from(article.querySelectorAll("a[href]"))) {
      if (!isDirectAnchor(link, article)) continue;
      const visible = [link.getAttribute("href") || "", link.textContent || "", link.getAttribute("aria-label") || ""].join(" ");
      urls.push(...(visible.match(/https?:\/\/(?:www\.)?(?:mfco\.link|myfans\.jp)\/[^\s"'<>）)]+/gi) || []).map((url) => url.replace(/[?#].*$/, "").replace(/[.,。、]+$/, "")));
      try {
        const parsed = new URL(String(link.getAttribute("href") || ""), location.href);
        if (parsed.hostname.toLowerCase() === "t.co") urls.push(`${parsed.origin}${parsed.pathname}`);
      } catch {}
    }
    return [...new Set(urls)];
  };
  const extractText = (article) => {
    const direct = article.querySelector('[data-testid="tweetText"]')?.textContent?.replace(/\s+/g, " ").trim() || "";
    if (direct) return direct.slice(0, 180);
    return (article.innerText || "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 3).filter((line) => !/^(返信先:|Replying to|リポストしました|reposted|いいね|返信|リポスト|ブックマーク|共有|表示|Views?|Likes?|Reposts?|Replies?)(?:\s|$)/i.test(line)).filter((line) => !/^https?:\/\//i.test(line)).join(" ").slice(0, 180);
  };
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const exactParentArticles = articles.filter((item) => {
    const directTarget = Array.from(item.querySelectorAll("a[href]")).some((link) => isDirectAnchor(link, item) && canonical(link.getAttribute("href")) === targetUrl);
    const author = articleHandle(item);
    return directTarget && author.toLowerCase() === String(sourceXHandle || "").toLowerCase();
  });
  const article = exactParentArticles.length === 1 ? exactParentArticles[0] : null;
  if (!article) return { ok: false, errorCode: exactParentArticles.length > 1 ? "AMBIGUOUS_PARENT_ARTICLE" : "STATUS_PARENT_NOT_FOUND", errorMessage: exactParentArticles.length > 1 ? "対象statusに一致する親articleが複数あります。" : "対象status ID・authorに一致する親articleが表示されませんでした。", diagnostics: { articleCount: articles.length, targetStatusId, parentCandidateCount: exactParentArticles.length, authorCandidates: [...new Set(articles.map(articleHandle).filter(Boolean))].slice(0, 20) } };
  const authorHandle = articleHandle(article);
  const statusUrl = canonical(Array.from(article.querySelectorAll("a[href]")).map((link) => link.getAttribute("href")).find((href) => canonical(href) === targetUrl));
  const mediaHrefs = Array.from(article.querySelectorAll("a[href]"))
    .map((link) => String(link.getAttribute("href") || "").split(/[?#]/)[0])
    .filter((href) => /^\/[^/]+\/status\/\d+\/(photo|video)\/[1-9]\d*$/.test(href));
  const videoHref = mediaHrefs.find((href) => /\/video\//.test(href)) || "";
  const photoHref = mediaHrefs.find((href) => /\/photo\//.test(href)) || "";
  const hasVideo = Boolean(article.querySelector('[data-testid="videoPlayer"], video')) || Boolean(videoHref);
  const hasImage = Boolean(article.querySelector('[data-testid="tweetPhoto"] img')) || Boolean(photoHref);
  const mediaPermalink = videoHref || photoHref ? `https://x.com${videoHref || photoHref}` : "";
  const mediaType = videoHref ? "video" : photoHref ? "image" : hasVideo ? "video" : hasImage ? "image" : "none";
  return {
    ok: true,
    candidate: {
      xPostUrl: statusUrl,
      sourceXHandle,
      authorHandle,
      text: extractText(article),
      myfansUrls: extractLinkUrls(article),
      myfansLinkSource: "parent",
      mediaPermalink,
      verifiedVideoPermalink: videoHref ? mediaPermalink : "",
      generatedVideoPermalink: hasVideo ? `${targetUrl}/video/1` : "",
      validationStatus: mediaPermalink ? "dom_media_permalink" : hasVideo ? "needs_video_permalink_validation" : "not_media",
      mediaType,
      mediaCount: new Set(mediaHrefs).size || (hasVideo || hasImage ? 1 : 0),
      quoteVisualReady: Boolean(mediaPermalink),
      postedAt: article.querySelector("time")?.getAttribute("datetime") || null,
      likes: null,
      reposts: null,
      replies: null,
      bookmarks: null,
      views: null,
      hasImage,
      hasVideo,
      isPinned: false,
      isReply: false,
      isRepost: false,
      isQuote: Boolean(article.querySelector('div[role="link"] article')),
    },
    sourceStatusUrl: targetUrl,
    sourceAuthorHandle: authorHandle,
    authorStatusMatch: statusUrl === targetUrl && authorHandle.toLowerCase() === String(sourceXHandle).toLowerCase(),
    targetStatusId: targetId,
  };
}

async function markItemFailed(settings, jobId, itemId, error) {
  const baseMessage = error instanceof Error ? error.message : String(error || "取得に失敗しました");
  const errorCode = error && typeof error === "object" && error.code ? String(error.code) : categoryFromError(error);
  const codedMessage = errorCode && !baseMessage.startsWith(`${errorCode}:`) ? `${errorCode}: ${baseMessage}` : baseMessage;
  const diagnostics = error && typeof error === "object" && error.diagnostics ? error.diagnostics : null;
  const failureReason = diagnostics
    ? `${codedMessage} [diagnostics=${JSON.stringify(diagnostics)}]`
    : codedMessage;
  await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "x_quote_scan",
      refreshJobId: jobId,
      refreshJobItemId: itemId,
      collectionSessionId: settings.sessionId || null,
      runToken: settings.runToken || null,
      collectorVersion: settings.collectorVersion || WORKER_VERSION,
      creatorId: "",
      creatorXUrl: "",
      sourceXHandle: "",
      quoteCandidates: [],
      approvedMediaId: settings.approvedMediaId || null,
      approvedMediaName: settings.approvedMediaName || "@lumi_reviw",
      failureReason
    })
  }).catch(() => {});
}

async function visualVerificationRequest(settings, body) {
  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/visual-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, approvedMediaId: settings.approvedMediaId || null, approvedMediaName: settings.approvedMediaName || "@lumi_reviw" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `visual verificationに失敗しました (${response.status})`);
  return payload;
}

async function ensureWorkerTab(openerTabId) {
  const stored = await chrome.storage.local.get([WORKER_TAB_KEY]);
  if (stored[WORKER_TAB_KEY]) {
    try {
      await chrome.tabs.get(stored[WORKER_TAB_KEY]);
      return stored[WORKER_TAB_KEY];
    } catch {
      await chrome.storage.local.remove(WORKER_TAB_KEY);
    }
  }
  const tab = await chrome.tabs.create({ url: "about:blank", active: false, openerTabId });
  await chrome.storage.local.set({ [WORKER_TAB_KEY]: tab.id });
  return tab.id;
}

function isWorkerTabLostError(error) {
  const category = categoryFromError(error);
  const message = error instanceof Error ? error.message : String(error || "");
  return category === FAILURE_CATEGORY.TAB_NOT_READY
    || /No tab with id|tab.*(?:not found|does not exist)|Could not find tab/i.test(message);
}

async function recreateWorkerTabForStatus(openerTabId, oldTabId, statusUrl, expectedHandle) {
  if (oldTabId) await chrome.tabs.remove(oldTabId).catch(() => undefined);
  await chrome.storage.local.remove([WORKER_TAB_KEY]);
  const tabId = await ensureWorkerTab(openerTabId);
  await chrome.tabs.update(tabId, { url: statusUrl, active: false });
  await waitForStatusNavigation(tabId, statusUrl, 45000);
  const ready = await waitForStatusReady(tabId, expectedHandle, statusUrl, 18000);
  return {
    tabId,
    evidence: {
      recreatedAt: new Date().toISOString(),
      oldTabId: oldTabId ?? null,
      newTabId: tabId,
      currentUrl: ready.currentUrl,
      statusId: statusUrl.match(/\/status\/(\d+)/)?.[1] || null,
      expectedHandle,
      parentAuthor: ready.parentAuthor,
      authorMatch: String(ready.parentAuthor || "").toLowerCase() === String(expectedHandle || "").toLowerCase()
    }
  };
}

async function resolveWorkerTabLink(tabId, sourceUrl, statusUrl, expectedHandle) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  await chrome.tabs.update(tabId, { url: sourceUrl, active: false });
  const observedUrls = [];
  let lastObservedUrl = "";
  let finalUrl = "";
  const resolverStartedAt = Date.now();
  while (Date.now() - resolverStartedAt < 30000) {
    const tab = await chrome.tabs.get(tabId);
    const observedUrl = String(tab.url || "").replace(/[?#].*$/, "");
    if (observedUrl && observedUrl !== lastObservedUrl) {
      observedUrls.push(observedUrl);
      lastObservedUrl = observedUrl;
    }
    finalUrl = canonicalMyfansPostUrl(observedUrl);
    if (finalUrl) break;
    const pageUrl = await executeMain(tabId, () => location.href, [], { requireResult: true }).catch(() => "");
    const pageFinalUrl = canonicalMyfansPostUrl(pageUrl);
    if (pageFinalUrl) {
      finalUrl = pageFinalUrl;
      if (pageUrl && pageUrl !== lastObservedUrl) observedUrls.push(String(pageUrl).replace(/[?#].*$/, ""));
      break;
    }
    await wait(500);
  }
  const resolved = Boolean(finalUrl);
  await chrome.tabs.update(tabId, { url: statusUrl, active: false });
  await waitForStatusNavigation(tabId, statusUrl, 45000);
  const ready = await waitForStatusReady(tabId, expectedHandle, statusUrl, 18000);
  return {
    resolved,
    resolvedUrl: resolved ? finalUrl : "",
    evidence: {
      sourceUrl,
      observedMfcoUrl: /^https:\/\/(?:www\.)?mfco\.link\//i.test(sourceUrl) ? sourceUrl : null,
      redirectChain: observedUrls.slice(0, 8),
      finalMyfansUrl: resolved ? finalUrl : null,
      myfansPostUuid: finalUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null,
      resolvedUrl: resolved ? finalUrl : null,
      resolved,
      resolverMethod: resolved ? "safe_redirect_product_url" : "safe_redirect_failed",
      confidence: resolved ? "exact" : "unresolved",
      failureReason: resolved ? null : "MYFANS_POST_URL_NOT_REACHED",
      startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedMs,
      returnedToStatusUrl: ready.currentUrl,
      statusId: statusUrl.match(/\/status\/(\d+)/)?.[1] || null,
      authorMatch: String(ready.parentAuthor || "").toLowerCase() === String(expectedHandle || "").toLowerCase()
    }
  };
}

function canonicalMyfansPostUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const match = parsed.pathname.match(/^\/posts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i);
    return host === "myfans.jp" && match ? `https://myfans.jp/posts/${match[1].toLowerCase()}` : "";
  } catch {
    return "";
  }
}

async function resolveCandidateMyfansLinks(tabId, candidate, statusUrl, expectedHandle) {
  const observedLinks = Array.isArray(candidate?.myfansUrls) ? [...new Set(candidate.myfansUrls.filter(Boolean))] : [];
  const resolvedLinks = [];
  const evidence = [];
  for (const observedUrl of observedLinks) {
    const directFinalUrl = canonicalMyfansPostUrl(observedUrl);
    if (directFinalUrl) {
      resolvedLinks.push(directFinalUrl);
      evidence.push({
        sourceUrl: observedUrl,
        observedMfcoUrl: null,
        redirectChain: [observedUrl],
        finalMyfansUrl: directFinalUrl,
        myfansPostUuid: directFinalUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null,
        resolvedUrl: directFinalUrl,
        resolved: true,
        resolverMethod: "direct_myfans_url",
        confidence: "exact",
        linkSource: candidate?.myfansLinkSource || "parent",
      });
      continue;
    }
    if (!/^https:\/\/(?:www\.)?(?:mfco\.link|t\.co)\//i.test(observedUrl)) continue;
    const resolved = await resolveWorkerTabLink(tabId, observedUrl, statusUrl, expectedHandle);
    evidence.push({ ...resolved.evidence, linkSource: candidate?.myfansLinkSource || "parent" });
    if (resolved.resolvedUrl) resolvedLinks.push(resolved.resolvedUrl);
  }
  return {
    ...candidate,
    myfansUrls: [...new Set(resolvedLinks)],
    resolvedProductEvidence: evidence.length > 0 ? evidence : null,
    linkResolutionStatus: observedLinks.length === 0 ? "no_link" : resolvedLinks.length > 0 ? "resolved" : "failed",
    linkResolutionDiagnostics: evidence,
  };
}

async function waitForTabComplete(tabId, timeoutMs) {
  const startedAt = Date.now();
  let sawCommittedUrl = false;
  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !/^about:/.test(tab.url)) sawCommittedUrl = true;
    if (tab.status === "complete") return;
    await wait(500);
  }
  throw categorizedError(
    sawCommittedUrl ? FAILURE_CATEGORY.PAGE_LOAD_TIMEOUT : FAILURE_CATEGORY.NAVIGATION_TIMEOUT,
    "Xプロフィールの読み込み完了を待ちましたが完了しませんでした。"
  );
}

function collectXQuoteCandidates() {
  const fail = (stage, category, message, diagnostics = {}) => {
    return {
      ok: false,
      stage,
      quoteCandidates: [],
      errorCode: category,
      errorMessage: message,
      diagnostics
    };
  };
  const extractSourceTextInPage = (tweetText, articleText) => {
    const direct = String(tweetText || "").replace(/\s+/g, " ").trim();
    if (direct) return direct.slice(0, 180);
    return String(articleText || "").split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= 3)
      .filter((line) => !/^(返信先:|Replying to|リポストしました|reposted|いいね|返信|リポスト|ブックマーク|共有|表示|Views?|Likes?|Reposts?|Replies?)(?:\s|$)/i.test(line))
      .filter((line) => !/^[\d\s.,、。!?！？%％¥￥円+\-/:]+$/u.test(line))
      .filter((line) => !/^https?:\/\//i.test(line))
      .join(" ").slice(0, 180);
  };
  const serializePlainJson = (value, path = "result", seen = new WeakSet()) => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:non_finite_number`);
      return value;
    }
    if (value === undefined) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:undefined`);
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:${typeof value}`);
    if (typeof value !== "object") throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:unsupported_type`);
    if (seen.has(value)) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:circular`);
    seen.add(value);
    if (Array.isArray(value)) {
      const output = value.map((item, index) => serializePlainJson(item, `${path}[${index}]`, seen));
      seen.delete(value);
      return output;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:non_plain_object`);
    const output = {};
    for (const key of Object.keys(value)) output[key] = serializePlainJson(value[key], `${path}.${key}`, seen);
    seen.delete(value);
    return output;
  };
  const finalize = (payload) => {
    try {
      const json = JSON.stringify(serializePlainJson(payload));
      if (json === undefined) throw new Error("RESULT_SERIALIZATION_FAILED:result:undefined_json");
      return JSON.parse(json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail("SERIALIZE", "RESULT_SERIALIZATION_FAILED", message, { serializationMessage: message });
    }
  };
  const parseCount = (label) => {
    if (!label) return null;
    const match = String(label).replace(/,/g, "").match(/([\d.]+)\s*([KMB万億]?)/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    const suffix = match[2];
    const multiplier = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : suffix === "B" ? 1000000000 : suffix === "万" ? 10000 : suffix === "億" ? 100000000 : 1;
    return Math.round(value * multiplier);
  };
  const canonicalStatus = (value) => {
    const raw = String(value || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    const match = raw.match(/^(?:https:\/\/x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
    return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
  };
  const mediaInfoFor = (article, statusUrl) => {
    const anchors = Array.from(article.querySelectorAll("a[href]")).map((link) => link.getAttribute("href") || "");
    const mediaHrefs = anchors
      .map((href) => href.match(/^([^?#]+)(?:[?#].*)?$/)?.[1] || "")
      .filter((href) => new RegExp(`^/${sourceXHandle}/status/\\d+/(photo|video)/[1-9]\\d*$`).test(href));
    const unique = Array.from(new Set(mediaHrefs));
    const videoHref = unique.find((href) => /\/video\/[1-9]\d*$/.test(href)) || "";
    const photoHref = unique.find((href) => /\/photo\/[1-9]\d*$/.test(href)) || "";
    const hasVideo = Boolean(article.querySelector('[data-testid="videoPlayer"], video')) || Boolean(videoHref);
    const hasImage = Boolean(article.querySelector('[data-testid="tweetPhoto"] img')) || Boolean(photoHref);
    const chosen = videoHref || photoHref;
    const mediaType = videoHref ? "video" : photoHref ? "image" : hasVideo ? "video" : hasImage ? "image" : "none";
    const mediaCount = unique.length || (hasVideo || hasImage ? 1 : 0);
    const mediaPermalink = chosen ? `https://x.com${chosen}` : "";
    const generatedVideoPermalink = hasVideo && statusUrl ? `${statusUrl}/video/1` : "";
    return {
      mediaPermalink,
      verifiedVideoPermalink: videoHref ? mediaPermalink : "",
      generatedVideoPermalink,
      validationStatus: mediaPermalink ? "dom_media_permalink" : hasVideo ? "needs_video_permalink_validation" : "not_media",
      mediaType,
      mediaCount,
      hasImage,
      hasVideo,
      quoteVisualReady: Boolean(statusUrl && mediaPermalink)
    };
  };
  const profileMatch = location.href.replace(/^https:\/\/twitter\.com\//, "https://x.com/").match(/^https:\/\/x\.com\/([^/?#]+)/);
  const sourceXHandle = profileMatch?.[1] || "";
  const creatorId = new URL(location.href).searchParams.get("myfans_creator_id") || "";
  const refreshJobId = new URL(location.href).searchParams.get("myfans_refresh_job_id") || "";
  const refreshJobItemId = new URL(location.href).searchParams.get("myfans_refresh_item_id") || "";
  const pageText = document.body?.innerText || "";
  const articleCount = document.querySelectorAll('article[data-testid="tweet"]').length;
  const hasRetry = Boolean(document.querySelector('[data-testid="retry"]')) || /問題が発生しました|Something went wrong|Try again|Retry/i.test(pageText);
  const hasSensitiveGate = /センシティブな内容|センシティブなコンテンツ|sensitive content|age-restricted|adult content/i.test(pageText);
  const hasChallenge = /captcha|challenge|認証|ロボット|不審なログイン|ログインしてください|Sign in to X|Log in to X/i.test(pageText);
  const notFound = /このアカウントは存在しません|Account suspended|アカウントは凍結|This account doesn.?t exist|Profile not found|存在しません/i.test(pageText);
  const isPrivate = /このアカウントは非公開です|ポストは非公開|These posts are protected|This account is private|非公開アカウント/i.test(pageText);
  const noPostsConfirmed = /まだポストがありません|No posts yet|このアカウントにはポストがありません/i.test(pageText);
  const baseDiagnostics = {
    url: location.href,
    readyState: document.readyState,
    articleCount,
    hasRetry,
    hasSensitiveGate,
    hasChallenge,
    notFound,
    isPrivate,
    noPostsConfirmed,
    textSample: pageText.replace(/\s+/g, " ").slice(0, 180)
  };
  if (!sourceXHandle || !creatorId) return fail("NAVIGATION", "UNKNOWN", "Daily Pageの一括更新から開いてください。", baseDiagnostics);
  if (hasChallenge) return fail("DOM_WAIT", "LOGIN_OR_CHALLENGE", "Xのログイン/認証画面を検知しました。", baseDiagnostics);
  if (notFound) return fail("DOM_WAIT", "PROFILE_NOT_FOUND/SUSPENDED", "プロフィールが存在しない、または凍結/停止されています。", baseDiagnostics);
  if (hasRetry) return fail("DOM_WAIT", "X_TEMPORARY_ERROR", "Xの一時エラー/Retry表示を検知しました。", baseDiagnostics);
  if (hasSensitiveGate && articleCount === 0) return fail("DOM_WAIT", "SENSITIVE_CONTENT_GATE", "センシティブ警告で投稿一覧が表示されていません。", baseDiagnostics);
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 20);
  if (articles.length === 0) return fail("DOM_WAIT", "NO_TWEET_ARTICLES", "tweet articleが表示されませんでした。", baseDiagnostics);
  const quoteCandidates = articles.map((article) => {
    const statusUrl = Array.from(article.querySelectorAll("a[href]"))
      .map((link) => canonicalStatus(link.getAttribute("href") || ""))
      .find((href) => href && new RegExp(`^https://x\\.com/${sourceXHandle}/status/\\d+$`, "i").test(href)) || "";
    const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
    const rawText = article.innerText || "";
    const analytics = Array.from(article.querySelectorAll("a[href]")).find((link) => /\/analytics$/.test(link.getAttribute("href") || ""));
    const myfansUrls = [];
    for (const link of Array.from(article.querySelectorAll("a[href]"))) {
      const href = link.href || link.getAttribute("href") || "";
      const visible = [href, link.getAttribute("aria-label") || "", link.textContent || ""].join(" ");
      const direct = visible.match(/https?:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\/[^\s"'<>）)]+/gi) || [];
      myfansUrls.push(...direct.map((url) => url.replace(/[?#].*$/, "").replace(/[.,。、]+$/, "")));
      if (/\bmfco\.link\b/i.test(visible) && !direct.some((url) => /mfco\.link/i.test(url)) && /^https:\/\/t\.co\//i.test(href)) myfansUrls.push(href.replace(/[?#].*$/, ""));
    }
    const metric = (testId) => parseCount(article.querySelector(`[data-testid="${testId}"]`)?.getAttribute("aria-label") || "");
    const media = mediaInfoFor(article, statusUrl);
    return {
      xPostUrl: statusUrl,
      mediaPermalink: media.mediaPermalink,
      verifiedVideoPermalink: media.verifiedVideoPermalink,
      generatedVideoPermalink: media.generatedVideoPermalink,
      validationStatus: media.validationStatus,
      mediaType: media.mediaType,
      mediaCount: media.mediaCount,
      quoteVisualReady: media.quoteVisualReady,
      sourceXHandle,
      postedAt: article.querySelector("time")?.getAttribute("datetime") || null,
      text: extractSourceTextInPage(article.querySelector('[data-testid="tweetText"]')?.textContent || "", rawText),
      myfansUrls,
      views: parseCount(analytics?.getAttribute("aria-label") || analytics?.textContent || ""),
      likes: metric("like"),
      reposts: metric("retweet"),
      replies: metric("reply"),
      bookmarks: metric("bookmark"),
      hasImage: media.hasImage,
      hasVideo: media.hasVideo,
      isPinned: /固定|Pinned/i.test(socialContext || rawText.split("\n").slice(0, 3).join(" ")),
      isReply: /返信先:|Replying to/i.test(rawText),
      isRepost: /リポストしました|reposted/i.test(socialContext),
      isQuote: Boolean(article.querySelector('div[role="link"] article'))
    };
  }).filter((candidate, index, all) => candidate.xPostUrl && all.findIndex((item) => item.xPostUrl === candidate.xPostUrl) === index);
  if (quoteCandidates.length === 0) {
    const onlyRepostsOrReplies = articles.every((article) => {
      const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
      const rawText = article.innerText || "";
      return /リポストしました|reposted|返信先:|Replying to/i.test(`${socialContext}\n${rawText}`);
    });
    return fail(
      "OWN_POST_FILTER",
      onlyRepostsOrReplies ? "ONLY_REPOSTS_OR_REPLIES" : "OWN_POST_FILTER_ZERO",
      onlyRepostsOrReplies ? "表示範囲がリポスト/返信のみでした。" : "tweet articleはありますが、creator本人のstatus URLを抽出できませんでした。",
      { ...baseDiagnostics, articleCount: articles.length, ownPostCount: 0 }
    );
  }
  return finalize({
    ok: true,
    stage: "FINALIZE",
    errorCode: null,
    errorMessage: null,
    diagnostics: {
      ...baseDiagnostics,
      articleCount: articles.length,
      ownPostCount: quoteCandidates.length,
      candidateCount: quoteCandidates.length,
      videoCandidates: quoteCandidates.filter((candidate) => candidate.hasVideo || candidate.mediaType === "video").length
    },
    type: "x_quote_scan",
    pageUrl: location.href,
    creatorId,
    creatorXUrl: `https://x.com/${sourceXHandle}`,
    sourceXHandle,
    refreshJobId,
    refreshJobItemId,
    quoteCandidates
  });
}

function inspectXPageState(expectedHandle) {
  const text = document.body?.innerText || "";
  const profileMatch = location.href.replace(/^https:\/\/twitter\.com\//, "https://x.com/").match(/^https:\/\/x\.com\/([^/?#]+)/);
  const currentHandle = profileMatch?.[1] || "";
  return {
    url: location.href,
    readyState: document.readyState,
    currentHandle,
    expectedHandle,
    articleCount: document.querySelectorAll('article[data-testid="tweet"]').length,
    hasTweetTextSelector: Boolean(document.querySelector('[data-testid="tweetText"]')),
    hasRetry: Boolean(document.querySelector('[data-testid="retry"]')) || /問題が発生しました|Something went wrong|Try again|Retry/i.test(text),
    hasSensitiveGate: /センシティブな内容|センシティブなコンテンツ|sensitive content|age-restricted|adult content/i.test(text),
    hasChallenge: /captcha|challenge|認証|ロボット|不審なログイン|ログインしてください|Sign in to X|Log in to X/i.test(text),
    notFound: /このアカウントは存在しません|Account suspended|アカウントは凍結|This account doesn.?t exist|Profile not found|存在しません/i.test(text),
    textSample: text.replace(/\s+/g, " ").slice(0, 180)
  };
}

function inspectXStatusReady(expected, expectedHandle) {
  const canonicalStatus = (value) => {
    const raw = String(value || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    const match = raw.match(/^(?:https:\/\/x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
    return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
  };
  const text = document.body?.innerText || "";
  const targetUrl = `https://x.com/${expected.handle}/status/${expected.statusId}`;
  const currentUrl = canonicalStatus(location.href);
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const statusAnchors = Array.from(document.querySelectorAll("a[href]"))
    .map((link) => canonicalStatus(link.getAttribute("href")))
    .filter(Boolean);
  const handleOf = (article) => Array.from(article.querySelectorAll('[data-testid="User-Name"] a[href]'))
    .map((link) => String(link.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0])
    .find((handle) => /^[A-Za-z0-9_]{1,15}$/.test(handle)) || "";
  const isDirectAnchor = (link, article) => {
    let node = link.parentElement;
    while (node && node !== article) {
      if (node.matches?.('article[data-testid="tweet"]')) return false;
      node = node.parentElement;
    }
    return true;
  };
  const exactParentArticles = articles.filter((article) => {
    const directTargetAnchors = Array.from(article.querySelectorAll("a[href]")).filter((link) => isDirectAnchor(link, article) && canonicalStatus(link.getAttribute("href")) === targetUrl);
    const timeTarget = Array.from(article.querySelectorAll("time")).some((time) => canonicalStatus(time.closest("a")?.getAttribute("href")) === targetUrl);
    return directTargetAnchors.length > 0 && (timeTarget || directTargetAnchors.length > 0) && handleOf(article).toLowerCase() === String(expectedHandle || "").toLowerCase();
  });
  const parentArticle = exactParentArticles.length === 1 ? exactParentArticles[0] : null;
  const parentAuthor = parentArticle ? handleOf(parentArticle) : "";
  const authorCandidates = [...new Set(articles.map(handleOf).filter(Boolean))].slice(0, 20);
  const hasChallenge = /captcha|challenge|認証|ロボット|不審なログイン|ログインしてください|Sign in to X|Log in to X/i.test(text);
  const isPrivate = /このアカウントは非公開です|ポストは非公開|These posts are protected|This account is private|非公開アカウント/i.test(text);
  const hasRetry = Boolean(document.querySelector('[data-testid="retry"]')) || /問題が発生しました|Something went wrong|Try again|Retry/i.test(text);
  return {
    ready: currentUrl === targetUrl && Boolean(parentArticle) && parentAuthor.toLowerCase() === String(expectedHandle || "").toLowerCase(),
    currentUrl,
    targetUrl,
    articleCount: articles.length,
    statusAnchorCount: statusAnchors.filter((url) => url === targetUrl).length,
    observedStatusIds: [...new Set(statusAnchors.map((url) => url.match(/\/status\/(\d+)/)?.[1]).filter(Boolean))].slice(0, 20),
    authorCandidates,
    parentCandidateCount: exactParentArticles.length,
    ambiguousParent: exactParentArticles.length > 1,
    parentFound: Boolean(parentArticle),
    parentAuthor,
    hasChallenge,
    isPrivate,
    hasRetry,
    readyState: document.readyState,
    textSample: text.replace(/\s+/g, " ").slice(0, 180)
  };
}

async function collectXStatusThreadReplies({ sourceXHandle, sourceStatusUrl, readyEvidence = null }) {
  const extractSourceTextInPage = (tweetText, articleText) => {
    const direct = String(tweetText || "").replace(/\s+/g, " ").trim();
    if (direct) return direct.slice(0, 180);
    return String(articleText || "").split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= 3)
      .filter((line) => !/^(返信先:|Replying to|リポストしました|reposted|いいね|返信|リポスト|ブックマーク|共有|表示|Views?|Likes?|Reposts?|Replies?)(?:\s|$)/i.test(line))
      .filter((line) => !/^[\d\s.,、。!?！？%％¥￥円+\-/:]+$/u.test(line))
      .filter((line) => !/^https?:\/\//i.test(line))
      .join(" ").slice(0, 180);
  };
  const serializePlainJson = (value, path = "result", seen = new WeakSet()) => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:non_finite_number`);
      return value;
    }
    if (value === undefined) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:undefined`);
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:${typeof value}`);
    if (typeof value !== "object") throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:unsupported_type`);
    if (seen.has(value)) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:circular`);
    seen.add(value);
    if (Array.isArray(value)) {
      const output = value.map((item, index) => serializePlainJson(item, `${path}[${index}]`, seen));
      seen.delete(value);
      return output;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error(`RESULT_SERIALIZATION_FAILED:${path}:non_plain_object`);
    const output = {};
    for (const key of Object.keys(value)) output[key] = serializePlainJson(value[key], `${path}.${key}`, seen);
    seen.delete(value);
    return output;
  };
  const pageText = document.body?.innerText || "";
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 40);
  const targetStatusId = String(sourceStatusUrl || "").match(/\/status\/(\d+)/)?.[1] || "";
  const targetUrl = `https://x.com/${sourceXHandle}/status/${targetStatusId}`;
  const parseCount = (label) => {
    if (!label) return null;
    const match = String(label).replace(/,/g, "").match(/([\d.]+)\s*([KMB万億]?)/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    const suffix = match[2];
    const multiplier = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : suffix === "B" ? 1000000000 : suffix === "万" ? 10000 : suffix === "億" ? 100000000 : 1;
    return Math.round(value * multiplier);
  };
  const cleanHandle = (href) => String(href || "").replace(/^\//, "").split(/[/?#]/)[0];
  const normalizeHandle = (value) => cleanHandle(value).replace(/^@/, "").toLowerCase();
  const canonicalStatus = (value) => {
    const raw = String(value || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    const match = raw.match(/^(?:https:\/\/x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
    return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
  };
  const articleHandle = (article) => Array.from(article.querySelectorAll('[data-testid="User-Name"] a[href]'))
    .map((link) => link.getAttribute("href") || "")
    .map(cleanHandle)
    .find((handle) => /^[A-Za-z0-9_]{1,15}$/.test(handle) && !["home", "explore", "search", "notifications", "messages", "i", "settings"].includes(handle.toLowerCase())) || "";
  const isDirectAnchor = (link, article) => {
    let node = link.parentElement;
    while (node && node !== article) {
      if (node.matches?.('article[data-testid="tweet"]')) return false;
      node = node.parentElement;
    }
    return true;
  };
  const exactParentArticles = articles.filter((article) => {
    const directTarget = Array.from(article.querySelectorAll("a[href]")).some((link) => isDirectAnchor(link, article) && canonicalStatus(link.getAttribute("href")).toLowerCase() === `https://x.com/${sourceXHandle}/status/${targetStatusId}`.toLowerCase());
    return directTarget && articleHandle(article).toLowerCase() === normalizeHandle(sourceXHandle);
  });
  const sameAuthorArticles = articles.filter((article) => articleHandle(article).toLowerCase() === normalizeHandle(sourceXHandle));
  const currentUrl = canonicalStatus(location.href);
  const readyFallback = exactParentArticles.length === 0
    && Boolean(readyEvidence?.ready)
    && currentUrl === targetUrl
    && canonicalStatus(readyEvidence.currentUrl) === targetUrl
    && normalizeHandle(readyEvidence.parentAuthor) === normalizeHandle(sourceXHandle)
    && Number(readyEvidence.parentCandidateCount) === 1
    && sameAuthorArticles.length === 1;
  const parentArticles = exactParentArticles.length === 1
    ? exactParentArticles
    : readyFallback ? sameAuthorArticles : [];
  const extractMyfansUrls = (article) => {
    const urls = [];
    const rejectionReasons = {};
    const addRejection = (reason) => { rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1; };
    const isNestedTweetAnchor = (link) => {
      let node = link.parentElement;
      while (node && node !== article) {
        if (node.matches?.('article[data-testid="tweet"]')) return true;
        node = node.parentElement;
      }
      return false;
    };
    const isCardAnchor = (link) => {
      let node = link;
      while (node && node !== article) {
        const marker = [node.getAttribute?.("data-testid") || "", node.getAttribute?.("aria-label") || "", node.getAttribute?.("role") || "", node.className || ""].join(" ");
        if (/card|preview|summary|website|unified.?card|tweetbox/i.test(marker)) return true;
        node = node.parentElement;
      }
      return false;
    };
    const hrefClass = (href) => {
      try {
        const parsed = new URL(href, location.href);
        return parsed.hostname.toLowerCase() === "t.co" ? "t.co" : parsed.hostname.toLowerCase() || "relative";
      } catch {
        return "invalid";
      }
    };
    const anchors = Array.from(article.querySelectorAll("a[href]"));
    let anchorCount = 0;
    let cardAnchorCount = 0;
    let tcoCount = 0;
    let directAcceptedCount = 0;
    for (const link of anchors) {
      if (isNestedTweetAnchor(link)) {
        addRejection("nested_tweet_or_quote");
        continue;
      }
      anchorCount += 1;
      const href = String(link.getAttribute("href") || link.href || "");
      const cardAnchor = isCardAnchor(link);
      if (cardAnchor) cardAnchorCount += 1;
      const visible = [href, link.getAttribute("aria-label") || "", link.textContent || ""].join(" ");
      const direct = visible.match(/https?:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\/[^\s"'<>）)]+/gi) || [];
      const directUrls = direct.map((url) => url.replace(/[?#].*$/, "").replace(/[.,。、]+$/, ""));
      if (directUrls.length > 0) {
        directAcceptedCount += directUrls.length;
        urls.push(...directUrls);
        continue;
      }
      let parsed;
      try { parsed = new URL(href, location.href); } catch { addRejection("invalid_href"); continue; }
      if (parsed.hostname.toLowerCase() === "t.co") {
        tcoCount += 1;
        urls.push(`${parsed.origin}${parsed.pathname}`);
        continue;
      }
      if (/\bmfco\.link\b|\bmyfans\.jp\b/i.test(visible)) addRejection("displayed_domain_without_usable_href");
      else if (cardAnchor) addRejection("non_target_card_host");
    }
    return {
      urls: Array.from(new Set(urls)),
      diagnostics: {
        anchorCount,
        rawHrefClasses: Array.from(new Set(anchors.filter((link) => !isNestedTweetAnchor(link)).map((link) => hrefClass(String(link.getAttribute("href") || link.href || ""))))),
        cardAnchorCount,
        tcoCount,
        resolvedLinkCount: directAcceptedCount,
        acceptedMyfansLinkCount: directAcceptedCount,
        rejectionReasons
      }
    };
  };
  const mediaInfo = (article, statusUrl) => {
    const hrefs = Array.from(article.querySelectorAll("a[href]"))
      .map((link) => (link.getAttribute("href") || "").split(/[?#]/)[0])
      .filter((href) => /^\/[^/]+\/status\/\d+\/(photo|video)\/[1-9]\d*$/.test(href));
    const videoHref = hrefs.find((href) => /\/video\//.test(href)) || "";
    const photoHref = hrefs.find((href) => /\/photo\//.test(href)) || "";
    const hasVideo = Boolean(article.querySelector('[data-testid="videoPlayer"], video')) || Boolean(videoHref);
    const hasImage = Boolean(article.querySelector('[data-testid="tweetPhoto"] img')) || Boolean(photoHref);
    return {
      mediaPermalink: videoHref || photoHref ? `https://x.com${videoHref || photoHref}` : "",
      verifiedVideoPermalink: videoHref ? `https://x.com${videoHref}` : "",
      generatedVideoPermalink: hasVideo && statusUrl ? `${statusUrl}/video/1` : "",
      validationStatus: videoHref || photoHref ? "dom_media_permalink" : hasVideo ? "needs_video_permalink_validation" : "not_media",
      mediaType: videoHref ? "video" : photoHref ? "image" : hasVideo ? "video" : hasImage ? "image" : "none",
      mediaCount: new Set(hrefs).size || (hasVideo || hasImage ? 1 : 0),
      hasImage,
      hasVideo,
      quoteVisualReady: Boolean(statusUrl && (videoHref || photoHref))
    };
  };
  const candidates = articles.map((article) => {
    const links = Array.from(article.querySelectorAll("a[href]"));
    const hrefs = links.map((link) => link.getAttribute("href") || "");
    const directTargetStatus = links
      .filter((link) => isDirectAnchor(link, article))
      .map((link) => canonicalStatus(link.getAttribute("href")))
      .find((url) => url.toLowerCase() === targetUrl.toLowerCase()) || "";
    const authorHandle = articleHandle(article);
    // X's Japanese thread UI does not expose the reply-to marker in article text.
    // On a status thread, a distinct status URL is the stable boundary between
    // the opening post and a reply; author ownership remains an exact handle match.
    const isParentCandidate = parentArticles.includes(article);
    const statusUrl = isParentCandidate ? targetUrl : directTargetStatus || hrefs.map(canonicalStatus).find(Boolean) || "";
    const statusId = statusUrl.match(/\/status\/(\d+)/)?.[1] || "";
    const isReply = Boolean(statusUrl && statusId && !isParentCandidate && statusId !== targetStatusId);
    const media = mediaInfo(article, statusUrl);
    const rawText = article.innerText || "";
    const linkEvidence = extractMyfansUrls(article);
    const myfansUrls = linkEvidence.urls;
    const metric = (testId) => parseCount(article.querySelector(`[data-testid="${testId}"]`)?.getAttribute("aria-label") || "");
    return {
      xPostUrl: statusUrl,
      mediaPermalink: media.mediaPermalink,
      verifiedVideoPermalink: media.verifiedVideoPermalink,
      generatedVideoPermalink: media.generatedVideoPermalink,
      validationStatus: media.validationStatus,
      mediaType: media.mediaType,
      mediaCount: media.mediaCount,
      quoteVisualReady: media.quoteVisualReady,
      sourceXHandle,
      authorHandle,
      authorStatusUrl: statusUrl,
      isParentCandidate,
      postedAt: article.querySelector("time")?.getAttribute("datetime") || null,
      text: extractSourceTextInPage(article.querySelector('[data-testid="tweetText"]')?.textContent || "", rawText),
      myfansUrls,
      linkDiagnostics: linkEvidence.diagnostics,
      views: null,
      likes: metric("like"),
      reposts: metric("retweet"),
      replies: metric("reply"),
      bookmarks: metric("bookmark"),
      hasImage: media.hasImage,
      hasVideo: media.hasVideo,
      isPinned: false,
      isReply,
      isRepost: false,
      isQuote: Boolean(article.querySelector('div[role="link"] article'))
    };
  }).filter((candidate, index, all) => candidate.xPostUrl && all.findIndex((item) => item.xPostUrl === candidate.xPostUrl) === index);
  const sourceArticle = parentArticles.length === 1 ? parentArticles[0] : null;
  const sourceAuthorHandle = sourceArticle ? articleHandle(sourceArticle) : "";
  const parentCandidate = candidates.find((candidate) => candidate.isParentCandidate) || null;
  const ownReplies = candidates.filter((candidate) => candidate.isReply && normalizeHandle(candidate.authorHandle) === normalizeHandle(sourceXHandle));
  const foreignReplies = candidates.filter((candidate) => candidate.isReply && normalizeHandle(candidate.authorHandle) !== normalizeHandle(sourceXHandle));
  const payload = {
    ok: Boolean(parentCandidate),
    sourceStatusUrl,
    sourceAuthorHandle,
    errorCode: parentCandidate ? null : "STATUS_PARENT_NOT_FOUND",
    errorMessage: parentCandidate ? null : "対象status ID・authorに一致する親articleが表示されませんでした。",
    articleCount: articles.length,
    authorReplyCount: ownReplies.length,
    myfansLinkCount: [parentCandidate, ...ownReplies].filter(Boolean).reduce((total, candidate) => total + candidate.myfansUrls.length, 0),
    foreignReplyCount: foreignReplies.length,
    parentCandidate,
    ownReplies,
    threadObservationStatus: "VISIBLE_THREAD_OBSERVED",
    pageTextSample: pageText.replace(/\s+/g, " ").slice(0, 160),
    quoteCandidates: ownReplies,
    diagnostics: {
      ownReplyLinkDiagnostics: ownReplies.map((reply) => ({
        statusUrl: reply.xPostUrl,
        authorHandle: reply.authorHandle,
        ...reply.linkDiagnostics
      })),
      parentCandidateCount: parentArticles.length,
      parentDetection: exactParentArticles.length === 1 ? "target_status_id_exact" : readyFallback ? "ready_verified_target_identity_fallback" : "not_found",
      readyFallbackUsed: readyFallback,
      targetStatusId,
      authorCandidates: [...new Set(articles.map(articleHandle).filter(Boolean))].slice(0, 20)
    }
  };
  try {
    const json = JSON.stringify(serializePlainJson(payload));
    if (json === undefined) throw new Error("RESULT_SERIALIZATION_FAILED:result:undefined_json");
    return JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, sourceStatusUrl, sourceAuthorHandle: "", articleCount: articles.length, authorReplyCount: 0, myfansLinkCount: 0, pageTextSample: pageText.replace(/\s+/g, " ").slice(0, 160), quoteCandidates: [], errorCode: "RESULT_SERIALIZATION_FAILED", errorMessage: message, diagnostics: { serializationMessage: message } };
  }
}

async function executeMain(tabId, func, args = [], options = {}) {
  let injection = null;
  const executionDiagnostics = {
    functionName: func?.name || "anonymous",
    target: { tabId, world: "MAIN", allFrames: false },
    requireResult: Boolean(options.requireResult)
  };
  try {
    injection = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func,
      args
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xページでスクリプトを実行できませんでした。";
    throw categorizedError(FAILURE_CATEGORY.INJECTED_FUNCTION_ERROR, message, { ...executionDiagnostics, executionError: message });
  }
  if (!Array.isArray(injection) || injection.length === 0) throw categorizedError(FAILURE_CATEGORY.RESULT_EMPTY, "executeScriptのresultsが空でした。", executionDiagnostics);
  const frameDiagnostics = injection.map((entry) => ({
    frameId: entry?.frameId ?? null,
    hasResult: Boolean(entry && Object.prototype.hasOwnProperty.call(entry, "result")),
    resultType: entry && Object.prototype.hasOwnProperty.call(entry, "result") ? (entry.result === null ? "null" : typeof entry.result) : "missing"
  }));
  executionDiagnostics.frames = frameDiagnostics;
  const withResult = injection.filter((entry) => entry && Object.prototype.hasOwnProperty.call(entry, "result"));
  const first = withResult.find((entry) => entry.frameId === 0) || withResult[0];
  if (!first) throw categorizedError(FAILURE_CATEGORY.RESULT_FRAME_MISSING, `executeScriptのresultフィールドがありませんでした。frames=${injection.length}`, executionDiagnostics);
  if (first.result === undefined && options.requireResult) throw categorizedError(FAILURE_CATEGORY.RESULT_UNDEFINED, "executeScriptのresultがundefinedでした。注入関数は必ずplain objectを返してください。", executionDiagnostics);
  if (options.requireResult) {
    try {
      const json = JSON.stringify(first.result);
      if (json === undefined) throw new Error("JSON.stringify returned undefined");
      return JSON.parse(json);
    } catch (error) {
      throw categorizedError(FAILURE_CATEGORY.RESULT_SERIALIZATION_FAILED, `executeScriptのresultをJSON化できませんでした: ${error instanceof Error ? error.message : String(error)}`, executionDiagnostics);
    }
  }
  return first.result;
}

async function waitForTweetRender(tabId, expectedHandle, timeoutMs) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await executeMain(tabId, inspectXPageState, [expectedHandle]);
    if (lastState.hasChallenge) throw categorizedError(FAILURE_CATEGORY.LOGIN_OR_CHALLENGE, "Xのログイン/認証画面を検知しました。");
    if (lastState.notFound) throw categorizedError(FAILURE_CATEGORY.PROFILE_NOT_FOUND_SUSPENDED, "プロフィールが存在しない、または凍結/停止されています。");
    if (lastState.isPrivate) throw categorizedError(FAILURE_CATEGORY.PRIVATE, "鍵付き/privateアカウントのため投稿を閲覧できません。");
    if (lastState.noPostsConfirmed) throw categorizedError(FAILURE_CATEGORY.NO_POSTS, "投稿がないことを確認しました。");
    if (lastState.hasRetry) throw categorizedError(FAILURE_CATEGORY.X_TEMPORARY_ERROR, "Xの一時エラー/Retry表示を検知しました。");
    if (lastState.hasSensitiveGate && lastState.articleCount === 0) throw categorizedError(FAILURE_CATEGORY.SENSITIVE_CONTENT_GATE, "センシティブ警告で投稿一覧が表示されていません。");
    if (lastState.articleCount > 0) return lastState;
    await wait(750);
  }
  throw categorizedError(FAILURE_CATEGORY.NO_TWEET_ARTICLES, `tweet articleが表示されませんでした。state=${lastState?.readyState || "unknown"} sample=${lastState?.textSample || ""}`);
}

function inspectXVideoPermalink(expected) {
  const canonical = location.href.replace(/^https:\/\/twitter\.com\//, "https://x.com/").match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)\/video\/([1-9]\d*)/);
  const hasVideo = Boolean(document.querySelector('[data-testid="videoPlayer"], video'));
  const hasTweet = Boolean(document.querySelector('article[data-testid="tweet"]'));
  const text = document.body?.innerText || "";
  const blocked = /This post is unavailable|ポストを表示できません|存在しません|削除|404|問題が発生しました/i.test(text);
  return {
    ok: Boolean(canonical && canonical[1].toLowerCase() === String(expected.handle || "").toLowerCase() && canonical[2] === String(expected.statusId || "") && hasVideo && hasTweet && !blocked),
    finalUrl: location.href,
    hasVideo,
    hasTweet,
    blocked
  };
}

function inspectVisibleVisual(candidate) {
  const text = document.body?.innerText || "";
  const images = Array.from(document.querySelectorAll('article[data-testid="tweet"] img[src*="pbs.twimg.com"], img[src*="pbs.twimg.com/media"]'));
  const videos = Array.from(document.querySelectorAll('article[data-testid="tweet"] video, article[data-testid="tweet"] [data-testid="videoPlayer"]'));
  const hasChallenge = /captcha|challenge|認証|ロボット|ログインしてください|Sign in to X|Log in to X/i.test(text);
  const hasSensitiveGate = /センシティブな内容|センシティブなコンテンツ|sensitive content|age-restricted|adult content/i.test(text);
  const unavailable = /This post is unavailable|ポストを表示できません|存在しません|削除|404|問題が発生しました|Something went wrong/i.test(text);
  const mediaType = candidate?.mediaType || "";
  const imageSamples = images.slice(0, 4).map((img) => ({
    srcHost: (() => { try { return new URL(img.currentSrc || img.src).hostname; } catch { return ""; } })(),
    alt: img.alt || "",
    width: img.naturalWidth || img.width || 0,
    height: img.naturalHeight || img.height || 0
  }));
  const videoSamples = videos.slice(0, 3).map((video) => ({
    tag: video.tagName,
    width: video.videoWidth || video.clientWidth || 0,
    height: video.videoHeight || video.clientHeight || 0,
    currentTime: typeof video.currentTime === "number" ? video.currentTime : null,
    readyState: typeof video.readyState === "number" ? video.readyState : null
  }));
  const visibleImageCount = imageSamples.filter((img) => img.width >= 120 && img.height >= 120).length;
  const visibleVideoCount = videoSamples.filter((video) => video.width >= 120 || video.readyState >= 2).length;
  const frameOrImageCount = mediaType === "video" ? visibleVideoCount : visibleImageCount;
  const posterOnly = mediaType === "video" && visibleVideoCount === 0 && visibleImageCount > 0;
  const blocked = hasChallenge || unavailable || (hasSensitiveGate && visibleImageCount === 0 && visibleVideoCount === 0);
  const status = blocked ? "unavailable" : posterOnly ? "partial" : frameOrImageCount > 0 ? "verified" : "partial";
  const visualRenderStatus = blocked ? "blocked" : frameOrImageCount > 0 || posterOnly ? "browser_visible" : "unknown";
  const reason = hasChallenge ? "login/challenge" : unavailable ? "deleted_or_unavailable" : hasSensitiveGate && frameOrImageCount === 0 ? "sensitive_gate" : posterOnly ? "poster_only" : frameOrImageCount > 0 ? "visible_visual" : "dom_mismatch";
  const mediaWord = mediaType === "video" ? "動画" : mediaType === "image" ? "画像" : "visual";
  const sizeCue = [...imageSamples, ...videoSamples].find((item) => item.width || item.height);
  const dimension = sizeCue ? `${sizeCue.width || "?"}x${sizeCue.height || "?"}` : "";
  return {
    status,
    visualRenderStatus,
    reason,
    evidence: {
      inspectedUrl: location.href,
      mediaType,
      frameOrImageCount,
      sceneSummary: status === "verified" ? `ログイン済みChrome上で${mediaWord}が表示された` : reason,
      subjectSummary: text.replace(/\s+/g, " ").slice(0, 80),
      composition: dimension ? `表示領域 ${dimension}` : "",
      standoutMoment: status === "verified" ? `${mediaWord}の実表示を確認` : "",
      attentionWorthyMoment: status === "verified" ? `${mediaWord}がタイムライン内で確認できる` : "",
      colorContrastCue: imageSamples.some((img) => /profile_images|emoji/i.test(img.srcHost)) ? "" : "pbs.twimg.com visual",
      confidence: status === "verified" && frameOrImageCount > 0 ? "medium" : "low",
      firstFrameCue: mediaType === "video" && visibleVideoCount > 0 ? "video element rendered in logged-in Chrome" : "",
      motionChangeCue: mediaType === "video" && visibleVideoCount > 0 ? "video frame available; stream/blob extraction not used" : "",
      beginningVsLater: mediaType === "video" && visibleVideoCount > 0 ? "posterだけでなくvideo player/frameを確認" : "",
      concreteObservation: status === "verified" ? `${mediaWord} ${frameOrImageCount}件をログイン済みChrome DOMで確認` : reason,
      failureReason: reason
    },
    diagnostics: { imageSamples, videoSamples, hasChallenge, hasSensitiveGate, unavailable, textSample: text.replace(/\s+/g, " ").slice(0, 180) }
  };
}

async function runVisualVerification(settings) {
  if (globalThis.myfansVisualVerificationRunning) return;
  globalThis.myfansVisualVerificationRunning = true;
  await setQuoteState({ visualRunning: true, visualStatus: "starting", visualMessage: "visual verificationを開始します。", visualChecked: 0, visualVerified: 0, visualPartial: 0, visualUnavailable: 0 });
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const batch = await visualVerificationRequest(settings, { action: "select_companion_batch", limit: Math.min(5, settings.batchSize || 5) });
    const workerTabId = await ensureWorkerTab(currentTab?.id);
    let checked = 0;
    let verified = 0;
    let partial = 0;
    let unavailable = 0;
    let pausedAfterBatch = false;
    for (const candidate of batch.candidates || []) {
      const targetUrl = candidate.mediaPermalink || candidate.xPostUrl;
      let inspection = targetUrl ? null : {
        status: "unavailable",
        visualRenderStatus: "unknown",
        reason: "missing_media_url",
        evidence: { failureReason: "visual確認対象のmedia URLがありません。", confidence: "low", mediaType: candidate.mediaType || "" }
      };
      if (targetUrl) {
        await setQuoteState({ visualStatus: "running", visualMessage: `visual確認中: ${targetUrl}`, visualChecked: checked, visualVerified: verified, visualPartial: partial, visualUnavailable: unavailable });
        try {
          await chrome.tabs.update(workerTabId, { url: targetUrl, active: false });
          await waitForTabComplete(workerTabId, 45000);
          await wait(3000);
          inspection = await executeMain(workerTabId, inspectVisibleVisual, [candidate]);
        } catch (error) {
        inspection = {
          status: "unavailable",
          visualRenderStatus: "blocked",
          reason: categoryFromError(error) || "dom_mismatch",
          evidence: { failureReason: error instanceof Error ? error.message : String(error || "visual確認に失敗しました"), confidence: "low", inspectedUrl: targetUrl, mediaType: candidate.mediaType || "" }
        };
        }
      }
      const saved = await visualVerificationRequest(settings, {
        action: "save_companion_evidence",
        id: candidate.id,
        queueJobId: batch.job?.id || null,
        queueItemId: candidate.queueItemId || null,
        claimToken: candidate.claimToken || null,
        status: inspection.status,
        visualRenderStatus: inspection.visualRenderStatus,
        reason: inspection.reason,
        evidence: inspection.evidence
      });
      checked += 1;
      if (inspection.status === "verified") verified += 1;
      else if (inspection.status === "partial") partial += 1;
      else unavailable += 1;
      await setQuoteState({ visualStatus: "running", visualMessage: `保存しました: ${inspection.status}`, visualChecked: checked, visualVerified: verified, visualPartial: partial, visualUnavailable: unavailable, visualLastReason: inspection.reason });
      if (saved?.queuePaused || checked >= 5) {
        pausedAfterBatch = true;
        await setQuoteState({ visualRunning: false, visualStatus: "paused", visualMessage: saved?.queuePaused ? "visual queueを安全pauseしました。" : "1バッチ5件を完了したためvisual queueをpauseしました。", visualLastReason: inspection.reason });
        break;
      }
      await wait(2500);
    }
    if (!pausedAfterBatch) {
      await setQuoteState({ visualRunning: false, visualStatus: "done", visualMessage: "visual verificationが完了しました。", visualChecked: checked, visualVerified: verified, visualPartial: partial, visualUnavailable: unavailable });
    }
  } catch (error) {
    await setQuoteState({ visualRunning: false, visualStatus: "error", visualMessage: error instanceof Error ? error.message : "visual verificationを実行できませんでした。", visualLastError: error instanceof Error ? error.message : String(error) });
  } finally {
    globalThis.myfansVisualVerificationRunning = false;
  }
}

function statusParts(statusUrl) {
  const match = String(statusUrl || "").replace(/^https:\/\/twitter\.com\//i, "https://x.com/").match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)(?:\/(?:photo|video)\/\d+)?(?:[?#].*)?$/i);
  return match ? { handle: match[1], statusId: match[2] } : null;
}

function canonicalStatusUrl(value) {
  const parts = statusParts(String(value || ""));
  return parts ? `https://x.com/${parts.handle}/status/${parts.statusId}` : "";
}

async function waitForStatusNavigation(tabId, expectedStatusUrl, timeoutMs = 45000) {
  const targetUrl = canonicalStatusUrl(expectedStatusUrl);
  const target = statusParts(targetUrl);
  const startedAt = Date.now();
  let lastTab = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastTab = await chrome.tabs.get(tabId);
    const observedUrl = canonicalStatusUrl(lastTab.url || "");
    if (observedUrl === targetUrl) {
      return {
        targetUrl,
        observedUrl,
        tabStatus: lastTab.status || null,
        committed: true,
        elapsedMs: Date.now() - startedAt
      };
    }
    await wait(300);
  }
  let domDiagnostics = {};
  if (target) {
    try {
      domDiagnostics = await executeMain(tabId, inspectXStatusReady, [target, target.handle], { requireResult: true });
    } catch (error) {
      domDiagnostics = { domProbeError: error instanceof Error ? error.message : String(error) };
    }
  }
  throw categorizedError(
    lastTab?.url && !/^about:/.test(lastTab.url) ? FAILURE_CATEGORY.PAGE_LOAD_TIMEOUT : FAILURE_CATEGORY.NAVIGATION_TIMEOUT,
    "X status URLのcommitを確認できませんでした。",
    {
      targetUrl,
      observedUrl: lastTab?.url || "",
      observedCanonicalUrl: canonicalStatusUrl(lastTab?.url || ""),
      tabStatus: lastTab?.status || null,
      committed: false,
      elapsedMs: Date.now() - startedAt,
      ...domDiagnostics
    }
  );
}

async function validateVideoPermalinks(tabId, result) {
  const diagnostics = result.diagnostics || {};
  diagnostics.videoValidation = { checked: 0, verified: 0, failed: 0, noResult: 0, timeout: 0 };
  result.diagnostics = diagnostics;
  const candidates = Array.isArray(result.quoteCandidates) ? result.quoteCandidates : [];
  for (const candidate of candidates) {
    if (candidate.mediaType !== "video" || !candidate.hasVideo) continue;
    diagnostics.videoValidation.checked += 1;
    if (candidate.mediaPermalink && candidate.quoteVisualReady) {
      candidate.verifiedVideoPermalink = candidate.mediaPermalink;
      candidate.validationStatus = candidate.validationStatus || "dom_media_permalink";
      diagnostics.videoValidation.verified += 1;
      continue;
    }
    const parts = statusParts(candidate.xPostUrl);
    if (!parts) {
      candidate.validationStatus = "invalid_status_url";
      candidate.quoteVisualReady = false;
      continue;
    }
    const videoUrl = `${candidate.xPostUrl}/video/1`;
    candidate.generatedVideoPermalink = videoUrl;
    try {
      await chrome.tabs.update(tabId, { url: videoUrl, active: false });
      await waitForTabComplete(tabId, 30000);
      await wait(3500);
      const validation = await executeMain(tabId, inspectXVideoPermalink, [parts]);
      if (validation?.ok) {
        candidate.mediaPermalink = videoUrl;
        candidate.verifiedVideoPermalink = videoUrl;
        candidate.quoteVisualReady = true;
        candidate.validationStatus = "verified_video_permalink";
        diagnostics.videoValidation.verified += 1;
      } else {
        candidate.mediaPermalink = "";
        candidate.verifiedVideoPermalink = "";
        candidate.quoteVisualReady = false;
        candidate.validationStatus = validation ? (validation.blocked ? "video_permalink_blocked" : "video_permalink_not_rendered") : "video_permalink_no_result";
        diagnostics.videoValidation.failed += 1;
        if (!validation) diagnostics.videoValidation.noResult += 1;
      }
    } catch (error) {
      candidate.mediaPermalink = "";
      candidate.verifiedVideoPermalink = "";
      candidate.quoteVisualReady = false;
      candidate.validationStatus = categoryFromError(error) === FAILURE_CATEGORY.PAGE_LOAD_TIMEOUT || categoryFromError(error) === FAILURE_CATEGORY.NAVIGATION_TIMEOUT
        ? "video_permalink_validation_timeout"
        : "video_permalink_validation_failed";
      diagnostics.videoValidation.failed += 1;
      if (candidate.validationStatus === "video_permalink_validation_timeout") diagnostics.videoValidation.timeout += 1;
    }
  }
  return result;
}

async function collectFromWorkerTab(tabId, item, jobId, openerTabId = null) {
  const stateTransitions = [];
  const transition = (stage, detail = {}) => stateTransitions.push({ stage, at: new Date().toISOString(), ...detail });
  const timedStage = async (stage, work, detail = {}) => {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    transition(`${stage}_START`, { ...detail, startedAt });
    try {
      const value = await work();
      transition(`${stage}_END`, { ...detail, startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedMs });
      return value;
    } catch (error) {
      transition(`${stage}_ERROR`, {
        ...detail,
        startedAt,
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedMs,
        errorCode: categoryFromError(error),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
  const url = `${item.creator_x_url}?myfans_creator_id=${item.creator_id}&myfans_refresh_job_id=${jobId}&myfans_refresh_item_id=${item.id}`;
  transition("PROFILE_SCAN", { url });
  await assertWorkerTabAlive(tabId);
  await chrome.tabs.update(tabId, { url, active: false });
  await waitForTabComplete(tabId, 45000);
  const expectedHandle = String(item.creator_x_url || "").match(/^https:\/\/x\.com\/([^/?#]+)/)?.[1] || "";
  await waitForTweetRender(tabId, expectedHandle, 18000);
  const tab = await chrome.tabs.get(tabId);
  if (/\/(login|i\/flow\/login)/.test(tab.url || "")) throw categorizedError(FAILURE_CATEGORY.LOGIN_OR_CHALLENGE, "Xログイン画面に移動しました。ログイン状態を確認してください。");
  await executeMain(tabId, async () => {
      window.scrollTo({ top: 900, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      window.scrollTo({ top: 0, behavior: "instant" });
  });
  await waitForTweetRender(tabId, expectedHandle, 8000);
  const rawResult = await executeMain(tabId, collectXQuoteCandidates, [], { requireResult: true });
  let result = ensureStructuredScanResult(rawResult, "EXTRACT");
  if (!result.ok || !Array.isArray(result.quoteCandidates) || result.quoteCandidates.length === 0) {
    throw categorizedError(result.errorCode || FAILURE_CATEGORY.UNKNOWN, result.errorMessage || "Xページから引用候補を取得できませんでした。");
  }
  result = await validateVideoPermalinks(tabId, result);
  const parentCandidates = result.quoteCandidates.filter((candidate) => candidate.xPostUrl && (candidate.mediaType === "image" || candidate.mediaType === "video")).slice(0, 5);
  const authorReplies = [];
  const completeThreadCandidates = [];
  const collectionStatuses = result.quoteCandidates.map((candidate) => ({
    parentStatusUrl: candidate.xPostUrl,
    status: candidate.mediaType === "image" || candidate.mediaType === "video" ? "PENDING_THREAD" : "NO_MEDIA"
  }));
  let statusThreadsObserved = 0;
  let fullyObservedThreads = 0;
  let statusThreadMyfansLinkCount = 0;
  let threadNotFullyObservedCount = 0;
  let observationFailureCount = 0;
  transition("MEDIA_STATUS_QUEUE", { queued: parentCandidates.length, profileArticleCount: result.diagnostics?.articleCount ?? 0, profileOwnPostCount: result.diagnostics?.ownPostCount ?? 0 });
  for (const candidate of parentCandidates) {
    try {
      const statusId = candidate.xPostUrl.match(/\/status\/(\d+)/)?.[1] || null;
      let observation = null;
      let threadResult = null;
      let statusRetryEvidence = [];
      let retriedStatusTab = false;
      while (true) {
        try {
          const statusStartedAt = new Date().toISOString();
          const statusStartedMs = Date.now();
          transition("NAVIGATE_STATUS", { parentStatusUrl: candidate.xPostUrl, statusId, attempt: retriedStatusTab ? 2 : 1 });
          await timedStage("STATUS_NAVIGATION", async () => {
            await assertWorkerTabAlive(tabId);
            await chrome.tabs.update(tabId, { url: candidate.xPostUrl, active: false });
            await waitForStatusNavigation(tabId, candidate.xPostUrl, 45000);
          }, { parentStatusUrl: candidate.xPostUrl, statusId });
          transition("WAIT_STATUS_READY", { parentStatusUrl: candidate.xPostUrl, statusId });
          const ready = await timedStage("STATUS_READY", () => waitForStatusReady(tabId, expectedHandle, candidate.xPostUrl, 18000), { parentStatusUrl: candidate.xPostUrl, statusId });
          transition("STATUS_READY_CONFIRMED", { parentStatusUrl: candidate.xPostUrl, statusId, currentUrl: ready.currentUrl, parentAuthor: ready.parentAuthor, authorMatch: ready.parentAuthor?.toLowerCase() === expectedHandle.toLowerCase() });
          observation = await timedStage("COLLECT_THREAD", () => observeVisibleThread(tabId, expectedHandle, candidate.xPostUrl, ready), { parentStatusUrl: candidate.xPostUrl, statusId });
          threadResult = await timedStage("DOM_THREAD_SNAPSHOT", () => executeMain(tabId, collectXStatusThreadReplies, [{ sourceXHandle: expectedHandle, sourceStatusUrl: candidate.xPostUrl, readyEvidence: ready }], { requireResult: true }), { parentStatusUrl: candidate.xPostUrl, statusId });
          transition("COLLECT_THREAD_COMPLETE", {
            parentStatusUrl: candidate.xPostUrl,
            statusId,
            startedAt: statusStartedAt,
            finishedAt: new Date().toISOString(),
            elapsedMs: Date.now() - statusStartedMs,
            observationElapsedMs: observation?.elapsedMs ?? null,
            observationDiagnostics: observation
          });
          break;
        } catch (error) {
          if (!retriedStatusTab && isWorkerTabLostError(error)) {
            retriedStatusTab = true;
            const recreated = await recreateWorkerTabForStatus(openerTabId, tabId, candidate.xPostUrl, expectedHandle);
            statusRetryEvidence.push(recreated.evidence);
            tabId = recreated.tabId;
            transition("WORKER_TAB_RECREATED", { parentStatusUrl: candidate.xPostUrl, statusId, ...recreated.evidence });
            continue;
          }
          throw error;
        }
      }
      const observed = Boolean(threadResult?.ok && observation?.parentFound);
      if (observed) {
        statusThreadsObserved += 1;
        if (observation.fullyObserved) fullyObservedThreads += 1;
        transition("THREAD_OBSERVED", { parentStatusUrl: candidate.xPostUrl, articleCount: threadResult.articleCount, authorReplyCount: threadResult.authorReplyCount, diagnostics: observation });
      }
      statusThreadMyfansLinkCount += threadResult.myfansLinkCount || 0;
      const parent = threadResult.parentCandidate || null;
      const parentHasMedia = Boolean(parent?.hasImage || parent?.hasVideo || parent?.mediaType === "image" || parent?.mediaType === "video");
      const ownRepliesForParent = Array.isArray(threadResult.ownReplies) ? threadResult.ownReplies.filter((reply) => reply.authorHandle?.toLowerCase() === expectedHandle.toLowerCase()) : [];
      const parentLinks = Array.isArray(parent?.myfansUrls) ? parent.myfansUrls : [];
      const replyWithLink = ownRepliesForParent.find((reply) => Array.isArray(reply.myfansUrls) && reply.myfansUrls.length > 0) || null;
      const selectedLinkCandidate = parentLinks.length > 0 ? parent : replyWithLink;
      const statusEvidence = { statusRetryEvidence, observation, threadResultDiagnostics: threadResult?.diagnostics || null, parentHasMedia, selectedLinkCandidateSource: parentLinks.length > 0 ? "parent" : replyWithLink ? "own_reply" : null, resolverEvidence: [] };
      const entry = collectionStatuses.find((item) => item.parentStatusUrl === candidate.xPostUrl);
      if (entry) entry.evidence = statusEvidence;
      if (!observation) {
        observationFailureCount += 1;
        statusEvidence.observationDiagnostics = {
          statusUrl: candidate.xPostUrl,
          statusId,
          expectedAuthor: expectedHandle,
          observedAuthor: null,
          articleCount: threadResult?.articleCount ?? result.diagnostics?.articleCount ?? null,
          media: { parentHasMedia, mediaType: parent?.mediaType || candidate.mediaType || "none", mediaCount: parent?.mediaCount ?? candidate.mediaCount ?? 0 },
          parentLinkCandidates: parentLinks,
          selfReplyLinkCandidates: ownRepliesForParent.flatMap((reply) => Array.isArray(reply.myfansUrls) ? reply.myfansUrls : []),
          elapsedMs: Date.now() - statusStartedMs,
          failureReason: "executeMain returned no observation value",
          errorCode: "THREAD_OBSERVATION_FAILED"
        };
        if (entry) entry.status = "THREAD_OBSERVATION_FAILED";
        continue;
      }
      if (!observed || !observation.parentFound) {
        if (entry) entry.status = "PARENT_NOT_FOUND";
        continue;
      }
      if (!threadResult?.ok) {
        if (entry) entry.status = "THREAD_RESULT_NOT_OK";
        continue;
      }
      if (!parentHasMedia) {
        if (entry) entry.status = "NO_MEDIA";
        continue;
      }
      if (!observation.fullyObserved && selectedLinkCandidate) {
        threadNotFullyObservedCount += 1;
        if (entry) entry.status = "LINK_FOUND_THREAD_INCOMPLETE";
        continue;
      }
      if (!observation.fullyObserved && !selectedLinkCandidate) {
        threadNotFullyObservedCount += 1;
        if (entry) entry.status = "THREAD_INCOMPLETE_WITHOUT_LINK";
        continue;
      }
      if (!selectedLinkCandidate) {
        if (entry) entry.status = "NO_OWN_MYFANS_LINK";
        continue;
      }
      transition("RESOLVE_LINK", { parentStatusUrl: candidate.xPostUrl, source: parentLinks.length > 0 ? "parent" : "own_reply" });
      const ownReply = selectedLinkCandidate === parent ? null : selectedLinkCandidate;
      const linkCandidate = await resolveCandidateMyfansLinks(tabId, { ...(selectedLinkCandidate || {}), myfansLinkSource: parentLinks.length > 0 ? "parent" : "own_reply" }, candidate.xPostUrl, expectedHandle);
      let selectedLinks = linkCandidate.myfansUrls;
      statusEvidence.resolverEvidence.push(...(linkCandidate.resolvedProductEvidence || []));
      if (selectedLinks.length === 0) {
        if (entry) entry.status = "LINK_UNRESOLVED";
        continue;
      }
      const merged = {
        ...candidate,
        parentStatusUrl: candidate.xPostUrl,
        parentStatusId: candidate.xPostUrl.match(/\/status\/(\d+)/)?.[1] || null,
        ownReplyStatusUrl: ownReply?.xPostUrl || null,
        ownReplyStatusId: ownReply?.xPostUrl?.match(/\/status\/(\d+)/)?.[1] || null,
        myfansLinkSource: parentLinks.length > 0 ? "parent" : "own_reply",
        myfansUrls: [...new Set(selectedLinks)],
        threadCollectionStatus: "FOUND_COMPLETE_THREAD",
        collectorMethod: COLLECTOR_METHOD,
        resolvedProductEvidence: statusEvidence.resolverEvidence.length > 0 ? statusEvidence.resolverEvidence : null,
        linkResolutionStatus: linkCandidate.linkResolutionStatus
      };
      completeThreadCandidates.push(merged);
      if (entry) entry.status = "FOUND_COMPLETE_THREAD";
      authorReplies.push(...ownRepliesForParent);
    } catch (error) {
      threadNotFullyObservedCount += 1;
      const entry = collectionStatuses.find((item) => item.parentStatusUrl === candidate.xPostUrl);
      const errorCode = categoryFromError(error);
      if (errorCode === FAILURE_CATEGORY.THREAD_OBSERVATION_FAILED || errorCode === FAILURE_CATEGORY.RESULT_UNDEFINED || errorCode === FAILURE_CATEGORY.RESULT_EMPTY || errorCode === FAILURE_CATEGORY.RESULT_FRAME_MISSING) observationFailureCount += 1;
      if (entry) {
        entry.status = errorCode === FAILURE_CATEGORY.THREAD_OBSERVATION_FAILED ? "THREAD_OBSERVATION_FAILED" : "THREAD_RESULT_NOT_OK";
        entry.evidence = {
          ...(entry.evidence || {}),
          observationDiagnostics: {
            statusUrl: candidate.xPostUrl,
            statusId,
            expectedAuthor: expectedHandle,
            observedAuthor: null,
            articleCount: result.diagnostics?.articleCount ?? null,
            media: { parentHasMedia: false, mediaType: candidate.mediaType || "none", mediaCount: candidate.mediaCount || 0 },
            parentLinkCandidates: [],
            selfReplyLinkCandidates: [],
            elapsedMs: 0,
            failureReason: error instanceof Error ? error.message : String(error),
            errorCode
          }
        };
      }
      transition("THREAD_NOT_FULLY_OBSERVED", { parentStatusUrl: candidate.xPostUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const deduped = completeThreadCandidates.filter((candidate, index, all) => all.findIndex((item) => item.xPostUrl === candidate.xPostUrl) === index);
  const hasCompleteThread = deduped.length > 0;
  transition("SAVE", { completeThreadsFound: deduped.length, candidatesSaved: deduped.length, statusThreadsObserved, fullyObservedThreads });
  return {
    ...result,
    ok: hasCompleteThread,
    stage: hasCompleteThread ? "COMPLETE_THREAD" : "COMPLETE_THREAD_NO_MATCH",
    errorCode: hasCompleteThread ? null : (observationFailureCount > 0 ? "THREAD_OBSERVATION_FAILED" : (threadNotFullyObservedCount > 0 ? "THREAD_INCOMPLETE_WITHOUT_LINK" : "NO_OWN_MYFANS_LINK")),
    errorMessage: hasCompleteThread ? null : (observationFailureCount > 0 ? "status threadの観測に失敗したため、リンクなしとは判定しませんでした。" : (threadNotFullyObservedCount > 0 ? "threadを十分に観測できなかったため、リンクなしとは判定しませんでした。" : "本人の親本文または自己リプにmyfansリンクがありませんでした。")),
    collectionStatuses,
    quoteCandidates: deduped,
    diagnostics: {
      ...result.diagnostics,
      collectorMethod: COLLECTOR_METHOD,
      collectionStatuses,
      statusThreadsObserved,
      fullyObservedThreads,
      authorReplyCount: authorReplies.length,
      statusThreadMyfansLinkCount,
      threadNotFullyObservedCount,
      observationFailureCount,
      completeThreadCandidateCount: deduped.length
    },
    stateTransitions,
    profileCounts: { articles: result.diagnostics?.articleCount ?? 0, ownPosts: result.diagnostics?.ownPostCount ?? 0, mediaPosts: parentCandidates.length },
    profileScan: { articleCount: result.diagnostics?.articleCount ?? 0, ownPostCount: result.diagnostics?.ownPostCount ?? 0, videoCandidates: result.diagnostics?.videoCandidates ?? 0, mediaPosts: parentCandidates.length },
    statusCounts: { navigationAttempted: stateTransitions.filter((entry) => entry.stage === "NAVIGATE_STATUS").length, threadsObserved: statusThreadsObserved, fullyObserved: fullyObservedThreads, authorReplies: authorReplies.length, threadLinks: statusThreadMyfansLinkCount }
  };
}

async function runBulkQuoteRefresh(settings) {
  if (globalThis.myfansQuoteRefreshRunning) return;
  globalThis.myfansQuoteRefreshRunning = true;
  const persistedSettings = { ...settings };
  const sessionId = String(persistedSettings.sessionId || "").trim();
  if (!sessionId) {
    await clearQuoteContinuation();
    await setQuoteState({ running: false, status: "idle", message: "current-sessionがないため自動再開しません。" });
    globalThis.myfansQuoteRefreshRunning = false;
    return;
  }
  globalThis.myfansQuoteRefreshSettings = persistedSettings;
  const startState = { running: true, status: "starting", jobId: persistedSettings.jobId || null, sessionId, launchMode: persistedSettings.launchMode || "new", collectorVersion: WORKER_VERSION, message: "一括更新を開始します。", errorCode: null, lastError: null, failureDiagnostics: null };
  if (!persistedSettings.jobId) startState.attemptDiagnostics = [];
  await setQuoteState(startState);
  await scheduleQuoteContinuation(persistedSettings, 120000);
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!persistedSettings.jobId) {
      const created = await quoteRefreshRequest(persistedSettings, {
        action: "create",
        batchSize: persistedSettings.batchSize || 10,
        queueLimit: persistedSettings.queueLimit || persistedSettings.batchSize || 10,
        cooldownDays: persistedSettings.cooldownDays || 3,
        targetedCreatorIds: persistedSettings.targetedCreatorIds || [],
        sessionId,
        collectorVersion: WORKER_VERSION,
        launchMode: persistedSettings.launchMode || "new"
      });
      if (!created.job?.id) {
        await clearQuoteContinuation();
        await setQuoteState({ running: false, status: "done", job: created.job || null, items: created.items || [], message: "対象creatorがありません。" });
        return;
      }
      persistedSettings.jobId = created.job.id;
      persistedSettings.runToken = created.job.collection_run_token;
      persistedSettings.collectorVersion = created.job.collector_version || WORKER_VERSION;
      await quoteRefreshRequest(persistedSettings, { action: "start", jobId: persistedSettings.jobId, sessionId, runToken: persistedSettings.runToken, collectorVersion: persistedSettings.collectorVersion });
      const rotationMessage = created.rotation?.selectionMode === "empty"
        ? "対象不足: 前日除外とcooldown中のため、同日再利用せず停止します。"
        : created.rotation?.selectionMode === "relaxed"
          ? "優先cooldown中のため、前日除外を維持して最古巡回順で開始します。"
          : "未巡回・長期間未巡回creatorを優先して開始します。";
      await setQuoteState({ jobId: persistedSettings.jobId, sessionId, runToken: persistedSettings.runToken, launchMode: "new", collectorVersion: WORKER_VERSION, identity: { job_id: persistedSettings.jobId, collection_session_id: sessionId, run_token: persistedSettings.runToken, collector_version: persistedSettings.collectorVersion }, job: created.job, items: created.items || [], message: `new jobを作成しました。${rotationMessage}` });
    } else {
      await quoteRefreshRequest(persistedSettings, { action: "start", jobId: persistedSettings.jobId, sessionId, runToken: persistedSettings.runToken, collectorVersion: persistedSettings.collectorVersion || WORKER_VERSION });
    }
    if (await isQuoteCancelRequested(persistedSettings.jobId)) {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "cancelled", finalStatus: "cancelled", message: "現在の安全な単位の終了後に中止しました。" });
      return;
    }
    let workerTabId = await ensureWorkerTab(currentTab?.id);
    const next = await quoteRefreshRequest(persistedSettings, { action: "next", jobId: persistedSettings.jobId || undefined, sessionId, runToken: persistedSettings.runToken, collectorVersion: persistedSettings.collectorVersion || WORKER_VERSION });
    if (next.stale || next.needsUserAction || next.reason === "session_mismatch" || next.errorCode === "JOB_IDENTITY_MISMATCH") {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "needs_user_action", job: next.job || null, sessionId, launchMode: "resumed", collectorVersion: WORKER_VERSION, message: next.message || "自動再開せず停止しました。明示的な操作が必要です。" });
      return;
    }
    if (next.paused) {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "paused", job: next.job, message: "一括更新は一時停止中です。" });
      return;
    }
    if (next.done || !next.item) {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "done", job: next.job, items: next.items || [], message: "一括更新が完了しました。" });
      return;
    }
    const item = next.item;
    await setQuoteState({ collectionStatuses: [], articleCount: null, ownPostCount: null, candidateCount: 0, videoCandidates: null, videoCount: 0, videoValidation: null, statusThreadsObserved: 0, fullyObservedThreads: 0, authorReplyCount: 0, statusThreadMyfansLinkCount: 0, currentItemId: item.id, currentJobId: next.jobId, identity: { job_id: next.jobId, collection_session_id: sessionId, run_token: persistedSettings.runToken, collector_version: persistedSettings.collectorVersion || WORKER_VERSION } });
    const creatorName = Array.isArray(item.myfans_creators) ? item.myfans_creators[0]?.display_name : item.myfans_creators?.display_name;
    const progressBefore = await fetchQuoteProgress(persistedSettings, { jobId: next.jobId }).catch(() => null);
    const processedBefore = Number(progressBefore?.job?.processed_creators || 0);
    await setQuoteState({ status: "running", jobId: next.jobId, currentCreator: creatorName || item.creator_x_url, message: `処理中: ${creatorName || item.creator_x_url}`, sessionProcessed: processedBefore });
    await scheduleQuoteContinuation(persistedSettings, 120000);
    try {
      let result = null;
      let lastCollectError = null;
      let tabRecreated = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, message: `処理中: ${creatorName || item.creator_x_url} (${attempt}/3)`, retryCount: attempt - 1, sessionProcessed: processedBefore });
          result = await collectFromWorkerTab(workerTabId, item, next.jobId, currentTab?.id || null);
          await setQuoteState({
            status: "running",
            currentCreator: creatorName || item.creator_x_url,
            stage: result.stage || "FINALIZE",
            articleCount: result.diagnostics?.articleCount ?? null,
            ownPostCount: result.diagnostics?.ownPostCount ?? null,
            candidateCount: result.quoteCandidates?.length ?? 0,
            videoCandidates: result.diagnostics?.videoCandidates ?? null,
            videoValidation: result.diagnostics?.videoValidation || null,
            statusThreadsObserved: result.diagnostics?.statusThreadsObserved ?? 0,
            fullyObservedThreads: result.diagnostics?.fullyObservedThreads ?? 0,
            authorReplyCount: result.diagnostics?.authorReplyCount ?? 0,
            statusThreadMyfansLinkCount: result.diagnostics?.statusThreadMyfansLinkCount ?? 0,
            retryCount: attempt - 1,
            finalStatus: "extracted",
            sessionProcessed: processedBefore
          });
          break;
        } catch (collectError) {
          lastCollectError = collectError;
          let recreatedThisAttempt = false;
          if (!tabRecreated && /No tab with id|tab.*(?:not found|does not exist)|Could not find tab/i.test(collectError instanceof Error ? collectError.message : String(collectError))) {
            tabRecreated = true;
            recreatedThisAttempt = true;
            workerTabId = await ensureWorkerTab(currentTab?.id);
          }
          await appendQuoteAttemptDiagnostic({
            at: new Date().toISOString(),
            stage: "COLLECT",
            attempt,
            errorCode: categoryFromError(collectError),
            message: collectError instanceof Error ? collectError.message : String(collectError || ""),
            diagnostics: collectError && typeof collectError === "object" && collectError.diagnostics ? collectError.diagnostics : null
          });
          const maxAttempts = categoryFromError(collectError) === FAILURE_CATEGORY.EXECUTE_SCRIPT_NO_RESULT ? 2 : 3;
          if (attempt >= maxAttempts || (!isRetryableError(collectError) && !recreatedThisAttempt)) break;
          const retryMessage = collectError instanceof Error ? collectError.message : "取得を再試行します。";
          await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, stage: categoryFromError(collectError), message: `retry: ${retryMessage}`, lastError: retryMessage, retryCount: attempt, sessionProcessed: processedBefore });
          await prepareRetry(workerTabId, item).catch(() => undefined);
          await wait(2500);
        }
      }
      if (!result) throw lastCollectError || categorizedError(FAILURE_CATEGORY.UNKNOWN, "Xページから引用候補を取得できませんでした。");
      const payload = await sendPayload(persistedSettings, result);
          await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, message: `保存しました: ${creatorName || item.creator_x_url}`, ...MyfansCompanionState.successPatch(payload.candidatesCount, payload), collectionStatuses: payload.collectionStatuses || result.collectionStatuses || [], sessionProcessed: processedBefore + 1 });
    } catch (error) {
      await markItemFailed(persistedSettings, next.jobId, item.id, error);
      const message = error instanceof Error ? error.message : "取得に失敗しました";
      const diagnostics = error && typeof error === "object" && error.diagnostics ? error.diagnostics : null;
      await setQuoteState({ collectionStatuses: [], articleCount: null, ownPostCount: null, candidateCount: 0, videoCandidates: null, videoCount: 0, videoValidation: null, statusThreadsObserved: 0, fullyObservedThreads: 0, authorReplyCount: 0, statusThreadMyfansLinkCount: 0, status: "running", currentCreator: creatorName || item.creator_x_url, message: `skip: ${creatorName || item.creator_x_url}`, finalStatus: "failed", errorCode: categoryFromError(error), lastError: message, failureDiagnostics: diagnostics, sessionProcessed: processedBefore + 1 });
      if (categoryFromError(error) === "JOB_IDENTITY_MISMATCH" || /認証|ログイン|challenge|captcha/i.test(message)) {
        await clearQuoteContinuation();
        await setQuoteState({ running: false, status: "stopped", errorCode: categoryFromError(error), message, lastError: message, identityMismatch: categoryFromError(error) === "JOB_IDENTITY_MISMATCH" });
        return;
      }
    }
    const completed = await fetchQuoteProgress(persistedSettings, { jobId: next.jobId }).catch(() => null);
    if (await isQuoteCancelRequested(next.jobId)) {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "cancelled", finalStatus: "cancelled", job: completed?.job || null, message: "現在のアカウント処理を終えて中止しました。" });
      return;
    }
    const completedJob = completed?.job;
    if (MyfansCompanionState.isCompleted(completedJob)) {
      await clearQuoteContinuation();
      await setQuoteState({ running: false, status: "done", job: completedJob, message: "一括更新が完了しました。" });
      return;
    }
    const batchSize = Number(next.batchSize || persistedSettings.batchSize || 10);
    const delayMs = (processedBefore + 1) % batchSize === 0 ? 60000 : 5000;
    persistedSettings.launchMode = "resumed";
    await scheduleQuoteContinuation(persistedSettings, delayMs);
    await setQuoteState({ running: true, status: "scheduled", jobId: persistedSettings.jobId, sessionId, launchMode: "resumed", collectorVersion: WORKER_VERSION, message: `同一current-sessionのjobを${Math.round(delayMs / 1000)}秒後に継続します。` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "一括更新を実行できませんでした。";
    await setQuoteState({ running: false, status: "error", message, lastError: message });
    await scheduleQuoteContinuation(persistedSettings, 10000).catch(() => undefined);
  } finally {
    globalThis.myfansQuoteRefreshRunning = false;
    globalThis.myfansQuoteRefreshSettings = null;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== QUOTE_ALARM_NAME) return;
  if (globalThis.myfansQuoteRefreshRunning) {
    scheduleQuoteContinuation(globalThis.myfansQuoteRefreshSettings || {}, 120000).catch(() => undefined);
    return;
  }
  chrome.storage.local.get([QUOTE_SETTINGS_KEY]).then((stored) => {
    const savedSettings = stored[QUOTE_SETTINGS_KEY];
    return chrome.storage.local.get([QUOTE_STATE_KEY]).then((stateStored) => {
      const state = stateStored[QUOTE_STATE_KEY];
      const sameSession = savedSettings?.sessionId && savedSettings.sessionId === state?.sessionId;
      const identity = state?.identity || {};
      const resumable = sameSession && state?.running === true && state?.jobId && ["running", "scheduled"].includes(state?.status) && identity.collector_version === WORKER_VERSION;
      if (savedSettings?.baseUrl && resumable) {
        return fetchQuoteProgress(savedSettings, state).then((payload) => {
          const job = payload?.job;
          if (!MyfansCompanionState.isCurrentActiveRun(state, job, WORKER_VERSION)) return clearQuoteContinuation();
          return runBulkQuoteRefresh({ ...savedSettings, jobId: job.id, runToken: job.collection_run_token, collectorVersion: job.collector_version, launchMode: "resumed" });
        });
      }
      return clearQuoteContinuation();
    });
  }).catch((error) => console.debug("[myfans companion background] continuation failed", error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "myfans_companion_settings_sync") {
    getCompanionSettings().then(async (context) => {
      const progress = await fetchQuoteProgress(context.settings, context.state).catch(() => null);
      sendResponse({ ok: true, workerVersion: WORKER_VERSION, ...context, progress });
    }).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  if (message?.type === "myfans_companion_settings_save") {
    saveCompanionSettings(message.settings || {})
      .then((settings) => sendResponse({ ok: true, settings, workerVersion: WORKER_VERSION }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  if (message?.type === "myfans_quote_refresh_ping") {
    console.debug("[myfans companion background] BACKGROUND_PING_RECEIVED", { source: message.source, bridgeVersion: message.bridgeVersion });
    chrome.storage.local.get([QUOTE_STATE_KEY]).then((stored) => {
      const detail = { ok: true, version: WORKER_VERSION, status: stored[QUOTE_STATE_KEY]?.status || "idle", state: stored[QUOTE_STATE_KEY] || null };
      console.debug("[myfans companion background] BACKGROUND_PONG_SENT", detail);
      sendResponse(detail);
    });
    return true;
  }
  if (message?.type === "myfans_quote_refresh_start") {
    const settings = { ...(message.settings || {}), sessionId: crypto.randomUUID(), jobId: null, runToken: null, launchMode: "new", collectorVersion: WORKER_VERSION };
    chrome.storage.local.remove([QUOTE_CANCEL_KEY, QUOTE_SETTINGS_KEY]).then(() => saveCompanionSettings(settings)).then(() => saveQuoteSettings(settings)).then(() => runBulkQuoteRefresh(settings)).catch((error) => console.debug("[myfans companion background] start failed", error));
    sendResponse({ ok: true, status: "accepted", workerVersion: WORKER_VERSION, jobId: null, sessionId: settings.sessionId, launchMode: "new" });
    return true;
  }
  if (message?.type === "myfans_quote_refresh_cancel_request") {
    requestQuoteCancel(Number(message.jobId) || null).then(() => sendResponse({ ok: true, status: "cancel_requested", workerVersion: WORKER_VERSION })).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  if (message?.type === "myfans_diagnostic_status_start") {
    runDiagnosticStatus(message.settings || {});
    sendResponse({ ok: true, status: "accepted", workerVersion: WORKER_VERSION });
    return true;
  }
  if (message?.type === "myfans_diagnostic_status_state") {
    chrome.storage.local.get(["myfansDiagnosticState"]).then((stored) => sendResponse({ ok: true, workerVersion: WORKER_VERSION, state: stored.myfansDiagnosticState || null }));
    return true;
  }
  if (message?.type === "myfans_single_status_collect_start") {
    if (diagnosticRunning) {
      sendResponse({ ok: false, status: "busy", errorCode: "SINGLE_RUN_ALREADY_ACTIVE", error: "Companion収集が実行中です。現在のrunを完了してから再実行してください。", workerVersion: WORKER_VERSION });
      return true;
    }
    runSingleStatusCollection(message.settings || {});
    sendResponse({ ok: true, status: "accepted", workerVersion: WORKER_VERSION });
    return true;
  }
  if (message?.type === "myfans_single_status_collect_state") {
    chrome.storage.local.get(["myfansSingleStatusState"]).then((stored) => sendResponse({ ok: true, workerVersion: WORKER_VERSION, state: stored.myfansSingleStatusState || null }));
    return true;
  }
  if (message?.type === "myfans_visual_verification_start") {
    const settings = message.settings || {};
    runVisualVerification(settings);
    sendResponse({ ok: true, status: "accepted", workerVersion: WORKER_VERSION, batchSize: settings.batchSize || 10 });
    return true;
  }
  if (message?.type === "myfans_quote_refresh_state") {
    chrome.storage.local.get([QUOTE_STATE_KEY]).then((stored) => sendResponse({ ok: true, workerVersion: WORKER_VERSION, state: stored[QUOTE_STATE_KEY] || null }));
    return true;
  }
  if (message?.type === "myfans_admin_bridge_inject") {
    const tabId = Number(message.tabId);
    if (!Number.isSafeInteger(tabId)) {
      sendResponse({ ok: false, error: "tabIdが不正です。", workerVersion: WORKER_VERSION });
      return true;
    }
    injectAdminBridge(tabId, message.reason || "manual")
      .then((result) => sendResponse({ ...result, workerVersion: WORKER_VERSION }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  if (message?.type === "myfans_admin_bridge_diagnostics") {
    const tabId = Number(message.tabId);
    if (!Number.isSafeInteger(tabId)) {
      sendResponse({ ok: false, error: "tabIdが不正です。", workerVersion: WORKER_VERSION });
      return true;
    }
    inspectAdminBridge(tabId)
      .then((result) => sendResponse({ ok: true, workerVersion: WORKER_VERSION, ...(result || {}) }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  if (message?.type === "myfans_admin_probe") {
    const tabId = Number(message.tabId);
    if (!Number.isSafeInteger(tabId)) {
      sendResponse({ ok: false, error: "tabIdが不正です。", workerVersion: WORKER_VERSION });
      return true;
    }
    probeAdminTab(tabId)
      .then((result) => sendResponse({ ...result, workerVersion: WORKER_VERSION }))
      .catch((error) => sendResponse({ ok: false, canExecuteScript: false, markerWritten: false, error: error instanceof Error ? error.message : String(error), workerVersion: WORKER_VERSION }));
    return true;
  }
  return false;
});
