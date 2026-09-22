(() => {
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);
const REQUEST_EVENT = "amateur-lab:myfans-quote-refresh:start";
const RESPONSE_EVENT = "amateur-lab:myfans-quote-refresh:ack";
const VISUAL_REQUEST_EVENT = "amateur-lab:myfans-visual-verification:start";
const VISUAL_RESPONSE_EVENT = "amateur-lab:myfans-visual-verification:ack";
const READY_EVENT = "amateur-lab:myfans-quote-refresh:bridge-ready";
const PING_EVENT = "amateur-lab:myfans-quote-refresh:ping";
const PONG_EVENT = "amateur-lab:myfans-quote-refresh:pong";
const DIAGNOSTIC_REQUEST_EVENT = "amateur-lab:myfans-diagnostic:start";
const DIAGNOSTIC_RESPONSE_EVENT = "amateur-lab:myfans-diagnostic:ack";
const DIAGNOSTIC_STATE_REQUEST_EVENT = "amateur-lab:myfans-diagnostic:state";
const DIAGNOSTIC_STATE_RESPONSE_EVENT = "amateur-lab:myfans-diagnostic:state:ack";
const SINGLE_STATUS_STATE_REQUEST_EVENT = "amateur-lab:myfans-single-status:state";
const SINGLE_STATUS_STATE_RESPONSE_EVENT = "amateur-lab:myfans-single-status:state:ack";
const BRIDGE_DIAGNOSTIC_VERSION = chrome.runtime.getManifest().version;
let bridgeDisconnected = false;
let bridgeDisconnectReported = false;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "extension runtime unavailable");
}

function isInvalidatedContext(error) {
  return /extension context invalidated|context invalidated/i.test(errorMessage(error));
}

function markBridgeDisconnected(error) {
  bridgeDisconnected = true;
  document.documentElement.dataset.myfansCompanionBridge = "disconnected";
  document.documentElement.dataset.myfansCompanionBridgeStatus = "stale";
  if (!bridgeDisconnectReported) {
    bridgeDisconnectReported = true;
    console.debug("[myfans companion bridge] runtime disconnected; waiting for page reload", { error: errorMessage(error) });
  }
}

function disconnectedDetail(error) {
  const message = errorMessage(error);
  if (isInvalidatedContext(error)) markBridgeDisconnected(error);
  return { ok: false, error: message, bridgeDisconnected: true };
}

function readExtensionVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch (error) {
    markBridgeDisconnected(error);
    return "unknown";
  }
}

const extensionVersion = readExtensionVersion();

function isAllowedPage() {
  return window.location.protocol === "http:" && ALLOWED_HOSTS.has(window.location.hostname) && window.location.pathname.startsWith("/admin/myfans");
}

