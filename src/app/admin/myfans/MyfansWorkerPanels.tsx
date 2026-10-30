"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, LoaderCircle, Save } from "lucide-react";
import type { Message } from "./MyfansFormPrimitives";
import { inputClass, StatusMessage } from "./MyfansFormPrimitives";
import type { CompanionBridgeStatus, QuoteRefreshProgress, VisualQueueState, VisualVerificationProgress } from "./MyfansWorkerPanelTypes";
import {
  buildQuoteRefreshRunMetrics,
  countVisualQueueItems,
  projectCompanionBridgeEvent,
  projectCompanionPongDetail,
  projectQuoteRefreshPanelState,
  quoteRefreshFailureLabel,
  type CompanionPongDetail,
} from "./myfansWorkerPanelProjection";

const READY_EVENT = "amateur-lab:myfans-quote-refresh:bridge-ready";
const PING_EVENT = "amateur-lab:myfans-quote-refresh:ping";
const PONG_EVENT = "amateur-lab:myfans-quote-refresh:pong";
const VISUAL_REQUEST_EVENT = "amateur-lab:myfans-visual-verification:start";
const VISUAL_RESPONSE_EVENT = "amateur-lab:myfans-visual-verification:ack";

function applyCompanionPongDetail(
  detail: CompanionPongDetail,
  setBridgeStatus: (status: CompanionBridgeStatus) => void,
  resolve: () => void,
  reject: (error: Error) => void,
) {
  const projection = projectCompanionPongDetail(
    detail,
    document.documentElement.dataset.myfansCompanionBridgeVersion || null,
    new Date().toLocaleTimeString("ja-JP", { hour12: false }),
  );
  setBridgeStatus(projection.status);
  if (projection.connected) resolve();
  else reject(new Error(projection.error));
}


function creatorNameFromItem(item: QuoteRefreshProgress["items"][number]) {
  const relation = Array.isArray(item.myfans_creators) ? item.myfans_creators[0] : item.myfans_creators;
  return relation?.display_name || item.creator_x_url;
}

