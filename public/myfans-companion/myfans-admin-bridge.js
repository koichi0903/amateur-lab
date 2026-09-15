(() => {
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);
const REQUEST_EVENT = "amateur-lab:myfans-quote-refresh:start";
const RESPONSE_EVENT = "amateur-lab:myfans-quote-refresh:ack";
const VISUAL_REQUEST_EVENT = "amateur-lab:myfans-visual-verification:start";
const VISUAL_RESPONSE_EVENT = "amateur-lab:myfans-visual-verification:ack";
const READY_EVENT = "amateur-lab:myfans-quote-refresh:bridge-ready";
const PING_EVENT = "amateur-lab:myfans-quote-refresh:ping";
const PONG_EVENT = "amateur-lab:myfans-quote-refresh:pong";
const BRIDGE_DIAGNOSTIC_VERSION = "0.1.5";
const extensionVersion = chrome.runtime.getManifest().version;

function isAllowedPage() {
  return window.location.protocol === "http:" && ALLOWED_HOSTS.has(window.location.hostname) && window.location.pathname.startsWith("/admin/myfans");
}

function dispatchPageEvent(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

if (!isAllowedPage()) {
  console.debug("[myfans companion bridge] skipped", { url: window.location.href });
} else {
const existingBridge = window.__MYFANS_COMPANION_BRIDGE__;
if (existingBridge?.listenerVersion === BRIDGE_DIAGNOSTIC_VERSION && existingBridge?.cleanup) {
  document.documentElement.dataset.myfansCompanionBridge = "connected";
  document.documentElement.dataset.myfansCompanionBridgeAt = existingBridge.at || new Date().toISOString();
  document.documentElement.dataset.myfansCompanionBridgeVersion = existingBridge.extensionVersion || extensionVersion;
  document.documentElement.dataset.myfansCompanionBridgeDiagnosticVersion = existingBridge.bridgeVersion || BRIDGE_DIAGNOSTIC_VERSION;
  console.debug("[myfans companion bridge] already active", { version: BRIDGE_DIAGNOSTIC_VERSION });
} else {
if (existingBridge?.cleanup) existingBridge.cleanup();

function ensureBridgeMeta(content) {
  const writeMeta = () => {
    let meta = document.querySelector('meta[name="myfans-companion-bridge"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "myfans-companion-bridge");
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute("content", content);
  };
  if (document.head) writeMeta();
  else document.addEventListener("DOMContentLoaded", writeMeta, { once: true });
}

function writeBridgeMarker(extra = {}) {
  const marker = {
    connected: true,
    url: window.location.href,
    origin: window.location.origin,
    extensionVersion,
    bridgeVersion: BRIDGE_DIAGNOSTIC_VERSION,
    at: new Date().toISOString(),
    listenerVersion: BRIDGE_DIAGNOSTIC_VERSION,
    cleanup: window.__MYFANS_COMPANION_BRIDGE__?.cleanup,
    ...extra
  };
  document.documentElement.dataset.myfansCompanionBridge = "connected";
  document.documentElement.dataset.myfansCompanionBridgeAt = marker.at;
  document.documentElement.dataset.myfansCompanionBridgeVersion = extensionVersion;
  document.documentElement.dataset.myfansCompanionBridgeDiagnosticVersion = BRIDGE_DIAGNOSTIC_VERSION;
  window.__MYFANS_COMPANION_BRIDGE__ = marker;
  ensureBridgeMeta(`${extensionVersion}:${BRIDGE_DIAGNOSTIC_VERSION}`);
  console.debug("[myfans companion bridge] ready", marker);
  return marker;
}

writeBridgeMarker({ phase: "top-level" });

function bridgeReadyDetail(extra = {}) {
  return {
    ok: true,
    connected: true,
    url: window.location.href,
    origin: window.location.origin,
    extensionVersion,
    bridgeVersion: BRIDGE_DIAGNOSTIC_VERSION,
    at: new Date().toISOString(),
    ...extra
  };
}

function announceReady(extra) {
  writeBridgeMarker(extra);
  dispatchPageEvent(READY_EVENT, bridgeReadyDetail(extra));
}

async function getWorkerState() {
  return await new Promise((resolve) => {
    console.debug("[myfans companion bridge] CONTENT_RUNTIME_SEND", { type: "myfans_quote_refresh_ping" });
    chrome.runtime.sendMessage({ type: "myfans_quote_refresh_ping", source: "admin_bridge", bridgeVersion: BRIDGE_DIAGNOSTIC_VERSION }, (response) => {
      const lastError = chrome.runtime.lastError;
      const detail = lastError ? { ok: false, error: lastError.message } : response || { ok: false, error: "state unavailable" };
      console.debug("[myfans companion bridge] CONTENT_RUNTIME_ACK", detail);
      resolve(detail);
    });
  });
}

function startFromDetail(rawDetail) {
  const detail = rawDetail || {};
  const jobId = Number(detail.jobId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    dispatchPageEvent(RESPONSE_EVENT, { ok: false, error: "jobIdが不正です。" });
    return;
  }

  console.debug("[myfans companion bridge] start received", { jobId, origin: window.location.origin });
  chrome.runtime.sendMessage(
    {
      type: "myfans_quote_refresh_start",
      source: "admin_bridge",
      settings: {
        baseUrl: window.location.origin,
        approvedMediaId: detail.approvedMediaId || null,
        approvedMediaName: detail.approvedMediaName || "@lumi_reviw",
        jobId
      }
    },
    (response) => {
      const lastError = chrome.runtime.lastError;
      const detail = lastError ? { ok: false, error: lastError.message } : response || { ok: false, error: "拡張機能から応答がありません。" };
      console.debug("[myfans companion bridge] ack", detail);
      dispatchPageEvent(RESPONSE_EVENT, detail);
    }
  );
}

function startVisualFromDetail(rawDetail) {
  const detail = rawDetail || {};
  console.debug("[myfans companion bridge] visual start received", { origin: window.location.origin, detail });
  chrome.runtime.sendMessage(
    {
      type: "myfans_visual_verification_start",
      source: "admin_bridge",
      settings: {
        baseUrl: window.location.origin,
        approvedMediaId: detail.approvedMediaId || null,
        approvedMediaName: detail.approvedMediaName || "@lumi_reviw",
        batchSize: detail.batchSize || detail.limit || 10
      }
    },
    (response) => {
      const lastError = chrome.runtime.lastError;
      const ack = lastError ? { ok: false, error: lastError.message } : response || { ok: false, error: "拡張機能から応答がありません。" };
      console.debug("[myfans companion bridge] visual ack", ack);
      dispatchPageEvent(VISUAL_RESPONSE_EVENT, ack);
    }
  );
}

const requestHandler = (event) => {
  startFromDetail(event instanceof CustomEvent ? event.detail || {} : {});
};
const visualRequestHandler = (event) => {
  startVisualFromDetail(event instanceof CustomEvent ? event.detail || {} : {});
};

const pingHandler = async (event) => {
  const requestId = event instanceof CustomEvent ? event.detail?.requestId : null;
  console.debug("[myfans companion bridge] CONTENT_PING_RECEIVED", { requestId });
  writeBridgeMarker({ lastPingAt: new Date().toISOString() });
  const worker = await getWorkerState();
  const lastAck = new Date().toISOString();
  console.debug("[myfans companion bridge] CONTENT_PONG_SENT", { requestId, worker });
  dispatchPageEvent(PONG_EVENT, bridgeReadyDetail({ requestId, worker, lastAck }));
  announceReady({ worker, lastAck });
};

window.addEventListener(REQUEST_EVENT, requestHandler);
window.addEventListener(VISUAL_REQUEST_EVENT, visualRequestHandler);
window.addEventListener(PING_EVENT, pingHandler);
window.__MYFANS_COMPANION_BRIDGE_CLEANUP__ = () => {
  window.removeEventListener(REQUEST_EVENT, requestHandler);
  window.removeEventListener(VISUAL_REQUEST_EVENT, visualRequestHandler);
  window.removeEventListener(PING_EVENT, pingHandler);
};

announceReady({ cleanup: window.__MYFANS_COMPANION_BRIDGE_CLEANUP__ });
}
}
})();
