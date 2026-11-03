import { summarizeMyfansQuoteRefreshItems } from "../../../lib/myfansQuoteRefreshSummary";
import type { CompanionBridgeStatus, QuoteRefreshProgress, VisualQueueState } from "./MyfansWorkerPanelTypes";

type UnknownRecord = Record<string, unknown>;

export type CompanionPongDetail = {
  requestId?: string;
  connected?: boolean;
  extensionVersion?: unknown;
  worker?: { ok?: boolean; error?: string; version?: unknown; state?: unknown } | null;
};

export type QuoteRefreshRunMetric = { label: string; value: string; note?: string; valueClassName?: string };
type QuoteRefreshJob = NonNullable<QuoteRefreshProgress["job"]>;
type QuoteRefreshSummary = NonNullable<QuoteRefreshProgress["summary"]>;

const nonRetryableQuoteRefreshErrors = new Set(["LOGIN_OR_CHALLENGE", "PROFILE_NOT_FOUND/SUSPENDED", "SENSITIVE_CONTENT_GATE"]);

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function nonemptyString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function workerStatusFromDetail(detail: unknown) {
  const worker = asRecord(asRecord(detail)?.worker);
  if (!worker) return "idle";

  const state = asRecord(worker.state);
  if (!state) return worker.ok === false ? "unavailable" : "idle";

  const visualStatus = nonemptyString(state.visualStatus);
  if (visualStatus && visualStatus !== "idle") return `visual:${visualStatus}`;
  return nonemptyString(state.status) ?? (state.running ? "running" : "idle");
}

export function workerIdentityFromDetail(detail: unknown): CompanionBridgeStatus["identity"] {
  const worker = asRecord(asRecord(detail)?.worker);
  const state = asRecord(worker?.state);
  return asRecord(state?.identity) as CompanionBridgeStatus["identity"] ?? null;
}

export function projectCompanionPongDetail(
  detail: CompanionPongDetail,
  fallbackBridgeVersion: string | null,
  lastAckAt: string,
) {
  const worker = detail.worker;
  const connected = Boolean(detail.connected && worker?.ok);
  return {
    connected,
    error: worker?.error || "Companion bridgeの確認に失敗しました。",
    status: {
      scriptInjected: Boolean(detail.connected),
      runtimeConnected: connected,
      workerStatus: workerStatusFromDetail(detail),
      bridgeVersion: typeof detail.extensionVersion === "string" ? detail.extensionVersion : fallbackBridgeVersion,
      workerVersion: typeof worker?.version === "string" ? worker.version : null,
      lastAckAt,
      message: connected ? "connected" : worker?.error || "not connected",
      identity: workerIdentityFromDetail(detail),
    } satisfies CompanionBridgeStatus,
  };
}

export function projectCompanionBridgeEvent(
  detail: unknown,
  fallbackBridgeVersion: string | null,
  lastAckAt: string,
): CompanionBridgeStatus {
  const data = asRecord(detail);
  const worker = asRecord(data?.worker);
  const connected = Boolean(data?.connected);
  const runtimeConnected = Boolean(worker?.ok);
  return {
    scriptInjected: connected,
    runtimeConnected,
    workerStatus: workerStatusFromDetail(detail),
    bridgeVersion: typeof data?.extensionVersion === "string" ? data.extensionVersion : fallbackBridgeVersion,
    workerVersion: typeof worker?.version === "string" ? worker.version : null,
    lastAckAt,
    message: connected ? (runtimeConnected ? "connected" : "not connected") : "not injected",
  };
}

function countText(value: number | null | undefined, fallback = 0) {
  return String(value ?? fallback);
}

function systemSuccessRateMetric(successRate: number | null): QuoteRefreshRunMetric {
  return {
    label: "システム成功率",
    value: successRate === null ? "-" : `${successRate}%`,
    valueClassName: successRate !== null && successRate >= 80 ? "text-emerald-300" : "text-amber-300",
  };
}

function cursorCycleMetric(job: QuoteRefreshJob): QuoteRefreshRunMetric {
  const cycleStatus = job.cycle_completed ? " (完了)" : "";
  return {
    label: "巡回cursor / cycle",
    value: `${countText(job.cursor_after_order)} / ${countText(job.collection_cycle_no, 1)}${cycleStatus}`,
  };
}

