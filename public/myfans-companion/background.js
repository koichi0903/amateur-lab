const QUOTE_STATE_KEY = "myfansQuoteRefreshState";
const WORKER_TAB_KEY = "myfansQuoteWorkerTabId";
const WORKER_VERSION = "0.1.5";
const ADMIN_BRIDGE_FILE = "myfans-admin-bridge.js";
const ADMIN_HOSTS = new Set(["localhost", "127.0.0.1"]);

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

const FAILURE_CATEGORY = {
  EXECUTE_SCRIPT_NO_RESULT: "EXECUTE_SCRIPT_NO_RESULT",
  TAB_NOT_READY: "TAB_NOT_READY",
  NAVIGATION_TIMEOUT: "NAVIGATION_TIMEOUT",
  PAGE_LOAD_TIMEOUT: "PAGE_LOAD_TIMEOUT",
  VIDEO_VALIDATION_NO_RESULT: "VIDEO_VALIDATION_NO_RESULT",
  VIDEO_VALIDATION_TIMEOUT: "VIDEO_VALIDATION_TIMEOUT",
  NO_TWEET_ARTICLES: "NO_TWEET_ARTICLES",
  OWN_POST_FILTER_ZERO: "OWN_POST_FILTER_ZERO",
  ONLY_REPOSTS_OR_REPLIES: "ONLY_REPOSTS_OR_REPLIES",
  SENSITIVE_CONTENT_GATE: "SENSITIVE_CONTENT_GATE",
  LOGIN_OR_CHALLENGE: "LOGIN_OR_CHALLENGE",
  DOM_SELECTOR_MISMATCH: "DOM_SELECTOR_MISMATCH",
  PROFILE_NOT_FOUND_SUSPENDED: "PROFILE_NOT_FOUND/SUSPENDED",
  X_TEMPORARY_ERROR: "X_TEMPORARY_ERROR",
  UNKNOWN: "UNKNOWN"
};

const NON_RETRYABLE_CATEGORIES = new Set([
  FAILURE_CATEGORY.LOGIN_OR_CHALLENGE,
  FAILURE_CATEGORY.PROFILE_NOT_FOUND_SUSPENDED,
  FAILURE_CATEGORY.SENSITIVE_CONTENT_GATE
]);

function categorizedError(category, message) {
  const error = new Error(`${category}: ${message}`);
  error.category = category;
  error.retryable = !NON_RETRYABLE_CATEGORIES.has(category);
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
  return !NON_RETRYABLE_CATEGORIES.has(category);
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
    TAB_NOT_READY: "Xタブの準備が完了していません。",
    NAVIGATION_TIMEOUT: "Xプロフィールへの移動が完了しませんでした。",
    PAGE_LOAD_TIMEOUT: "Xプロフィールの読み込みが完了しませんでした。",
    VIDEO_VALIDATION_NO_RESULT: "動画URL検証の結果が返りませんでした。",
    VIDEO_VALIDATION_TIMEOUT: "動画URL検証が時間切れになりました。",
    NO_TWEET_ARTICLES: "投稿DOMがまだ表示されていません。",
    OWN_POST_FILTER_ZERO: "本人投稿のURLを抽出できませんでした。",
    ONLY_REPOSTS_OR_REPLIES: "表示範囲がリポスト/返信のみでした。",
    SENSITIVE_CONTENT_GATE: "センシティブ警告で投稿一覧が見えません。",
    LOGIN_OR_CHALLENGE: "Xのログイン/認証画面を検知しました。",
    DOM_SELECTOR_MISMATCH: "XのDOM構造が想定と違います。",
    "PROFILE_NOT_FOUND/SUSPENDED": "プロフィールが存在しない、または凍結/停止されています。",
    X_TEMPORARY_ERROR: "Xの一時エラー表示を検知しました。",
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
  return String(value || "http://localhost:3000").replace(/\/$/, "");
}

async function setQuoteState(patch) {
  const stored = await chrome.storage.local.get([QUOTE_STATE_KEY]);
  const next = { ...(stored[QUOTE_STATE_KEY] || {}), ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [QUOTE_STATE_KEY]: next });
  return next;
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
  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, approvedMediaId: settings.approvedMediaId || null, approvedMediaName: settings.approvedMediaName || "@lumi_reviw" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `送信に失敗しました (${response.status})`);
  return payload;
}