export function QuoteRefreshBatchPanel({ approvedMediaId }: { approvedMediaId: number | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<QuoteRefreshProgress | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [batchSize, setBatchSize] = useState(5);
  const [visualBatchSize, setVisualBatchSize] = useState(10);
  const [visualProgress, setVisualProgress] = useState<VisualVerificationProgress | null>(null);
  const [visualQueue, setVisualQueue] = useState<VisualQueueState | null>(null);
  const visualQueueRequestInFlight = useRef(false);
  const [bridgeStatus, setBridgeStatus] = useState<CompanionBridgeStatus>({
    scriptInjected: false,
    runtimeConnected: false,
    workerStatus: "unknown",
    bridgeVersion: null,
    workerVersion: null,
    lastAckAt: null,
    message: "not injected",
    identity: null,
  });

  const loadProgress = useCallback(async (jobId?: number) => {
    const query = new URLSearchParams();
    if (jobId) query.set("jobId", String(jobId));
    else if (approvedMediaId) query.set("approvedMediaId", String(approvedMediaId));
    const response = await fetch(`/api/admin/myfans/quote-refresh?${query.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as QuoteRefreshProgress;
    if (!response.ok) throw new Error(payload.error ?? "進捗取得に失敗しました。");
    setProgress(payload);
    return payload;
  }, [approvedMediaId]);

  async function request(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/myfans/quote-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, approvedMediaId }),
    });
    const payload = (await response.json()) as QuoteRefreshProgress;
    if (!response.ok) throw new Error(payload.error ?? "更新キュー操作に失敗しました。");
    setProgress(payload);
    return payload;
  }

  function pingCompanionBridge() {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("ブラウザで実行してください。"));
        return;
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener(PONG_EVENT, onPong);
        const marker = document.documentElement.dataset.myfansCompanionBridge;
        const version = document.documentElement.dataset.myfansCompanionBridgeVersion || null;
        setBridgeStatus((current) => ({ ...current, scriptInjected: marker === "connected", runtimeConnected: false, bridgeVersion: version, message: marker === "connected" ? "pong timeout" : "not injected" }));
        reject(new Error(marker === "connected" ? "Companion bridgeは注入されていますが、background worker確認が返りません。" : "Companion bridgeを再接続中です。数秒後にもう一度開始してください。"));
      }, 4000);
      const onPong = (event: Event) => {
        const detail = event instanceof CustomEvent ? event.detail as CompanionPongDetail : null;
        if (detail?.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener(PONG_EVENT, onPong);
        applyCompanionPongDetail(detail, setBridgeStatus, resolve, reject);
      };
      window.addEventListener(PONG_EVENT, onPong);
      console.debug("[myfans daily page] PAGE_PING_SENT", { requestId });
      window.dispatchEvent(new CustomEvent(PING_EVENT, { detail: { requestId } }));
    });
  }

  async function refreshProgressOnly() {
    setPending(true);
    setMessage(null);
    try {
      const payload = await loadProgress();
      setMessage({ text: payload.job?.id ? "最新の進捗を読み込みました。Daily Pageから開始できます。" : "実行中の更新キューはありません。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "進捗を取得できませんでした。", error: true });
    } finally {
      setPending(false);
    }
  }

  async function startVisualCompanion() {
    await pingCompanionBridge();
    const ack = await new Promise<{ ok?: boolean; error?: string; status?: string; workerVersion?: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener(VISUAL_RESPONSE_EVENT, onAck);
          reject(new Error("Companion backgroundから開始応答がありません。"));
        }, 5000);
        const onAck = (event: Event) => {
          const detail = event instanceof CustomEvent ? event.detail : null;
          window.clearTimeout(timeout);
          window.removeEventListener(VISUAL_RESPONSE_EVENT, onAck);
          resolve(detail || {});
        };
        window.addEventListener(VISUAL_RESPONSE_EVENT, onAck);
        window.dispatchEvent(new CustomEvent(VISUAL_REQUEST_EVENT, {
          detail: {
            approvedMediaId,
            approvedMediaName: "",
          batchSize: Math.min(5, visualBatchSize),
          },
        }));
    });
    if (!ack.ok) throw new Error(ack.error ?? "Companionでvisual候補分析を開始できませんでした。");
    setVisualProgress({ checked: 0, verified: 0, partial: 0, unavailable: 0 });
    setMessage({ text: `ログイン済みChromeでvisual分析を開始しました。worker ${ack.workerVersion ?? "-"}`, error: false });
  }

  async function runVisualVerification() {
    setPending(true);
    setMessage(null);
    try {
      const queueResponse = await fetch("/api/admin/myfans/visual-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "queue_status", approvedMediaId, batchSize: visualBatchSize }), cache: "no-store" });
      const queuePayload = (await queueResponse.json()) as VisualQueueState & { error?: string };
      if (!queueResponse.ok) throw new Error(queuePayload.error ?? "visual確認キューを作成できませんでした。");
      setVisualQueue(queuePayload);
      if (["paused", "cancelled", "completed"].includes(queuePayload.job?.status ?? "")) throw new Error(`visual確認キューは${queuePayload.job?.status}です。状態を確認してから再開してください。`);
      await startVisualCompanion();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "visual候補分析に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  const loadVisualQueue = useCallback(async () => {
    if (visualQueueRequestInFlight.current) return null;
    visualQueueRequestInFlight.current = true;
    try {
      const response = await fetch("/api/admin/myfans/visual-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "queue_status", approvedMediaId, batchSize: visualBatchSize }), cache: "no-store" });
      const payload = (await response.json()) as VisualQueueState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "visual確認キューを読み込めませんでした。");
      setVisualQueue(payload);
      return payload;
    } finally {
      visualQueueRequestInFlight.current = false;
    }
  }, [approvedMediaId, visualBatchSize]);

  async function controlVisualQueue(queueAction: "pause" | "resume" | "cancel") {
    if (!visualQueue?.job?.id) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/myfans/visual-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "queue_control", jobId: visualQueue.job.id, queueAction }), cache: "no-store" });
      const payload = (await response.json()) as { job?: VisualQueueState["job"]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "visual確認キューを操作できませんでした。");
      setVisualQueue((current) => current ? { ...current, job: payload.job ?? current.job } : current);
      setMessage({ text: queueAction === "pause" ? "visual確認キューを一時停止しました。" : queueAction === "resume" ? "visual確認キューを再開しました。" : "visual確認キューを停止しました。", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "visual確認キューの操作に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  async function resumeVisualQueue() {
    if (!visualQueue?.job?.id) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans/visual-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "queue_control", jobId: visualQueue.job.id, queueAction: "resume" }), cache: "no-store" });
      const payload = (await response.json()) as { job?: VisualQueueState["job"]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "visual確認キューを再開できませんでした。");
      setVisualQueue((current) => current ? { ...current, job: payload.job ?? current.job } : current);
      await startVisualCompanion();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "visual確認キューの再開に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  async function control(action: "pause" | "resume" | "cancel") {
    if (!progress?.job?.id) return;
    setPending(true);
    try {
      await request({ action, jobId: progress.job.id });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "操作に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  const panelState = projectQuoteRefreshPanelState(progress, bridgeStatus);
  const { job, displayJob, current, recent, summary, successRate, failedItems } = panelState;
  const visualCounts = countVisualQueueItems(visualQueue);
  const visualProcessing = visualCounts.processing ?? 0;
  const visualPending = visualCounts.pending ?? 0;

  useEffect(() => {
    loadProgress().catch(() => {});
    loadVisualQueue().catch(() => {});
  }, [loadProgress, loadVisualQueue]);

  useEffect(() => {
    if (!visualQueue?.job?.id || !["pending", "running", "paused"].includes(visualQueue.job.status)) return;
    const timer = window.setInterval(() => loadVisualQueue().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [loadVisualQueue, visualQueue?.job?.id, visualQueue?.job?.status]);

  useEffect(() => {
    const markFromDom = () => {
      const marker = document.documentElement.dataset.myfansCompanionBridge;
      const bridge = (window as typeof window & { __MYFANS_COMPANION_BRIDGE__?: { at?: string; extensionVersion?: string } }).__MYFANS_COMPANION_BRIDGE__;
      const bridgeVersion = document.documentElement.dataset.myfansCompanionBridgeVersion || bridge?.extensionVersion || null;
      if (marker === "connected" || bridge) {
        setBridgeStatus((current) => ({
          ...current,
          scriptInjected: true,
          bridgeVersion,
          lastAckAt: bridge?.at ? new Date(bridge.at).toLocaleTimeString("ja-JP", { hour12: false }) : current.lastAckAt,
          message: "connected",
        }));
        return true;
      }
      return false;
    };
    const onBridgeStatus = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      setBridgeStatus(projectCompanionBridgeEvent(
        detail,
        null,
        new Date().toLocaleTimeString("ja-JP", { hour12: false }),
      ));
    };
    window.addEventListener(READY_EVENT, onBridgeStatus);
    window.addEventListener(PONG_EVENT, onBridgeStatus);
    markFromDom();
    console.debug("[myfans daily page] PAGE_PING_SENT", { requestId: "mount" });
    window.dispatchEvent(new CustomEvent(PING_EVENT, { detail: { requestId: "mount" } }));
    const pingTimer = window.setInterval(() => {
      pingCompanionBridge().catch(() => setBridgeStatus((current) => ({ ...current, message: "bridge再接続を試行中" })));
    }, 5000);
    const timers = [250, 1000, 2500].map((ms) => window.setTimeout(markFromDom, ms));
    return () => {
      window.removeEventListener(READY_EVENT, onBridgeStatus);
      window.removeEventListener(PONG_EVENT, onBridgeStatus);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(pingTimer);
    };
  }, []);

  useEffect(() => {
    if (!job?.id || !["pending", "running", "paused"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      loadProgress(job.id)
        .then((payload) => {
          if (payload.job?.status === "completed") router.refresh();
        })
        .catch((error) => setMessage({ text: error instanceof Error ? error.message : "進捗取得に失敗しました。", error: true }));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, loadProgress, router]);

  return (
    <div className="mt-5 rounded-lg border border-violet-700 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-white">一括引用候補更新</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Daily PageからMyfans Companionを起動し、ログイン済みChromeの作業タブを使って巡回します。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className={inputClass}>
            <option value={10}>次の10アカウント</option>
            <option value={5}>次のrotation batch（最大5・低負荷）</option>
          </select>
          <button type="button" onClick={refreshProgressOnly} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
            {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
            進捗を更新
          </button>
        </div>
      </div>
      <VisualVerificationPanel
        batchSize={visualBatchSize}
        onBatchSizeChange={setVisualBatchSize}
        pending={pending}
        onRun={runVisualVerification}
        progress={visualProgress}
        queue={visualQueue}
        processing={visualProcessing}
        waiting={visualPending}
        onPause={() => controlVisualQueue("pause")}
        onResume={resumeVisualQueue}
        onCancel={() => controlVisualQueue("cancel")}
        workerStatus={bridgeStatus.workerStatus}
      />
      <StatusMessage message={message} />
      <QuoteRefreshRunSections
        bridgeStatus={bridgeStatus}
        job={job}
        displayJob={displayJob}
        summary={summary}
        successRate={successRate}
        current={current}
        recent={recent}
        failedItems={failedItems}
        pending={pending}
        onControl={control}
      />
    </div>
  );
}

function VisualVerificationPanel({
  batchSize,
  onBatchSizeChange,
  pending,
  onRun,
  progress,
  queue,
  processing,
  waiting,
  onPause,
  onResume,
  onCancel,
  workerStatus,
}: {
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
  pending: boolean;
  onRun: () => void;
  progress: VisualVerificationProgress | null;
  queue: VisualQueueState | null;
  processing: number;
  waiting: number;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  workerStatus: string;
}) {
  return (
    <div className="mt-4 rounded-lg border border-cyan-800 bg-cyan-950/20 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-cyan-100">visual候補を追加分析</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Daily PageからCompanionを起動し、ログイン済みChromeのXタブで実画像/実動画の表示状態を確認して保存します。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={batchSize} onChange={(event) => onBatchSizeChange(Number(event.target.value))} className={inputClass}>
            <option value={5}>5件</option>
          </select>
          <button type="button" onClick={onRun} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
            {pending ? <LoaderCircle size={17} className="animate-spin" /> : <ImageIcon size={17} />}
            追加分析
          </button>
        </div>
      </div>
      {progress && (
        <p className="mt-2 text-xs font-bold text-cyan-100">
          checked {progress.checked} / verified {progress.verified} / partial {progress.partial} / unavailable {progress.unavailable}
        </p>
      )}
      {queue?.job && (
        <div className="mt-3 rounded-md border border-cyan-900 bg-zinc-950 p-3 text-xs leading-5 text-cyan-100">
          <p className="font-black">Visual確認キュー #{queue.job.id} / {queue.job.status} / analyzer {queue.job.analyzer_version ?? "-"}</p>
          <p>処理済み{queue.job.processed_sources} / 全{queue.job.total_sources} ・ verified {queue.job.verified_count} ・ partial {queue.job.partial_count} ・ unavailable {queue.job.unavailable_count}</p>
          <p className="mt-1 font-black text-cyan-50">処理中{processing} ・ 待機{waiting} ・ 今回最大5件 ・ 5件終了後に自動停止</p>
          {queue.job.stopped_reason && <p className="text-amber-200">停止理由: {queue.job.stopped_reason}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onPause} disabled={pending || queue.job.status !== "running"} className="h-8 rounded-md bg-amber-700 px-3 font-black text-white disabled:opacity-50">一時停止</button>
            {queue.job.status === "paused" && <button type="button" onClick={onResume} disabled={pending} className="h-10 rounded-md bg-emerald-500 px-4 font-black text-zinc-950 shadow-lg shadow-emerald-950/40 disabled:cursor-wait disabled:opacity-50">{pending ? "開始中…" : "5件だけ再開"}</button>}
            <button type="button" onClick={onCancel} disabled={pending || ["completed", "cancelled"].includes(queue.job.status)} className="h-8 rounded-md bg-red-700 px-3 font-black text-white disabled:opacity-50">停止</button>
          </div>
        </div>
      )}
      {["running", "done", "error"].includes(workerStatus) && (
        <p className="mt-2 text-xs leading-5 text-cyan-100">
          quote worker: {workerStatus} / visual progressは下のworker stateに反映されます。完了後にページを更新してください。
        </p>
      )}
    </div>
  );
}

type QuoteRefreshItem = QuoteRefreshProgress["items"][number];
type QuoteRefreshSummary = NonNullable<QuoteRefreshProgress["summary"]>;

function QuoteRefreshRunSections({
  bridgeStatus,
  job,
  displayJob,
  summary,
  successRate,
  current,
  recent,
  failedItems,
  pending,
  onControl,
}: {
  bridgeStatus: CompanionBridgeStatus;
  job: QuoteRefreshProgress["job"];
  displayJob: QuoteRefreshProgress["job"];
  summary: QuoteRefreshSummary;
  successRate: number | null;
  current: QuoteRefreshItem | null;
  recent: QuoteRefreshItem[];
  failedItems: QuoteRefreshItem[];
  pending: boolean;
  onControl: (action: "pause" | "resume" | "cancel") => Promise<void>;
}) {
  return (
    <>
      <QuoteRefreshBridgeStatus bridgeStatus={bridgeStatus} job={job} displayJob={displayJob} />
      <QuoteRefreshRunMetrics displayJob={displayJob} summary={summary} successRate={successRate} current={current} pending={pending} onControl={onControl} />
      <QuoteRefreshItemHistory recent={recent} failedItems={failedItems} />
    </>
  );
}

function QuoteRefreshBridgeStatus({ bridgeStatus, job, displayJob }: {
  bridgeStatus: CompanionBridgeStatus;
  job: QuoteRefreshProgress["job"];
  displayJob: QuoteRefreshProgress["job"];
}) {
  return (
    <>
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">
        bridge script: {bridgeStatus.scriptInjected ? "injected" : "not injected"} / runtime: {bridgeStatus.runtimeConnected ? "connected" : "not connected"} / bridge version: {bridgeStatus.bridgeVersion ?? "-"} / worker: {bridgeStatus.workerStatus} / worker version: {bridgeStatus.workerVersion ?? "-"} / version source: extension manifest / last ack: {bridgeStatus.lastAckAt ?? "-"} / 一括巡回とvisual確認の主経路はDaily Pageです
      </p>
      {bridgeStatus.bridgeVersion && bridgeStatus.workerVersion && bridgeStatus.bridgeVersion !== bridgeStatus.workerVersion && (
        <p className="mt-2 rounded-md bg-amber-950 p-2 text-xs font-bold text-amber-200">
          Myfans Companionのbridgeとworkerのversionが一致しません。bridge {bridgeStatus.bridgeVersion} / worker {bridgeStatus.workerVersion}。Chrome拡張をreloadしてからDaily Pageをreloadしてください。
        </p>
      )}
      {job && !displayJob && <p className="mt-3 rounded-md bg-amber-950 p-2 text-xs font-bold text-amber-200">DB jobと現在のCompanion run identityが一致しないため、過去runの進捗は表示していません。{job.collection_session_id ? "CompanionをReloadしてcurrent-sessionを確認してください。" : "legacy jobはcurrent-sessionとして扱いません。"}</p>}
    </>
  );
}

function QuoteRefreshRunCounters({ displayJob, summary, successRate }: {
  displayJob: NonNullable<QuoteRefreshProgress["job"]>;
  summary: QuoteRefreshSummary;
  successRate: number | null;
}) {
  const metrics = buildQuoteRefreshRunMetrics(displayJob, summary, successRate);
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-4">
      {metrics.map((metric) => <div key={metric.label} className="rounded-lg bg-zinc-900 p-3 text-xs">
        <p className="text-zinc-500">{metric.label}</p>
        <p className={`mt-1 font-black ${metric.valueClassName ?? "text-white"}`}>{metric.value}</p>
        {metric.note && <p className="mt-1 text-zinc-400">{metric.note}</p>}
      </div>)}
    </div>
  );
}

function QuoteRefreshRunMetrics({ displayJob, summary, successRate, current, pending, onControl }: {
  displayJob: QuoteRefreshProgress["job"];
  summary: QuoteRefreshSummary;
  successRate: number | null;
  current: QuoteRefreshItem | null;
  pending: boolean;
  onControl: (action: "pause" | "resume" | "cancel") => Promise<void>;
}) {
  return (
    <>
      {displayJob && (
        <QuoteRefreshRunCounters displayJob={displayJob} summary={summary} successRate={successRate} />
      )}
      {displayJob?.status === "completed" && (
        <p className={`mt-3 rounded-md p-2 text-xs font-bold ${successRate !== null && successRate >= 80 ? "bg-emerald-950 text-emerald-200" : "bg-amber-950 text-amber-200"}`}>
          completed: 成功{summary.success} / 要修正{summary.failed} / blocked{summary.blocked} / skipped{summary.skipped} / システム成功率{successRate === null ? "判定対象なし" : `${successRate}%`}
        </p>
      )}
      {current && <p className="mt-3 text-xs text-violet-200">現在処理中: {creatorNameFromItem(current)}</p>}
      {displayJob && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onControl("pause")} disabled={pending || displayJob.status === "paused"} className="h-10 rounded-lg bg-amber-700 px-3 text-xs font-black text-white disabled:opacity-50">pause</button>
          <button type="button" onClick={() => onControl("resume")} disabled={pending || displayJob.status !== "paused"} className="h-10 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50">resume</button>
          <button type="button" onClick={() => onControl("cancel")} disabled={pending || ["completed", "cancelled"].includes(displayJob.status)} className="h-10 rounded-lg bg-red-700 px-3 text-xs font-black text-white disabled:opacity-50">cancel</button>
        </div>
      )}
    </>
  );
}

function QuoteRefreshItemHistory({ recent, failedItems }: { recent: QuoteRefreshItem[]; failedItems: QuoteRefreshItem[] }) {
  return (
    <>
      {recent.length > 0 && (
        <div className="mt-3 space-y-2">
          {recent.map((item) => {
            const failure = quoteRefreshFailureLabel(item.error);
            return (
              <p key={item.id} className="rounded-md bg-zinc-900 p-2 text-xs text-zinc-300">
                {creatorNameFromItem(item)} / {item.status} / 試行{item.attempts} / 候補{item.collected_count}件 / Top {item.top_score ?? "-"}
                {failure ? ` / ${failure.category}: ${failure.detail} / ${failure.retryable ? "再試行可" : "再試行不可・blocked扱い"}` : ""}
              </p>
            );
          })}
        </div>
      )}
      {failedItems.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-black text-red-200">失敗creator</p>
          {failedItems.slice(-8).reverse().map((item) => {
            const failure = quoteRefreshFailureLabel(item.error);
            return (
              <p key={`failed-${item.id}`} className="rounded-md border border-red-900 bg-red-950/40 p-2 text-xs text-red-100">
                {creatorNameFromItem(item)} / {failure?.category ?? "UNKNOWN"} / {failure?.detail ?? item.error ?? "理由未記録"} / {failure?.retryable ? "再試行可" : "再試行不可"}
              </p>
            );
          })}
        </div>
      )}
    </>
  );
}