export function buildQuoteRefreshRunMetrics(
  job: QuoteRefreshJob,
  summary: QuoteRefreshSummary,
  successRate: number | null,
): QuoteRefreshRunMetric[] {
  return [
    { label: "job / session / collector", value: `#${job.id} / ${job.collection_session_id} / ${job.collector_version}`, note: `${job.launch_mode ?? "new"} / identity一致` },
    { label: "状態", value: job.status },
    { label: "進捗", value: `${job.processed_creators} / ${job.total_creators}` },
    { label: "成功/要修正/blocked/skipped", value: `${summary.success} / ${summary.failed} / ${summary.blocked} / ${summary.skipped}` },
    { label: "collector / complete-thread", value: `${summary.success} / ${countText(summary.complete_threads_found ?? job.complete_threads_found)}` },
    systemSuccessRateMetric(successRate),
    cursorCycleMetric(job),
    { label: "complete thread / candidates", value: `${countText(job.complete_threads_found)} / ${countText(job.candidates_saved)}` },
    { label: "NO_MATCH / NO_POSTS / PRIVATE", value: `${countText(job.no_match)} / ${countText(job.excluded_no_posts)} / ${countText(job.excluded_private)}` },
    { label: "retryable errors", value: countText(job.retryable_errors) },
    { label: "profile scan / navigation / observed / fully observed", value: `${countText(summary.profile_scan_ok)} / ${countText(summary.status_navigation_attempted)} / ${countText(summary.status_threads_observed)} / ${countText(summary.fully_observed)}` },
  ];
}

export function quoteRefreshFailureLabel(error: string | null) {
  if (!error) return null;
  const match = error.match(/^([A-Z_/]+):\s*(.+)$/);
  const category = match?.[1] || "UNKNOWN";
  const detail = match?.[2] || error;
  return {
    category,
    detail,
    retryable: !nonRetryableQuoteRefreshErrors.has(category),
  };
}

export function isBlockedQuoteRefreshItem(item: QuoteRefreshProgress["items"][number]) {
  const failure = quoteRefreshFailureLabel(item.error);
  return Boolean(failure && !failure.retryable && (item.status === "failed" || item.status === "skipped"));
}

export function isQuoteRefreshRunCurrent(
  job: QuoteRefreshProgress["job"],
  identity: CompanionBridgeStatus["identity"],
  fallbackWorkerVersion: string | null,
) {
  return Boolean(
    job?.id
    && job.collection_session_id
    && job.collection_run_token
    && identity?.job_id === job.id
    && identity.collection_session_id === job.collection_session_id
    && identity.run_token === job.collection_run_token
    && identity.collector_version === (job.collector_version ?? fallbackWorkerVersion),
  );
}

function currentQuoteRefreshItem(progress: QuoteRefreshProgress | null, displayJob: QuoteRefreshProgress["job"]) {
  if (!displayJob || !["pending", "running", "paused"].includes(displayJob.status)) return null;
  return progress?.items.find((item) => item.status === "running") ?? null;
}

function recentQuoteRefreshItems(progress: QuoteRefreshProgress | null, hasCurrentRun: boolean) {
  if (!hasCurrentRun) return [];
  return progress?.items.filter((item) => ["success", "failed", "skipped"].includes(item.status)).slice(-5).reverse() ?? [];
}

function quoteRefreshSuccessRate(summary: NonNullable<QuoteRefreshProgress["summary"]>) {
  const denominator = summary.success + summary.failed;
  return denominator > 0 ? Math.round((summary.success / denominator) * 100) : null;
}

function retryableQuoteRefreshFailures(progress: QuoteRefreshProgress | null) {
  return progress?.items.filter((item) => item.status === "failed" && !isBlockedQuoteRefreshItem(item)) ?? [];
}

export function projectQuoteRefreshPanelState(progress: QuoteRefreshProgress | null, bridgeStatus: CompanionBridgeStatus) {
  const job = progress?.job ?? null;
  const displayJob = job && isQuoteRefreshRunCurrent(job, bridgeStatus.identity, bridgeStatus.workerVersion) ? job : null;
  const summary = progress?.summary ?? summarizeMyfansQuoteRefreshItems(progress?.items ?? []);
  return {
    job,
    displayJob,
    current: currentQuoteRefreshItem(progress, displayJob),
    recent: recentQuoteRefreshItems(progress, Boolean(displayJob)),
    summary,
    successRate: quoteRefreshSuccessRate(summary),
    failedItems: retryableQuoteRefreshFailures(progress),
  };
}

export function countVisualQueueItems(queue: VisualQueueState | null) {
  return (queue?.items ?? []).reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}
