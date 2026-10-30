import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuoteRefreshRunMetrics,
  countVisualQueueItems,
  isQuoteRefreshRunCurrent,
  projectCompanionBridgeEvent,
  projectCompanionPongDetail,
  projectQuoteRefreshPanelState,
  quoteRefreshFailureLabel,
  workerStatusFromDetail,
} from "./myfansWorkerPanelProjection.ts";
import type { CompanionBridgeStatus, QuoteRefreshProgress, VisualQueueState } from "./MyfansWorkerPanelTypes.ts";

const currentJob: NonNullable<QuoteRefreshProgress["job"]> = {
  id: 12,
  status: "running",
  total_creators: 20,
  processed_creators: 5,
  success_creators: 3,
  failed_creators: 2,
  batch_size: 5,
  collection_session_id: "session-1",
  collection_run_token: "run-1",
  collector_version: "v2",
  last_error: null,
};

const matchingIdentity: NonNullable<CompanionBridgeStatus["identity"]> = {
  job_id: 12,
  collection_session_id: "session-1",
  run_token: "run-1",
  collector_version: "v2",
};

test("quote refresh run is current only when job, session, token, and collector identity match", () => {
  assert.equal(isQuoteRefreshRunCurrent(currentJob, matchingIdentity, "v1"), true);
  assert.equal(isQuoteRefreshRunCurrent(currentJob, { ...matchingIdentity, run_token: "stale" }, "v2"), false);
  assert.equal(isQuoteRefreshRunCurrent({ ...currentJob, collection_session_id: null }, matchingIdentity, "v2"), false);
  assert.equal(isQuoteRefreshRunCurrent({ ...currentJob, collector_version: null }, { ...matchingIdentity, collector_version: "legacy-worker" }, "legacy-worker"), true);
});

test("quote refresh projection gates displayed run state and keeps only retryable failed items", () => {
  const items: QuoteRefreshProgress["items"] = [
    { id: 1, creator_x_url: "x/one", status: "success", attempts: 1, collected_count: 2, top_score: 10, error: null },
    { id: 2, creator_x_url: "x/two", status: "failed", attempts: 1, collected_count: 0, top_score: null, error: "LOGIN_OR_CHALLENGE: signed out" },
    { id: 3, creator_x_url: "x/three", status: "failed", attempts: 2, collected_count: 0, top_score: null, error: "NETWORK: timeout" },
    { id: 4, creator_x_url: "x/four", status: "skipped", attempts: 1, collected_count: 0, top_score: null, error: "SENSITIVE_CONTENT_GATE: hidden" },
    { id: 5, creator_x_url: "x/five", status: "running", attempts: 1, collected_count: 0, top_score: null, error: null },
  ];
  const progress: QuoteRefreshProgress = { job: currentJob, items };
  const bridge: CompanionBridgeStatus = {
    scriptInjected: true,
    runtimeConnected: true,
    workerStatus: "running",
    bridgeVersion: "v2",
    workerVersion: "v2",
    lastAckAt: null,
    message: "connected",
    identity: matchingIdentity,
  };

  const projection = projectQuoteRefreshPanelState(progress, bridge);
  assert.equal(projection.displayJob?.id, 12);
  assert.equal(projection.current?.id, 5);
  assert.deepEqual(projection.recent.map((item) => item.id), [4, 3, 2, 1]);
  assert.deepEqual(projection.failedItems.map((item) => item.id), [3]);
  assert.deepEqual(projection.summary, { processed: 4, success: 1, failed: 1, blocked: 2, skipped: 0 });
  assert.equal(projection.successRate, 50);

  const staleProjection = projectQuoteRefreshPanelState(progress, { ...bridge, identity: { ...matchingIdentity, collection_session_id: "wrong" } });
  assert.equal(staleProjection.displayJob, null);
  assert.equal(staleProjection.current, null);
  assert.deepEqual(staleProjection.recent, []);
});