async function markItemFailed(settings, jobId, itemId, error) {
  await fetch(`${normalizeBaseUrl(settings.baseUrl)}/api/admin/myfans/companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "x_quote_scan",
      refreshJobId: jobId,
      refreshJobItemId: itemId,
      creatorId: "",
      creatorXUrl: "",
      sourceXHandle: "",
      quoteCandidates: [],
      approvedMediaId: settings.approvedMediaId || null,
      approvedMediaName: settings.approvedMediaName || "@lumi_reviw",
      failureReason: error instanceof Error ? error.message : String(error || "取得に失敗しました")
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
  const baseDiagnostics = {
    url: location.href,
    readyState: document.readyState,
    articleCount,
    hasRetry,
    hasSensitiveGate,
    hasChallenge,
    notFound,
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
    const statusHref = Array.from(article.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href") || "")
      .find((href) => new RegExp(`^/${sourceXHandle}/status/\\d+`).test(href));
    const statusUrl = statusHref ? `https://x.com${statusHref.match(/^([^?#]+)/)?.[1] || statusHref}` : "";
    const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
    const rawText = article.innerText || "";
    const analytics = Array.from(article.querySelectorAll("a[href]")).find((link) => /\/analytics$/.test(link.getAttribute("href") || ""));
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
      text: article.querySelector('[data-testid="tweetText"]')?.textContent || "",
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
  return {
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
  };
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

async function executeMain(tabId, func, args = []) {
  let injection = null;
  try {
    injection = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func,
      args
    });
  } catch (error) {
    throw categorizedError(FAILURE_CATEGORY.EXECUTE_SCRIPT_NO_RESULT, error instanceof Error ? error.message : "Xページでスクリプトを実行できませんでした。");
  }
  const first = injection?.[0];
  if (!first) throw categorizedError(FAILURE_CATEGORY.EXECUTE_SCRIPT_NO_RESULT, "Xページでスクリプト実行結果を取得できませんでした。");
  return first.result;
}

async function waitForTweetRender(tabId, expectedHandle, timeoutMs) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await executeMain(tabId, inspectXPageState, [expectedHandle]);
    if (lastState.hasChallenge) throw categorizedError(FAILURE_CATEGORY.LOGIN_OR_CHALLENGE, "Xのログイン/認証画面を検知しました。");
    if (lastState.notFound) throw categorizedError(FAILURE_CATEGORY.PROFILE_NOT_FOUND_SUSPENDED, "プロフィールが存在しない、または凍結/停止されています。");
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
    const batch = await visualVerificationRequest(settings, { action: "select_companion_batch", limit: settings.batchSize || 10 });
    const workerTabId = await ensureWorkerTab(currentTab?.id);
    let checked = 0;
    let verified = 0;
    let partial = 0;
    let unavailable = 0;
    for (const candidate of batch.candidates || []) {
      const targetUrl = candidate.mediaPermalink || candidate.xPostUrl;
      if (!targetUrl) continue;
      await setQuoteState({ visualStatus: "running", visualMessage: `visual確認中: ${targetUrl}`, visualChecked: checked, visualVerified: verified, visualPartial: partial, visualUnavailable: unavailable });
      let inspection = null;
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
      await visualVerificationRequest(settings, {
        action: "save_companion_evidence",
        id: candidate.id,
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
      await wait(2500);
    }
    await setQuoteState({ visualRunning: false, visualStatus: "done", visualMessage: "visual verificationが完了しました。", visualChecked: checked, visualVerified: verified, visualPartial: partial, visualUnavailable: unavailable });
  } catch (error) {
    await setQuoteState({ visualRunning: false, visualStatus: "error", visualMessage: error instanceof Error ? error.message : "visual verificationを実行できませんでした。", visualLastError: error instanceof Error ? error.message : String(error) });
  } finally {
    globalThis.myfansVisualVerificationRunning = false;
  }
}

function statusParts(statusUrl) {
  const match = String(statusUrl || "").match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)$/);
  return match ? { handle: match[1], statusId: match[2] } : null;
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

async function collectFromWorkerTab(tabId, item, jobId) {
  const url = `${item.creator_x_url}?myfans_creator_id=${item.creator_id}&myfans_refresh_job_id=${jobId}&myfans_refresh_item_id=${item.id}`;
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
  const rawResult = await executeMain(tabId, collectXQuoteCandidates);
  const result = ensureStructuredScanResult(rawResult, "EXTRACT");
  if (!result.ok || !Array.isArray(result.quoteCandidates) || result.quoteCandidates.length === 0) {
    throw categorizedError(result.errorCode || FAILURE_CATEGORY.UNKNOWN, result.errorMessage || "Xページから引用候補を取得できませんでした。");
  }
  return await validateVideoPermalinks(tabId, result);
}