function dispatchPageEvent(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

if (!isAllowedPage()) {
  console.debug("[myfans companion bridge] skipped", { url: window.location.href });
} else if (bridgeDisconnected) {
  console.debug("[myfans companion bridge] skipped because the extension context is stale");
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
    cleanup: window.__MYFANS_COMPANION_BRIDGE_CLEANUP__,
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

function sendRuntimeMessage(message, onResponse) {
  if (bridgeDisconnected) {
    onResponse(disconnectedDetail("extension context is stale; reload the Daily Page"));
    return;
  }

  let settled = false;
  const complete = (response) => {
    if (settled) return;
    settled = true;
    onResponse(response);
  };

  try {
    const pending = chrome.runtime.sendMessage(message, (response) => {
      let lastError = null;
      try {
        lastError = chrome.runtime.lastError;
      } catch (error) {
        complete(disconnectedDetail(error));
        return;
      }
      if (lastError) {
        complete(disconnectedDetail(lastError.message));
        return;
      }
      complete(response || { ok: false, error: "extension runtime did not respond" });
    });
    if (pending && typeof pending.catch === "function") {
      pending.catch((error) => complete(disconnectedDetail(error)));
    }
  } catch (error) {
    complete(disconnectedDetail(error));
  }
}

function getWorkerState() {
  return new Promise((resolve) => {
    console.debug("[myfans companion bridge] CONTENT_RUNTIME_SEND", { type: "myfans_quote_refresh_ping" });
    sendRuntimeMessage(
      { type: "myfans_quote_refresh_ping", source: "admin_bridge", bridgeVersion: BRIDGE_DIAGNOSTIC_VERSION },
      (response) => {
        console.debug("[myfans companion bridge] CONTENT_RUNTIME_ACK", response);
        resolve(response);
      }
    );
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
  sendRuntimeMessage(
    {
      type: "myfans_quote_refresh_start",
      source: "admin_bridge",
      settings: {
        baseUrl: window.location.origin,
        approvedMediaId: detail.approvedMediaId || null,
        approvedMediaName: detail.approvedMediaName || "@lumi_reviw",
        jobId,
        collectionSessionId: detail.collectionSessionId || null,
        runToken: detail.runToken || null,
        collectorVersion: detail.collectorVersion || extensionVersion
      }
    },
    (response) => {
      const detail = response || { ok: false, error: "拡張機能から応答がありません。" };
      console.debug("[myfans companion bridge] ack", detail);
      dispatchPageEvent(RESPONSE_EVENT, detail);
    }
  );
}

function startVisualFromDetail(rawDetail) {
  const detail = rawDetail || {};
  console.debug("[myfans companion bridge] visual start received", { origin: window.location.origin, detail });
  sendRuntimeMessage(
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
      const ack = response || { ok: false, error: "拡張機能から応答がありません。" };
      console.debug("[myfans companion bridge] visual ack", ack);
      dispatchPageEvent(VISUAL_RESPONSE_EVENT, ack);
    }
  );
}

function startDiagnosticFromDetail(rawDetail) {
  const detail = rawDetail || {};
  const statusUrl = String(detail.statusUrl || "").trim().replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
  if (!/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/i.test(statusUrl)) {
    dispatchPageEvent(DIAGNOSTIC_RESPONSE_EVENT, { ok: false, error: "診断対象はx.comの正規status URLを指定してください。" });
    return;
  }
  const diagnosticRunId = String(detail.diagnosticRunId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  sendRuntimeMessage({
    type: "myfans_diagnostic_status_start",
    source: "admin_bridge",
    settings: {
      baseUrl: window.location.origin,
      approvedMediaId: detail.approvedMediaId || null,
      approvedMediaName: detail.approvedMediaName || "@lumi_reviw",
      sourceStatusUrl: statusUrl,
      diagnosticRunId,
      diagnosticMode: true,
    },
  }, (response) => {
    dispatchPageEvent(DIAGNOSTIC_RESPONSE_EVENT, response || { ok: false, error: "Companionから応答がありません。" });
  });
}

function requestDiagnosticState(rawDetail) {
  const requestId = rawDetail?.requestId || null;
  sendRuntimeMessage({ type: "myfans_diagnostic_status_state", source: "admin_bridge" }, (response) => {
    dispatchPageEvent(DIAGNOSTIC_STATE_RESPONSE_EVENT, { requestId, ...(response || { ok: false, error: "状態を取得できません。" }) });
  });
}

function requestSingleStatusState(rawDetail) {
  const requestId = rawDetail?.requestId || null;
  sendRuntimeMessage({ type: "myfans_single_status_collect_state", source: "admin_bridge" }, (response) => {
    dispatchPageEvent(SINGLE_STATUS_STATE_RESPONSE_EVENT, { requestId, ...(response || { ok: false, error: "状態を取得できません。" }) });
  });
}

const requestHandler = (event) => {
  startFromDetail(event instanceof CustomEvent ? event.detail || {} : {});
};
const visualRequestHandler = (event) => {
  startVisualFromDetail(event instanceof CustomEvent ? event.detail || {} : {});
};
const diagnosticRequestHandler = (event) => {
  startDiagnosticFromDetail(event instanceof CustomEvent ? event.detail || {} : {});
};
const diagnosticStateRequestHandler = (event) => {
  requestDiagnosticState(event instanceof CustomEvent ? event.detail || {} : {});
};
const singleStatusStateRequestHandler = (event) => {
  requestSingleStatusState(event instanceof CustomEvent ? event.detail || {} : {});
};

const pingHandler = async (event) => {
  if (bridgeDisconnected) return;
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
window.addEventListener(DIAGNOSTIC_REQUEST_EVENT, diagnosticRequestHandler);
window.addEventListener(DIAGNOSTIC_STATE_REQUEST_EVENT, diagnosticStateRequestHandler);
window.addEventListener(SINGLE_STATUS_STATE_REQUEST_EVENT, singleStatusStateRequestHandler);
window.addEventListener(PING_EVENT, pingHandler);
window.__MYFANS_COMPANION_BRIDGE_CLEANUP__ = () => {
  window.removeEventListener(REQUEST_EVENT, requestHandler);
  window.removeEventListener(VISUAL_REQUEST_EVENT, visualRequestHandler);
  window.removeEventListener(DIAGNOSTIC_REQUEST_EVENT, diagnosticRequestHandler);
  window.removeEventListener(DIAGNOSTIC_STATE_REQUEST_EVENT, diagnosticStateRequestHandler);
  window.removeEventListener(SINGLE_STATUS_STATE_REQUEST_EVENT, singleStatusStateRequestHandler);
  window.removeEventListener(PING_EVENT, pingHandler);
};

announceReady({ cleanup: window.__MYFANS_COMPANION_BRIDGE_CLEANUP__ });
}
}
})();