test("failure labels retain retry classification and visual queue counts", () => {
  assert.deepEqual(quoteRefreshFailureLabel("PROFILE_NOT_FOUND/SUSPENDED: removed"), {
    category: "PROFILE_NOT_FOUND/SUSPENDED",
    detail: "removed",
    retryable: false,
  });
  const queue: VisualQueueState = { job: null, items: [{ status: "pending" }, { status: "pending" }, { status: "processing" }] };
  assert.deepEqual(countVisualQueueItems(queue), { pending: 2, processing: 1 });
  assert.deepEqual(countVisualQueueItems(null), {});
});

test("worker state projection handles malformed, unavailable, visual, and running states", () => {
  assert.equal(workerStatusFromDetail(null), "idle");
  assert.equal(workerStatusFromDetail({ worker: { ok: false } }), "unavailable");
  assert.equal(workerStatusFromDetail({ worker: { ok: true, state: { visualStatus: "verifying" } } }), "visual:verifying");
  assert.equal(workerStatusFromDetail({ worker: { state: { visualStatus: "idle", status: "scanning" } } }), "scanning");
  assert.equal(workerStatusFromDetail({ worker: { state: { running: true } } }), "running");
  assert.equal(workerStatusFromDetail({ worker: { state: { running: false } } }), "idle");
});

test("Companion pong and event projections preserve bridge status semantics", () => {
  const identity = { job_id: 12, collection_session_id: "session-1", run_token: "run-1", collector_version: "v2" };
  const pong = projectCompanionPongDetail({
    connected: true,
    extensionVersion: "bridge-v2",
    worker: { ok: true, version: "worker-v2", state: { status: "running", identity } },
  }, "fallback", "12:30:00");
  assert.equal(pong.connected, true);
  assert.equal(pong.error, "Companion bridgeの確認に失敗しました。");
  assert.deepEqual(pong.status, {
    scriptInjected: true,
    runtimeConnected: true,
    workerStatus: "running",
    bridgeVersion: "bridge-v2",
    workerVersion: "worker-v2",
    lastAckAt: "12:30:00",
    message: "connected",
    identity,
  });

  const disconnected = projectCompanionPongDetail({ connected: false, worker: { ok: false, error: "worker offline" } }, "fallback", "12:31:00");
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.error, "worker offline");
  assert.equal(disconnected.status.message, "worker offline");
  assert.equal(disconnected.status.bridgeVersion, "fallback");

  const event = projectCompanionBridgeEvent({ connected: true, worker: { ok: false, version: "worker-v1", state: { status: "idle" } } }, null, "12:32:00");
  assert.equal(event.scriptInjected, true);
  assert.equal(event.runtimeConnected, false);
  assert.equal(event.workerStatus, "idle");
  assert.equal(event.message, "not connected");
  assert.equal(event.lastAckAt, "12:32:00");
});

test("quote refresh metrics keep defaults, counters, cursor state, and success-rate colors", () => {
  const summary: NonNullable<QuoteRefreshProgress["summary"]> = {
    processed: 5,
    success: 4,
    failed: 1,
    blocked: 0,
    skipped: 0,
    profile_scan_ok: 3,
    status_navigation_attempted: 2,
    status_threads_observed: 6,
    fully_observed: 4,
  };
  const metrics = buildQuoteRefreshRunMetrics(currentJob, summary, 80);
  assert.equal(metrics.length, 11);
  assert.equal(metrics[0].note, "new / identity一致");
  assert.equal(metrics[4].value, "4 / 0");
  assert.deepEqual(metrics[5], { label: "システム成功率", value: "80%", valueClassName: "text-emerald-300" });
  assert.equal(metrics[6].value, "0 / 1");
  assert.equal(metrics[9].value, "0");
  assert.equal(metrics[10].value, "3 / 2 / 6 / 4");

  const lowRate = buildQuoteRefreshRunMetrics(currentJob, summary, 79)[5];
  assert.equal(lowRate.valueClassName, "text-amber-300");
  assert.equal(buildQuoteRefreshRunMetrics(currentJob, summary, null)[5].value, "-");
});