async function runBulkQuoteRefresh(settings) {
  if (globalThis.myfansQuoteRefreshRunning) return;
  globalThis.myfansQuoteRefreshRunning = true;
  await setQuoteState({ running: true, status: "starting", jobId: settings.jobId || null, message: "一括更新を開始します。", sessionProcessed: 0, lastError: null });
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!settings.jobId) {
      const created = await quoteRefreshRequest(settings, {
        action: "create",
        batchSize: settings.batchSize || 5,
        queueLimit: settings.queueLimit || settings.batchSize || 5,
        replaceActive: true
      });
      if (!created.job?.id) {
        await setQuoteState({ running: false, status: "done", job: created.job || null, items: created.items || [], message: "対象creatorがありません。" });
        return;
      }
      settings.jobId = created.job.id;
      await quoteRefreshRequest(settings, { action: "start", jobId: settings.jobId });
      await setQuoteState({ jobId: settings.jobId, job: created.job, items: created.items || [], message: "jobを作成し、巡回を開始します。" });
    } else {
      await quoteRefreshRequest(settings, { action: "start", jobId: settings.jobId });
    }
    const workerTabId = await ensureWorkerTab(currentTab?.id);
    let processedInSession = 0;
    while (true) {
      const next = await quoteRefreshRequest(settings, { action: "next", jobId: settings.jobId || undefined });
      if (next.paused) {
        await setQuoteState({ running: false, status: "paused", job: next.job, message: "一括更新は一時停止中です。" });
        return;
      }
      if (next.done || !next.item) {
        await setQuoteState({ running: false, status: "done", job: next.job, items: next.items || [], message: "一括更新が完了しました。" });
        return;
      }
      const item = next.item;
      const creatorName = Array.isArray(item.myfans_creators) ? item.myfans_creators[0]?.display_name : item.myfans_creators?.display_name;
      await setQuoteState({ status: "running", jobId: next.jobId, currentCreator: creatorName || item.creator_x_url, message: `処理中: ${creatorName || item.creator_x_url}`, sessionProcessed: processedInSession });
      try {
        let result = null;
        let lastCollectError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, message: `処理中: ${creatorName || item.creator_x_url} (${attempt}/3)`, retryCount: attempt - 1, sessionProcessed: processedInSession });
            result = await collectFromWorkerTab(workerTabId, item, next.jobId);
            await setQuoteState({
              status: "running",
              currentCreator: creatorName || item.creator_x_url,
              stage: result.stage || "FINALIZE",
              articleCount: result.diagnostics?.articleCount ?? null,
              ownPostCount: result.diagnostics?.ownPostCount ?? null,
              candidateCount: result.quoteCandidates?.length ?? 0,
              videoCandidates: result.diagnostics?.videoCandidates ?? null,
              videoValidation: result.diagnostics?.videoValidation || null,
              retryCount: attempt - 1,
              finalStatus: "extracted",
              sessionProcessed: processedInSession
            });
            break;
          } catch (collectError) {
            lastCollectError = collectError;
            if (attempt >= 3 || !isRetryableError(collectError)) break;
            const retryMessage = collectError instanceof Error ? collectError.message : "取得を再試行します。";
            await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, stage: categoryFromError(collectError), message: `retry: ${retryMessage}`, lastError: retryMessage, retryCount: attempt, sessionProcessed: processedInSession });
            await prepareRetry(workerTabId, item).catch(() => undefined);
            await wait(2500);
          }
        }
        if (!result) throw lastCollectError || categorizedError(FAILURE_CATEGORY.UNKNOWN, "Xページから引用候補を取得できませんでした。");
        const payload = await sendPayload(settings, result);
        processedInSession += 1;
        await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, message: `保存しました: ${creatorName || item.creator_x_url}`, finalStatus: "success", lastCandidatesCount: payload.candidatesCount || 0, sessionProcessed: processedInSession });
        if (processedInSession > 0 && next.batchSize > 0 && processedInSession % next.batchSize === 0) await wait(60000);
        await wait(5000);
      } catch (error) {
        await markItemFailed(settings, next.jobId, item.id, error);
        processedInSession += 1;
        const message = error instanceof Error ? error.message : "取得に失敗しました";
        await setQuoteState({ status: "running", currentCreator: creatorName || item.creator_x_url, message: `skip: ${creatorName || item.creator_x_url}`, finalStatus: "failed", errorCode: categoryFromError(error), lastError: message, sessionProcessed: processedInSession });
        if (categoryFromError(error) === FAILURE_CATEGORY.LOGIN_OR_CHALLENGE || /認証|ログイン|challenge|captcha/i.test(message)) {
          await setQuoteState({ running: false, status: "stopped", message, lastError: message });
          return;
        }
        if (processedInSession > 0 && next.batchSize > 0 && processedInSession % next.batchSize === 0) await wait(60000);
        await wait(4000);
      }
    }
  } catch (error) {
    await setQuoteState({ running: false, status: "error", message: error instanceof Error ? error.message : "一括更新を実行できませんでした。", lastError: error instanceof Error ? error.message : String(error) });
  } finally {
    globalThis.myfansQuoteRefreshRunning = false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    const settings = message.settings || {};
    runBulkQuoteRefresh(settings);
    sendResponse({ ok: true, status: "accepted", workerVersion: WORKER_VERSION, jobId: settings.jobId || null });
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
