"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ExternalLink, FileUp, Image as ImageIcon, LoaderCircle, MousePointerClick, Plus, RefreshCw, Save } from "lucide-react";
import type { buildMyfansExecutionBoard, MyfansQuoteCollectionTask } from "@/lib/myfansXExecution";
import type { MyfansApprovedMedia, MyfansCreator, MyfansProduct, MyfansXPost } from "@/lib/myfansAnalytics";
import { MYFANS_AFFILIATE_URL_SOURCE_MANUAL, MYFANS_CLICK_ATTRIBUTION_WINDOW_HOURS, myfansAffiliateLinkStatus, myfansAffiliateLinkStatusLabel, normalizeMyfansAffiliateUrl } from "@/lib/myfansAffiliateLink";
import { getXWeightedLength } from "@/lib/xText";

type Message = { text: string; error: boolean } | null;
type QuoteRefreshProgress = {
  job: {
    id: number;
    status: string;
    total_creators: number;
    processed_creators: number;
    success_creators: number;
    failed_creators: number;
    batch_size: number;
    last_error: string | null;
  } | null;
  skippedCreators?: number;
  items: Array<{
    id: number;
    creator_x_url: string;
    status: string;
    attempts: number;
    collected_count: number;
    top_score: number | null;
    error: string | null;
    processed_at?: string | null;
    myfans_creators?: { display_name?: string } | { display_name?: string }[] | null;
  }>;
  error?: string;
};
type CompanionBridgeStatus = {
  scriptInjected: boolean;
  runtimeConnected: boolean;
  workerStatus: string;
  bridgeVersion: string | null;
  workerVersion: string | null;
  lastAckAt: string | null;
  message: string;
};
type VisualVerificationProgress = {
  checked: number;
  verified: number;
  partial: number;
  unavailable: number;
  error?: string;
};

const EXPECTED_COMPANION_VERSION = "0.1.5";
const READY_EVENT = "amateur-lab:myfans-quote-refresh:bridge-ready";
const PING_EVENT = "amateur-lab:myfans-quote-refresh:ping";
const PONG_EVENT = "amateur-lab:myfans-quote-refresh:pong";
const VISUAL_REQUEST_EVENT = "amateur-lab:myfans-visual-verification:start";
const VISUAL_RESPONSE_EVENT = "amateur-lab:myfans-visual-verification:ack";

function workerStatusFromDetail(detail: unknown) {
  if (!detail || typeof detail !== "object") return "idle";
  const worker = "worker" in detail ? (detail as { worker?: unknown }).worker : null;
  if (!worker || typeof worker !== "object") return "idle";
  const state = "state" in worker ? (worker as { state?: unknown }).state : null;
  if (!state || typeof state !== "object") return (worker as { ok?: boolean }).ok === false ? "unavailable" : "idle";
  const visualStatus = "visualStatus" in state ? (state as { visualStatus?: unknown }).visualStatus : null;
  if (typeof visualStatus === "string" && visualStatus && visualStatus !== "idle") return `visual:${visualStatus}`;
  const status = "status" in state ? (state as { status?: unknown }).status : null;
  if (typeof status === "string" && status) return status;
  const running = "running" in state ? (state as { running?: unknown }).running : false;
  return running ? "running" : "idle";
}

function useMyfansSubmit(successText: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
      event.currentTarget.reset();
      setMessage({ text: successText, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  return { pending, message, submit };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-zinc-400">{label}{children}</label>;
}

const inputClass = "h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-emerald-500";
const textareaClass = "min-h-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-emerald-500";

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
      {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
      {pending ? "保存中" : label}
    </button>
  );
}

function StatusMessage({ message }: { message: Message }) {
  if (!message) return null;
  return <p className={`text-sm ${message.error ? "text-red-300" : "text-emerald-300"}`}>{message.text}</p>;
}

function creatorNameFromItem(item: QuoteRefreshProgress["items"][number]) {
  const relation = Array.isArray(item.myfans_creators) ? item.myfans_creators[0] : item.myfans_creators;
  return relation?.display_name || item.creator_x_url;
}

const nonRetryableQuoteRefreshErrors = new Set(["LOGIN_OR_CHALLENGE", "PROFILE_NOT_FOUND/SUSPENDED", "SENSITIVE_CONTENT_GATE"]);

function quoteRefreshFailureLabel(error: string | null) {
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

function isBlockedQuoteRefreshItem(item: QuoteRefreshProgress["items"][number]) {
  const failure = quoteRefreshFailureLabel(item.error);
  return Boolean(failure && !failure.retryable && (item.status === "failed" || item.status === "skipped"));
}

export function QuoteRefreshBatchPanel({ approvedMediaId }: { approvedMediaId: number | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<QuoteRefreshProgress | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [batchSize, setBatchSize] = useState(25);
  const [visualBatchSize, setVisualBatchSize] = useState(10);
  const [visualProgress, setVisualProgress] = useState<VisualVerificationProgress | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<CompanionBridgeStatus>({
    scriptInjected: false,
    runtimeConnected: false,
    workerStatus: "unknown",
    bridgeVersion: null,
    workerVersion: null,
    lastAckAt: null,
    message: "not injected",
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
        const detail = event instanceof CustomEvent ? event.detail : null;
        if (detail?.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener(PONG_EVENT, onPong);
        const worker = detail?.worker;
        const workerVersion = typeof worker?.version === "string" ? worker.version : null;
        const bridgeVersion = typeof detail?.extensionVersion === "string" ? detail.extensionVersion : document.documentElement.dataset.myfansCompanionBridgeVersion || null;
        setBridgeStatus({
          scriptInjected: Boolean(detail?.connected),
          runtimeConnected: Boolean(detail?.connected && worker?.ok),
          workerStatus: workerStatusFromDetail(detail),
          bridgeVersion,
          workerVersion,
          lastAckAt: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
          message: detail?.connected && worker?.ok ? "connected" : worker?.error || "not connected",
        });
        if (detail?.connected && worker?.ok) resolve();
        else reject(new Error(worker?.error || "Companion bridgeの確認に失敗しました。"));
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

  async function runVisualVerification() {
    setPending(true);
    setMessage(null);
    try {
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
            approvedMediaName: "@lumi_reviw",
            batchSize: visualBatchSize,
          },
        }));
      });
      if (!ack.ok) throw new Error(ack.error ?? "Companionでvisual候補分析を開始できませんでした。");
      setVisualProgress({ checked: 0, verified: 0, partial: 0, unavailable: 0 });
      setMessage({ text: `ログイン済みChromeでvisual分析を開始しました。worker ${ack.workerVersion ?? "-"}`, error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "visual候補分析に失敗しました。", error: true });
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

  const job = progress?.job ?? null;
  const current = progress?.items.find((item) => item.status === "running") ?? null;
  const recent = progress?.items.filter((item) => ["success", "failed", "skipped"].includes(item.status)).slice(-5).reverse() ?? [];
  const blockedCreators = progress?.items.filter(isBlockedQuoteRefreshItem).length ?? 0;
  const queueSkippedCreators = progress?.items.filter((item) => item.status === "skipped" && !isBlockedQuoteRefreshItem(item)).length ?? progress?.skippedCreators ?? 0;
  const systemFailedCreators = progress?.items.filter((item) => item.status === "failed" && !isBlockedQuoteRefreshItem(item)).length ?? 0;
  const successRateBase = job ? job.success_creators + systemFailedCreators : 0;
  const successRate = successRateBase > 0 && job ? Math.round((job.success_creators / successRateBase) * 100) : null;
  const failedItems = progress?.items.filter((item) => item.status === "failed" && !isBlockedQuoteRefreshItem(item)) ?? [];

  useEffect(() => {
    loadProgress().catch(() => {});
  }, [approvedMediaId, loadProgress]);

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
    const onReady = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      setBridgeStatus({
        scriptInjected: Boolean(detail?.connected),
        runtimeConnected: Boolean(detail?.worker?.ok),
        workerStatus: workerStatusFromDetail(detail),
        bridgeVersion: typeof detail?.extensionVersion === "string" ? detail.extensionVersion : null,
        workerVersion: typeof detail?.worker?.version === "string" ? detail.worker.version : null,
        lastAckAt: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
        message: detail?.connected ? (detail?.worker?.ok ? "connected" : "not connected") : "not injected",
      });
    };
    const onPong = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      setBridgeStatus({
        scriptInjected: Boolean(detail?.connected),
        runtimeConnected: Boolean(detail?.worker?.ok),
        workerStatus: workerStatusFromDetail(detail),
        bridgeVersion: typeof detail?.extensionVersion === "string" ? detail.extensionVersion : null,
        workerVersion: typeof detail?.worker?.version === "string" ? detail.worker.version : null,
        lastAckAt: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
        message: detail?.connected ? (detail?.worker?.ok ? "connected" : "not connected") : "not injected",
      });
    };
    window.addEventListener(READY_EVENT, onReady);
    window.addEventListener(PONG_EVENT, onPong);
    markFromDom();
    console.debug("[myfans daily page] PAGE_PING_SENT", { requestId: "mount" });
    window.dispatchEvent(new CustomEvent(PING_EVENT, { detail: { requestId: "mount" } }));
    const pingTimer = window.setInterval(() => {
      pingCompanionBridge().catch(() => setBridgeStatus((current) => ({ ...current, message: "bridge再接続を試行中" })));
    }, 5000);
    const timers = [250, 1000, 2500].map((ms) => window.setTimeout(markFromDom, ms));
    return () => {
      window.removeEventListener(READY_EVENT, onReady);
      window.removeEventListener(PONG_EVENT, onPong);
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
            <option value={5}>5 creator</option>
            <option value={20}>20 creator</option>
            <option value={25}>25 creator</option>
            <option value={30}>30 creator</option>
          </select>
          <button type="button" onClick={refreshProgressOnly} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
            {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
            進捗を更新
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-cyan-800 bg-cyan-950/20 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-cyan-100">visual候補を追加分析</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Daily PageからCompanionを起動し、ログイン済みChromeのXタブで実画像/実動画の表示状態を確認して保存します。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={visualBatchSize} onChange={(event) => setVisualBatchSize(Number(event.target.value))} className={inputClass}>
              <option value={5}>5件</option>
              <option value={10}>10件</option>
              <option value={20}>20件</option>
            </select>
            <button type="button" onClick={runVisualVerification} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
              {pending ? <LoaderCircle size={17} className="animate-spin" /> : <ImageIcon size={17} />}
              追加分析
            </button>
          </div>
        </div>
        {visualProgress && (
          <p className="mt-2 text-xs font-bold text-cyan-100">
            checked {visualProgress.checked} / verified {visualProgress.verified} / partial {visualProgress.partial} / unavailable {visualProgress.unavailable}
          </p>
        )}
        {(bridgeStatus.workerStatus === "running" || bridgeStatus.workerStatus === "done" || bridgeStatus.workerStatus === "error") && (
          <p className="mt-2 text-xs leading-5 text-cyan-100">
            quote worker: {bridgeStatus.workerStatus} / visual progressは下のworker stateに反映されます。完了後にページを更新してください。
          </p>
        )}
      </div>
      <StatusMessage message={message} />
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">
        bridge script: {bridgeStatus.scriptInjected ? "injected" : "not injected"} / runtime: {bridgeStatus.runtimeConnected ? "connected" : "not connected"} / bridge version: {bridgeStatus.bridgeVersion ?? "-"} / worker: {bridgeStatus.workerStatus} / worker version: {bridgeStatus.workerVersion ?? "-"} / expected: {EXPECTED_COMPANION_VERSION} / last ack: {bridgeStatus.lastAckAt ?? "-"} / 一括巡回とvisual確認の主経路はDaily Pageです
      </p>
      {bridgeStatus.bridgeVersion && bridgeStatus.bridgeVersion !== EXPECTED_COMPANION_VERSION && (
        <p className="mt-2 rounded-md bg-amber-950 p-2 text-xs font-bold text-amber-200">
          Myfans Companionのbridge versionが期待値と違います。表示version {bridgeStatus.bridgeVersion} / 期待version {EXPECTED_COMPANION_VERSION}
        </p>
      )}
      {job && (
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="rounded-lg bg-zinc-900 p-3 text-xs"><p className="text-zinc-500">状態</p><p className="mt-1 font-black text-white">{job.status}</p></div>
          <div className="rounded-lg bg-zinc-900 p-3 text-xs"><p className="text-zinc-500">進捗</p><p className="mt-1 font-black text-white">{job.processed_creators} / {job.total_creators}</p></div>
          <div className="rounded-lg bg-zinc-900 p-3 text-xs"><p className="text-zinc-500">成功/要修正/blocked</p><p className="mt-1 font-black text-white">{job.success_creators} / {systemFailedCreators} / {blockedCreators + queueSkippedCreators}</p></div>
          <div className="rounded-lg bg-zinc-900 p-3 text-xs"><p className="text-zinc-500">システム成功率</p><p className={`mt-1 font-black ${successRate !== null && successRate >= 80 ? "text-emerald-300" : "text-amber-300"}`}>{successRate === null ? "-" : `${successRate}%`}</p></div>
        </div>
      )}
      {job?.status === "completed" && (
        <p className={`mt-3 rounded-md p-2 text-xs font-bold ${successRate !== null && successRate >= 80 ? "bg-emerald-950 text-emerald-200" : "bg-amber-950 text-amber-200"}`}>
          completed: 成功{job.success_creators} / 要修正{systemFailedCreators} / blocked{blockedCreators + queueSkippedCreators} / システム成功率{successRate === null ? "判定対象なし" : `${successRate}%`}
        </p>
      )}
      {current && <p className="mt-3 text-xs text-violet-200">現在処理中: {creatorNameFromItem(current)}</p>}
      {job && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => control("pause")} disabled={pending || job.status === "paused"} className="h-10 rounded-lg bg-amber-700 px-3 text-xs font-black text-white disabled:opacity-50">pause</button>
          <button type="button" onClick={() => control("resume")} disabled={pending || job.status !== "paused"} className="h-10 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50">resume</button>
          <button type="button" onClick={() => control("cancel")} disabled={pending || ["completed", "cancelled"].includes(job.status)} className="h-10 rounded-lg bg-red-700 px-3 text-xs font-black text-white disabled:opacity-50">cancel</button>
        </div>
      )}
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
    </div>
  );
}

export function DailyPlanReevaluateButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reevaluate() {
    setPending(true);
    router.refresh();
    window.setTimeout(() => setPending(false), 900);
  }

  return (
    <button type="button" onClick={reevaluate} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
      {pending ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
      今日の候補を再評価
    </button>
  );
}

export function CreatorForm() {
  const { pending, message, submit } = useMyfansSubmit("クリエイターを保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-2">
      <input type="hidden" name="action" value="creator" />
      <Field label="クリエイター名"><input name="display_name" required className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="myfans URL"><input name="myfans_url" type="url" className={inputClass} /></Field>
      <Field label="X URL"><input name="x_url" type="url" className={inputClass} /></Field>
      <Field label="活動メモ"><textarea name="activity_note" className={`${textareaClass} lg:col-span-2`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <SubmitButton pending={pending} label="クリエイターを追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function MediaForm() {
  const { pending, message, submit } = useMyfansSubmit("承認済みメディアを保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-3">
      <input type="hidden" name="action" value="media" />
      <Field label="メディア名"><input name="media_name" required className={inputClass} /></Field>
      <Field label="メディアURL"><input name="media_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリエイトメディアID"><input name="affiliate_media_id" className={inputClass} /></Field>
      <Field label="メモ"><textarea name="notes" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="メディアを追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function ProductForm({ creators, media }: { creators: MyfansCreator[]; media: MyfansApprovedMedia[] }) {
  const { pending, message, submit } = useMyfansSubmit("商品を保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-4">
      <input type="hidden" name="action" value="product" />
      <Field label="商品名"><input name="title" required className={`${inputClass} lg:col-span-2`} /></Field>
      <Field label="クリエイター"><select name="creator_id" className={inputClass}><option value="">未選択</option>{creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.display_name}</option>)}</select></Field>
      <Field label="状態"><select name="status" className={inputClass}><option value="candidate">candidate</option><option value="approved">approved</option><option value="posted">posted</option><option value="paused">paused</option><option value="rejected">rejected</option></select></Field>
      <Field label="商品URL"><input name="product_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="商品種別"><select name="product_type" className={inputClass}><option value="single">単品</option><option value="plan">プラン</option><option value="backnumber_plan">バックナンバー</option><option value="backnumber_month">月別</option><option value="gacha">ガチャ</option><option value="other">その他</option></select></Field>
      <Field label="価格"><input name="price" type="number" min="0" className={inputClass} /></Field>
      <Field label="報酬率 %"><input name="reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="プラン加入報酬"><input name="plan_signup_reward" type="number" min="0" className={inputClass} /></Field>
      <Field label="継続報酬率 %"><input name="recurring_reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="人気順位"><input name="popularity_rank" type="number" min="1" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="保存"><input name="saves_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="新着"><select name="is_new" className={inputClass}><option value="false">いいえ</option><option value="true">はい</option></select></Field>
      <Field label="承認済みメディア"><select name="approved_media_name" className={inputClass}><option value="">未選択</option>{media.map((item) => <option key={item.id} value={item.media_name}>{item.media_name}</option>)}</select></Field>
      <Field label="承認メディアURL"><input name="approved_media_url" type="url" className={inputClass} /></Field>
      <Field label="メディアID"><input name="affiliate_media_id" className={inputClass} /></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-4`} /></Field>
      <Field label="メモ"><textarea name="notes" className={`${textareaClass} lg:col-span-4`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        <SubmitButton pending={pending} label="商品を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function PostForm({ products }: { products: MyfansProduct[] }) {
  const { pending, message, submit } = useMyfansSubmit("投稿候補を保存しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-3">
      <input type="hidden" name="action" value="post" />
      <Field label="商品"><select name="product_id" className={inputClass}><option value="">未選択</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
      <Field label="投稿型"><select name="post_type" className={inputClass}><option value="discovery_interest">発見・興味</option><option value="ranking_note">ランキング観測</option><option value="comparison_review">比較レビュー</option><option value="profile_cta">プロフィール誘導</option><option value="body_link_sales">本文リンク収益</option><option value="reply_link_sales">自己リプ収益</option><option value="winner_reuse">勝ち型再利用</option><option value="discovery">発掘</option><option value="comparison">比較</option><option value="avoid_bad_buy">ハズレ回避</option><option value="new_creator">新人</option><option value="single_intro">単品紹介</option><option value="trend">トレンド</option><option value="other">その他</option></select></Field>
      <Field label="状態"><select name="status" className={inputClass}><option value="draft">draft</option><option value="ready">ready</option><option value="posted">posted</option><option value="archived">archived</option></select></Field>
      <Field label="本文"><textarea name="body" required className={`${textareaClass} lg:col-span-3`} /></Field>
      <Field label="自己リプ"><textarea name="self_reply" className={`${textareaClass} lg:col-span-3`} /></Field>
      <Field label="#PR"><select name="includes_pr" className={inputClass}><option value="true">あり</option><option value="false">なし</option></select></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="投稿予定"><input name="scheduled_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="投稿日時"><input name="posted_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="投稿URL"><input name="x_post_url" type="url" className={inputClass} /></Field>
      <Field label="投稿担当"><input name="actual_posted_by" className={inputClass} /></Field>
      <Field label="インプレッション"><input name="impressions" type="number" min="0" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="リポスト"><input name="reposts_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="返信"><input name="replies_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="クリック"><input name="clicks" type="number" min="0" className={inputClass} /></Field>
      <Field label="成長ステージ"><input name="growth_stage" className={inputClass} /></Field>
      <Field label="リンク戦略"><select name="link_strategy" className={inputClass}><option value="no_link">no_link</option><option value="profile_cta">profile_cta</option><option value="body_link">body_link</option><option value="reply_link">reply_link</option></select></Field>
      <Field label="CTA戦略"><input name="cta_strategy" className={inputClass} /></Field>
      <Field label="目的"><select name="objective" className={inputClass}><option value="impression">impression</option><option value="profile_visit">profile_visit</option><option value="follow">follow</option><option value="click">click</option><option value="conversion">conversion</option></select></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="投稿候補を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

type ExecutionCandidate = ReturnType<typeof buildMyfansExecutionBoard>["candidates"][number];

function publishBody(candidate: ExecutionCandidate) {
  if (candidate.creativeStrategy !== "quote_post" || !candidate.quoteXUrl) return candidate.body;
  const lines = candidate.body.split(/\n+/).map((line) => line.trim()).filter((line) => line !== candidate.quoteXUrl);
  return [...lines, candidate.quoteXUrl].join("\n\n");
}

function needsFreshAffiliateLink(candidate: ExecutionCandidate) {
  return candidate.linkStrategy === "reply_link" || candidate.linkStrategy === "body_link";
}

function canUseAffiliateLink(candidate: ExecutionCandidate) {
  if (!candidate.product || !needsFreshAffiliateLink(candidate)) return true;
  const status = myfansAffiliateLinkStatus(candidate.product);
  return status === "valid" || status === "expiring_soon";
}

const POST_RECORD_LEAK_PATTERNS = [
  /ブラウザでvisual/i,
  /推定報酬/,
  /報酬率/,
  /Quality Gate/i,
  /公開候補/,
  /候補です/,
  /登録情報でも/,
];

const metricFields = [
  { name: "impressions", label: "表示回数", description: "Xで何回見られたか" },
  { name: "likes_count", label: "いいね", description: "この投稿についたいいね数" },
  { name: "reposts_count", label: "リポスト", description: "この投稿がリポストされた回数" },
  { name: "replies_count", label: "返信", description: "この投稿への返信数" },
  { name: "clicks", label: "リンククリック", description: "myfansリンクを押された回数" },
] as const;

function publicCopyLeakMatches(text: string) {
  return POST_RECORD_LEAK_PATTERNS.flatMap((pattern) => text.match(pattern)?.[0] ?? []);
}

function postTimestamp(post: MyfansXPost) {
  return new Date(post.posted_at ?? post.created_at).getTime();
}

function isConfirmedPostedPost(post: MyfansXPost) {
  return post.status === "posted" || Boolean(post.posted_at) || Boolean(post.x_post_url.trim());
}

function postDedupeKey(post: MyfansXPost) {
  const xPostUrl = post.x_post_url.trim();
  if (xPostUrl) return `url:${xPostUrl}`;
  if (post.planned_slot && post.creative_variant_id) return `slot:${post.planned_slot}:${post.creative_variant_id}`;
  return `id:${post.id}`;
}

function dedupePostedPosts(posts: MyfansXPost[]) {
  return Array.from(
    posts
      .filter(isConfirmedPostedPost)
      .reduce((latestByKey, post) => {
        const key = postDedupeKey(post);
        const current = latestByKey.get(key);
        if (!current || postTimestamp(post) > postTimestamp(current)) latestByKey.set(key, post);
        return latestByKey;
      }, new Map<string, MyfansXPost>())
      .values(),
  ).sort((a, b) => postTimestamp(b) - postTimestamp(a));
}

function isMetricsRecorded(post: MyfansXPost) {
  return Boolean(post.metrics_recorded_at);
}

function postDisplayCopy(post: MyfansXPost) {
  const postedLeakMatches = publicCopyLeakMatches(post.body);
  if (postedLeakMatches.length) {
    return {
      label: "投稿時の本文（旧）",
      body: post.body,
      warning: `内部向け文言が含まれています。公開候補ではなく過去の保存本文として確認してください: ${postedLeakMatches.join(" / ")}`,
    };
  }

  return {
    label: "投稿時の本文",
    body: post.body,
    warning: null,
  };
}
type CardPayload = Record<string, unknown>;

async function postFormData(formData: FormData) {
  const response = await fetch("/api/admin/myfans", { method: "POST", body: formData });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
}

function payloadText(payload: CardPayload, key: string) {
  return String(payload[key] ?? "");
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    const next = `${line}${char}`;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((row, index) => context.fillText(index === maxLines - 1 && chars.join("").length > lines.join("").length ? `${row.slice(0, -1)}...` : row, x, y + index * lineHeight));
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function downloadCardPng(candidate: ExecutionCandidate) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を作れませんでした。text onlyで投稿してください。");
  const payload = (candidate.cardPayload ?? {}) as CardPayload;
  const kind = candidate.creativeStrategy;
  const accent = kind === "ranking_card" ? "#d97706" : kind === "comparison_card" ? "#0369a1" : "#059669";
  const accentSoft = kind === "ranking_card" ? "#fef3c7" : kind === "comparison_card" ? "#e0f2fe" : "#dcfce7";
  const dark = "#111827";
  context.fillStyle = "#fafafa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accentSoft;
  context.fillRect(0, 0, canvas.width, 150);
  context.fillStyle = accent;
  context.fillRect(0, 0, 28, canvas.height);

  context.fillStyle = dark;
  context.font = "900 34px sans-serif";
  context.fillText(payloadText(payload, "subtitle") || "myfans発掘・比較", 72, 72);
  context.fillStyle = dark;
  context.font = "900 72px sans-serif";
  wrapCanvasText(context, payloadText(payload, "headline") || payloadText(payload, "title") || "見るポイントは1つ", 72, 145, 900, 78, 2);

  context.fillStyle = "#ffffff";
  roundRect(context, 72, 214, 708, 220, 20);
  context.fill();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = dark;
  context.font = "900 38px sans-serif";
  wrapCanvasText(context, payloadText(payload, "primary") || payloadText(payload, "angle"), 104, 280, 632, 48, 3);
  context.fillStyle = "#4b5563";
  context.font = "700 25px sans-serif";
  wrapCanvasText(context, payloadText(payload, "audienceLine") || payloadText(payload, "audience"), 104, 390, 620, 32, 2);

  const chips = ["chip1", "chip2", "chip3"].map((key) => payloadText(payload, key)).filter(Boolean);
  chips.forEach((chip, index) => {
    const x = 72 + index * 224;
    context.fillStyle = accent;
    roundRect(context, x, 470, 196, 58, 16);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "900 24px sans-serif";
    wrapCanvasText(context, chip, x + 22, 508, 152, 26, 1);
  });

  context.fillStyle = dark;
  roundRect(context, 830, 214, 300, 314, 20);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 28px sans-serif";
  context.fillText("見る前チェック", 860, 268);
  context.fillStyle = accentSoft;
  context.font = "800 28px sans-serif";
  wrapCanvasText(context, payloadText(payload, "check"), 860, 330, 230, 40, 3);
  context.fillStyle = "#d1d5db";
  context.font = "700 21px sans-serif";
  wrapCanvasText(context, payloadText(payload, "title") || candidate.product?.title || "", 860, 468, 230, 28, 2);

  context.fillStyle = "#334155";
  context.font = "900 24px sans-serif";
  context.fillText(payloadText(payload, "footer") || "@lumi_reviw / myfans発掘・比較", 72, 632);
  context.font = "700 20px sans-serif";
  context.fillText("画像・サムネ・動画不使用 / テキスト情報のみ", 760, 632);
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${candidate.creativeVariantId || "myfans-card"}.png`;
  link.click();
}

function CreativeCardPreview({ candidate }: { candidate: ExecutionCandidate }) {
  const payload = (candidate.cardPayload ?? {}) as CardPayload;
  const kind = candidate.creativeStrategy;
  const tone = kind === "ranking_card"
    ? { bar: "bg-amber-600", soft: "bg-amber-100", text: "text-amber-800" }
    : kind === "comparison_card"
      ? { bar: "bg-sky-700", soft: "bg-sky-100", text: "text-sky-800" }
      : { bar: "bg-emerald-700", soft: "bg-emerald-100", text: "text-emerald-800" };
  const chips = ["chip1", "chip2", "chip3"].map((key) => payloadText(payload, key)).filter(Boolean);
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-700 bg-neutral-50 text-zinc-950 shadow-sm">
      <div className={`h-2 ${tone.bar}`} />
      <div className={`${tone.soft} px-5 py-4`}>
        <p className={`text-xs font-black ${tone.text}`}>{payloadText(payload, "subtitle") || "myfans発掘・比較"}</p>
        <p className="mt-2 text-2xl font-black leading-8">{payloadText(payload, "headline") || payloadText(payload, "title") || "見るポイントは1つ"}</p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div>
          <p className="text-lg font-black leading-7">{payloadText(payload, "primary") || payloadText(payload, "angle")}</p>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">{payloadText(payload, "audienceLine") || payloadText(payload, "audience")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span key={chip} className={`rounded-md px-3 py-1.5 text-xs font-black ${tone.soft} ${tone.text}`}>{chip}</span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-950 p-4 text-white">
          <p className="text-xs font-black text-zinc-400">見る前チェック</p>
          <p className="mt-2 text-sm font-black leading-6">{payloadText(payload, "check")}</p>
          <p className="mt-4 text-xs leading-5 text-zinc-400">{payloadText(payload, "title") || candidate.product?.title}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-zinc-200 px-5 py-3 text-xs font-bold text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{payloadText(payload, "footer") || "@lumi_reviw / myfans発掘・比較"}</span>
        <span>1200x675 PNG / 素材画像不使用</span>
      </div>
    </div>
  );
}

export function QuoteCandidateTasks({ tasks }: { tasks: MyfansQuoteCollectionTask[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function submit(productId: number, form: HTMLFormElement) {
    setPendingId(productId);
    setMessage(null);
    try {
      const formData = new FormData(form);
      formData.set("action", "quote_candidate_update");
      formData.set("product_id", String(productId));
      await postFormData(formData);
      setMessage({ text: "引用候補URLを登録しました。次回の投稿候補でquote_postを選べます。", error: false });
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "引用候補URLを登録できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section id="quote-refresh" className="mt-8 rounded-lg border border-violet-800 bg-violet-950/20 p-5">
      <p className="text-xs font-black text-violet-300">引用候補収集タスク</p>
      <h2 className="mt-2 text-2xl font-black">引用候補を更新</h2>
      <StatusMessage message={message} />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs font-black text-violet-300">{task.sourceXHandle ? `@${task.sourceXHandle}` : "Xプロフィールあり"}</p>
            <h3 className="mt-2 text-lg font-black">{task.creatorName}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{task.productTitle}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{task.instruction}</p>
            <div className="mt-3 rounded-lg bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
              <p className="font-black text-white">収集済み {task.collectedCount}/20件</p>
              <p className="mt-1">使用予定: {task.plannedSlot}</p>
              <p className="mt-1">最終収集日: {task.lastCollectedAt?.slice(0, 10) ?? "未収集"} / 次回目安: {task.nextRefreshLabel}</p>
              <p className="mt-1">creator内Top score: {task.topScore ?? "-"}</p>
              <p className="mt-1">全体rank: {task.globalRank ?? "-"} / 今日採用: {task.selectedForToday ? "予定あり" : "なし"}</p>
              {task.topCandidates.length ? (
                <>
                  {task.topCandidates.map((candidate) => (
                    <div key={candidate.xPostUrl} className="mt-2 rounded-md bg-zinc-950 p-2">
                      <p className="font-black text-emerald-300">Top{candidate.rank} Score {candidate.score}</p>
                      <p className="mt-1 text-zinc-300">media: {candidate.mediaType} / visual: {candidate.quoteVisualReady ? "ready" : "fallback"} / URL: {candidate.urlKind}</p>
                      <p className="mt-1 text-zinc-400">{candidate.reason}</p>
                      <a href={candidate.quoteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-cyan-300 underline">使用URL</a>
                      {candidate.quoteUrl !== candidate.xPostUrl && <a href={candidate.xPostUrl} target="_blank" rel="noreferrer" className="ml-3 mt-1 inline-flex text-zinc-400 underline">status URL</a>}
                    </div>
                  ))}
                </>
              ) : (
                <p className="mt-2 text-amber-200">creator内Top1-3はまだ作れていません。候補不足、未収集、または閾値未満です。</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`${task.creatorXUrl}${task.creatorXUrl.includes("?") ? "&" : "?"}myfans_creator_id=${task.creatorId ?? ""}${task.productId ? `&myfans_product_id=${task.productId}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-700 px-3 text-xs font-black text-white">
                <ExternalLink size={15} /> Xプロフィールを開く
              </a>
              <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionで引用候補を収集</span>
            </div>
            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <summary className="cursor-pointer text-xs font-black text-zinc-500">管理者用fallback</summary>
              <form onSubmit={(event) => { event.preventDefault(); if (task.productId) submit(task.productId, event.currentTarget); }} className="mt-3 grid gap-2">
                <input name="quote_candidate_x_url" type="url" required placeholder="https://x.com/.../status/..." className={inputClass} />
                <button type="submit" disabled={!task.productId || pendingId === task.productId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white disabled:opacity-50">
                  <Save size={15} /> URLを直接登録
                </button>
              </form>
            </details>
          </article>
        ))}
        {!tasks.length && <p className="text-sm text-zinc-500">creator X URLがあり、引用候補URLが空の商品はありません。</p>}
      </div>
    </section>
  );
}

export function XExecutionBoard({ candidates, posts }: { candidates: ExecutionCandidate[]; posts: MyfansXPost[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pendingId, setPendingId] = useState<string | number | null>(null);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage({ text: `${label}をコピーしました。`, error: false });
  }

  async function createCandidate(candidate: ExecutionCandidate) {
    if (!candidate.product) return;
    if (!canUseAffiliateLink(candidate)) {
      setMessage({ text: "リンクが必要な投稿です。先に正規myfansアフィリンクを作成/更新してください。", error: true });
      return;
    }
    setPendingId(candidate.id);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("action", "post");
      formData.set("product_id", String(candidate.product.id));
      formData.set("post_type", candidate.postType);
      formData.set("status", "ready");
      formData.set("body", publishBody(candidate));
      formData.set("self_reply", candidate.selfReply);
      formData.set("includes_pr", candidate.linkStrategy === "no_link" || candidate.linkStrategy === "profile_cta" ? "false" : "true");
      formData.set("source_x_url", candidate.sourceXUrl);
      formData.set("affiliate_url", candidate.affiliateUrl);
      formData.set("selection_reason", candidate.reason);
      formData.set("growth_stage", candidate.growthStage);
      formData.set("link_strategy", candidate.linkStrategy);
      formData.set("cta_strategy", candidate.ctaStrategy);
      formData.set("creative_variant_id", candidate.creativeVariantId);
      formData.set("creative_strategy", candidate.creativeStrategy);
      formData.set("creative_reason", candidate.creativeReason);
      formData.set("card_payload", JSON.stringify(candidate.cardPayload));
      formData.set("ogp_check_required", candidate.ogpCheckRequired ? "true" : "false");
      formData.set("quote_x_url", candidate.quoteXUrl);
      formData.set("media_permission_status", candidate.mediaPermissionStatus);
      formData.set("planned_slot", candidate.plannedSlot);
      formData.set("objective", candidate.objective);
      formData.set("approved_media_name", candidate.approvedMediaName);
      if (candidate.approvedMediaId) formData.set("approved_media_id", String(candidate.approvedMediaId));
      formData.set("growth_score", String(candidate.opportunity?.growthScore ?? 0));
      formData.set("revenue_score", String(candidate.opportunity?.revenueScore ?? 0));
      formData.set("creator_ltv_score", String(candidate.opportunity?.creatorLtvScore ?? 0));
      formData.set("expected_reward_per_1000_impressions", String(candidate.opportunity?.expectedRewardPer1000Impressions ?? 0));
      await postFormData(formData);
      setMessage({ text: "候補を投稿ログに保存しました。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "保存に失敗しました。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function saveAffiliateLink(candidate: ExecutionCandidate, form: HTMLFormElement) {
    if (!candidate.product) return;
    setPendingId(`affiliate-${candidate.product.id}`);
    setMessage(null);
    try {
      const formData = new FormData(form);
      const affiliateUrl = normalizeMyfansAffiliateUrl(String(formData.get("affiliate_url") ?? ""));
      if (!affiliateUrl) throw new Error("正規のmyfansアフィリンク（https://mfco.link/r/...）だけ保存できます。");
      formData.set("action", "affiliate_link_update");
      formData.set("product_id", String(candidate.product.id));
      formData.set("affiliate_url", affiliateUrl);
      formData.set("affiliate_url_generated_at", new Date().toISOString());
      formData.set("affiliate_url_source", MYFANS_AFFILIATE_URL_SOURCE_MANUAL);
      await postFormData(formData);
      setMessage({ text: "アフィリンクを保存しました。自己リプ文も新しいリンクで更新されます。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "アフィリンクを保存できませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function launchTodayCandidates() {
    const activeCandidates = candidates.filter((candidate) => candidate.product);
    if (!activeCandidates.length || pendingId) return;
    const blocked = activeCandidates.filter((candidate) => needsFreshAffiliateLink(candidate) && !canUseAffiliateLink(candidate));
    if (blocked.length) {
      setMessage({ text: "リンクが必要な投稿に未作成/期限切れがあります。先にアフィリンクを作成/更新してください。", error: true });
      return;
    }
    setPendingId("today");
    setMessage(null);
    const draftWindows = activeCandidates.map(() => {
      const draftWindow = window.open("about:blank", "_blank");
      if (draftWindow) draftWindow.opener = null;
      return draftWindow;
    });
    try {
      for (const candidate of activeCandidates) {
        await createCandidate(candidate);
      }
      activeCandidates.forEach((candidate, index) => {
        window.setTimeout(() => {
          const postBody = publishBody(candidate);
          const url = `https://x.com/intent/post?text=${encodeURIComponent(postBody)}`;
          const draftWindow = draftWindows[index];
          if (draftWindow) draftWindow.location.href = url;
          else window.open(url, "_blank", "noopener,noreferrer");
        }, index * 350);
      });
      setMessage({ text: "今日の投稿をXで開きました。リンク付きだけで並べず、ローテーション通りに開いています。", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "今日の投稿を開けませんでした。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  async function updatePost(post: MyfansXPost, mode: "posted" | "url" | "metrics", form?: HTMLFormElement) {
    setPendingId(post.id);
    setMessage(null);
    try {
      const formData = new FormData(form);
      formData.set("action", "post_execution_update");
      formData.set("id", String(post.id));
      formData.set("mode", mode);
      await postFormData(formData);
      setMessage({ text: "投稿ログを更新しました。", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "更新に失敗しました。", error: true });
    } finally {
      setPendingId(null);
    }
  }

  const confirmedPosts = dedupePostedPosts(posts);
  const postedPosts = confirmedPosts.filter((post) => !isMetricsRecorded(post)).slice(0, 12);
  const recordedPosts = confirmedPosts.filter(isMetricsRecorded).slice(0, 5);
  const strategyLabels: Record<string, string> = {
    quote_post: "creator X投稿の引用",
    myfans_ogp: "myfans正規OGP",
    comparison_card: "自作比較カード",
    ranking_card: "自作ランキングカード",
    discovery_card: "自作発見カード",
    revenue_data_card: "自作収益カード",
    text_only: "text only",
    permitted_media: "許諾済み画像/動画",
  };

  return (
    <div className="mt-8 space-y-6">
      <StatusMessage message={message} />
      {!candidates.some((candidate) => candidate.product) && (
        <section className="rounded-xl border border-amber-800 bg-amber-950/30 p-5">
          <p className="text-sm font-black text-amber-200">投稿前に商品候補が必要です</p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            この画面は承認済みメディアに紐づく商品から投稿文を作ります。myfans管理画面の商品詳細や最近生成したURLをコピーして貼ると、候補登録後に今日の投稿案が生成されます。
          </p>
          <AffiliatePasteImportForm />
          <QuickProductForm />
        </section>
      )}
      <section className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black text-emerald-300">今日の実行</p>
            <h2 className="mt-2 text-xl font-black">今日の投稿を、役割つきで順番に出す</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              すべてリンク付きにはしません。露出、プロフィール誘導、リンクテストを分けて、どこで詰まっているか見えるようにします。
            </p>
          </div>
          <button
            type="button"
            onClick={launchTodayCandidates}
            disabled={pendingId === "today" || !candidates.some((candidate) => candidate.product)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-black transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            <ExternalLink size={17} />
            今日の投稿をXで開く
          </button>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            {(() => {
              const linkRequired = needsFreshAffiliateLink(candidate);
              const linkStatus = candidate.product ? myfansAffiliateLinkStatus(candidate.product) : "missing";
              const linkReady = canUseAffiliateLink(candidate);
              const selfReplyPreview = linkRequired && candidate.product && linkReady
                ? `#PR\n詳細はこちら\n${candidate.product.affiliate_url}`.trim()
                : candidate.selfReply;
              return (
                <>
            <p className="text-xs font-black text-emerald-300">{candidate.approvedMediaName} / {candidate.plannedSlot}</p>
            <h2 className="mt-2 text-lg font-black">{candidate.product?.title ?? "商品候補がありません"}</h2>
            <p className="mt-2 text-sm font-black text-white">{candidate.role}</p>
            <p className="mt-2 text-xs text-zinc-500">{candidate.growthStage} / {candidate.dailyRole} / {candidate.postType} / {candidate.linkStrategy} / {candidate.objective}</p>
            <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 p-4">
              <p className="text-xs font-black text-zinc-500">内部判断</p>
              <div className={`mt-3 rounded-lg border p-3 ${candidate.quality.verdict === "PASS" ? "border-emerald-700 bg-emerald-950/30" : "border-amber-700 bg-amber-950/30"}`}>
                <p className="text-sm font-black">{candidate.quality.verdict} {candidate.quality.total}/100</p>
                <p className="mt-1 text-xs leading-5 text-zinc-300">{candidate.quality.reasons.join(" / ")}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  stop {candidate.quality.breakdown.stopPower ?? candidate.quality.breakdown.firstLineStop ?? "-"} / visual {candidate.quality.breakdown.visualLeverage ?? candidate.quality.breakdown.visual ?? "-"} / specificity {candidate.quality.breakdown.specificity ?? "-"} / proof {candidate.quality.breakdown.proof ?? "-"} / curiosity {candidate.quality.breakdown.broadCuriosity ?? candidate.quality.breakdown.audience ?? "-"} / follow {candidate.quality.breakdown.followReason ?? "-"} / role {candidate.quality.breakdown.roleDifferentiation ?? "-"} / smell {candidate.quality.breakdown.spamSalesSmell ?? "-"}
                </p>
              </div>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-300">
                {candidate.topicValue && (
                  <div className={`rounded-lg border p-3 ${candidate.topicValue.verdict === "PASS" ? "border-sky-700 bg-sky-950/30" : "border-amber-700 bg-amber-950/30"}`}>
                    <p className="font-black text-white">Topic Value {candidate.topicValue.score}/100 / {candidate.topicValue.verdict} / threshold {candidate.topicThreshold}</p>
                    <p className="mt-1"><span className="font-black text-zinc-500">reason_to_care:</span> {candidate.topicValue.reasonToCare ?? "-"}</p>
                    <p className="mt-1"><span className="font-black text-zinc-500">evidence:</span> {candidate.topicValue.evidence.join(" / ") || "-"}</p>
                    <p className="mt-1 text-zinc-400"><span className="font-black text-zinc-500">baseline:</span> {candidate.topicValue.baseline.join(" / ") || "-"}</p>
                    {candidate.topicValue.whyRejected.length > 0 && <p className="mt-1 text-amber-200"><span className="font-black">why rejected:</span> {candidate.topicValue.whyRejected.join(" / ")}</p>}
                  </div>
                )}
                <p><span className="font-black text-zinc-500">今日の目的:</span> {candidate.objective}</p>
                <p><span className="font-black text-zinc-500">role:</span> {candidate.dailyRole}</p>
                <p><span className="font-black text-zinc-500">投稿型:</span> {candidate.postType}</p>
                <p><span className="font-black text-zinc-500">link_strategy:</span> {candidate.linkStrategy}</p>
                <p><span className="font-black text-zinc-500">creative_strategy:</span> {strategyLabels[candidate.creativeStrategy] ?? candidate.creativeStrategy}</p>
                {candidate.visualUnderstanding && (
                  <>
                    <p><span className="font-black text-zinc-500">Visual analysis status:</span> {candidate.visualUnderstanding.visualAnalysisStatus} / {candidate.visualUnderstanding.analyzerVersion}</p>
                    <p><span className="font-black text-zinc-500">raw visual evidence:</span> {candidate.visualUnderstanding.rawVisualEvidence || candidate.visualUnderstanding.concreteVisualCue || "-"} / confidence {candidate.visualUnderstanding.cueConfidence ?? "-"}</p>
                    <p><span className="font-black text-zinc-500">human observation:</span> {candidate.visualUnderstanding.humanObservation || "-"}</p>
                    <p><span className="font-black text-zinc-500">evidence source:</span> {candidate.visualUnderstanding.evidenceSource || candidate.visualUnderstanding.sourceEvidence || "-"}</p>
                    <p><span className="font-black text-zinc-500">visual detail:</span> {candidate.visualUnderstanding.visualMoment} / {candidate.visualUnderstanding.compositionOrStyle || "-"} / {candidate.visualUnderstanding.cameraDistanceOrFraming || "-"}</p>
                    <p><span className="font-black text-zinc-500">Naturalness / visual specificity / why pass:</span> {candidate.quality.breakdown.followReason ?? "-"} / {candidate.quality.breakdown.specificity ?? "-"} / {candidate.quality.reasons.join(" / ")}</p>
                    <p><span className="font-black text-zinc-500">reaction type:</span> {candidate.reactionType ?? "-"}</p>
                    <p><span className="font-black text-zinc-500">why this angle:</span> {candidate.whyThisAngle}</p>
                  </>
                )}
                <p><span className="font-black text-zinc-500">hook:</span> {candidate.hookType} / {candidate.hookLabel}</p>
                <p><span className="font-black text-zinc-500">audience intent:</span> {candidate.audienceIntent}</p>
                <p><span className="font-black text-zinc-500">想定読者:</span> {candidate.reader}</p>
                <p><span className="font-black text-zinc-500">読者価値:</span> {candidate.readerValue}</p>
                <p><span className="font-black text-zinc-500">冒頭で止まる理由:</span> {candidate.stopReason}</p>
                <p><span className="font-black text-zinc-500">CTAの役割:</span> {candidate.ctaRole}</p>
                <p><span className="font-black text-zinc-500">なぜ:</span> {candidate.creativeReason}</p>
              </div>
            </div>
            {candidate.attention && (
              <div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
                <p className="font-black text-violet-300">Attention {candidate.attention.score}/100</p>
                <p>visual {candidate.attention.visualStrength} / verified {candidate.attention.visualVerified ? "yes" : "no"} / freshness {candidate.attention.freshness} / engagement {candidate.attention.engagementStrength} / data story {candidate.attention.dataStoryScore}</p>
                <p className="mt-1 text-zinc-500">{candidate.attention.reasons.join(" / ")}</p>
              </div>
            )}
            {candidate.opportunity && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">Growth</p><p className="mt-1 text-lg font-black">{candidate.opportunity.growthScore}</p></div>
                <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">Revenue</p><p className="mt-1 text-lg font-black">{candidate.opportunity.revenueScore}</p></div>
                <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">LTV</p><p className="mt-1 text-lg font-black">{candidate.opportunity.creatorLtvScore}</p></div>
              </div>
            )}
            {candidate.opportunity && (
              <p className="mt-3 text-xs font-bold text-emerald-300">
                {candidate.opportunity.labels.join(" / ")} / 1000表示あたり推定 ¥{candidate.opportunity.expectedRewardPer1000Impressions.toLocaleString("ja-JP")}
              </p>
            )}
            {candidate.mediaPlan && (
              <div className="mt-4 rounded-lg border border-cyan-800 bg-cyan-950/30 p-4">
                <p className="text-xs font-black text-cyan-300">見せ方: {candidate.mediaPlan.label}</p>
                <p className="mt-1 text-sm font-black text-white">{candidate.mediaPlan.asset}</p>
                <p className="mt-2 text-xs leading-5 text-cyan-50/80">{candidate.mediaPlan.instruction}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{candidate.mediaPlan.reason}</p>
              </div>
            )}
            {["ranking_card", "comparison_card", "discovery_card", "revenue_data_card"].includes(candidate.creativeStrategy) && (
              <CreativeCardPreview candidate={candidate} />
            )}
            <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/20 p-4">
              <p className="text-xs font-black text-emerald-300">Xに投稿する本文</p>
              <p className="mt-1 text-[11px] font-black text-zinc-500">{candidate.generatorVersion} / {candidate.copyInputHash}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{candidate.product ? publishBody(candidate) : "商品を登録すると候補を生成します。"}</p>
              {candidate.product && <p className="mt-2 text-xs font-black text-zinc-500">文字数 {getXWeightedLength(publishBody(candidate))}</p>}
            </div>
            <div className="mt-3 rounded-lg bg-zinc-950 p-4">
              <p className="text-xs font-black text-zinc-500">Xに投稿する自己リプ</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{selfReplyPreview || "-"}</p>
              {linkRequired && !linkReady && (
                <p className="mt-2 text-xs font-bold leading-5 text-amber-200">リンク未作成/期限切れなので、この自己リプは完成扱いにしません。</p>
              )}
            </div>
            {linkRequired && candidate.product && (
              <div className="mt-3 rounded-lg border border-amber-700 bg-amber-950/25 p-4">
                <p className="text-xs font-black text-amber-200">アフィリンク状態: {myfansAffiliateLinkStatusLabel(linkStatus)}</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  URL有効期限: {candidate.product.affiliate_url_expires_at ? new Date(candidate.product.affiliate_url_expires_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }) : "未確認"} / クリック後の成果判定: {MYFANS_CLICK_ATTRIBUTION_WINDOW_HOURS}時間として別管理
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={candidate.product.product_url || "https://www.affiliate.myfans.jp/dashboard"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-black text-black">
                    <ExternalLink size={15} /> アフィリンクを作る
                  </a>
                  <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionまたはコピーで取得</span>
                </div>
                <form onSubmit={(event) => { event.preventDefault(); saveAffiliateLink(candidate, event.currentTarget); }} className="mt-3 grid gap-2">
                  <input name="affiliate_url" type="url" required defaultValue={candidate.product.affiliate_url} placeholder="https://mfco.link/r/..." className={inputClass} />
                  <input name="affiliate_url_expires_at" type="datetime-local" className={inputClass} />
                  <button type="submit" disabled={pendingId === `affiliate-${candidate.product.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">
                    {pendingId === `affiliate-${candidate.product.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                    正規リンクを保存
                  </button>
                </form>
              </div>
            )}
            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <summary className="cursor-pointer text-xs font-black text-zinc-500">内部メモを表示</summary>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{candidate.productReason}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{candidate.mediaPolicy}</p>
            </details>
            <div className="mt-4 grid gap-2">
              {["ranking_card", "comparison_card", "discovery_card"].includes(candidate.creativeStrategy) && (
                <button type="button" disabled={!candidate.product} onClick={() => { try { downloadCardPng(candidate); setMessage({ text: "カード画像をPNGで保存しました。", error: false }); } catch (error) { setMessage({ text: error instanceof Error ? error.message : "画像生成に失敗しました。text onlyで投稿してください。", error: true }); } }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-black disabled:opacity-40"><Download size={15} />画像を保存</button>
              )}
              <button type="button" onClick={() => copy(publishBody(candidate), "Xに投稿する本文")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white"><Copy size={15} />X本文をコピー</button>
              <button type="button" disabled={linkRequired && !linkReady} onClick={() => copy(selfReplyPreview, "Xに投稿する自己リプ")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />X自己リプをコピー</button>
              <button type="button" disabled={!candidate.quoteXUrl} onClick={() => copy(candidate.quoteXUrl, "引用元X URL")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />引用URLをコピー</button>
              <button type="button" disabled={!candidate.affiliateUrl || candidate.linkStrategy === "no_link" || candidate.linkStrategy === "profile_cta"} onClick={() => copy(candidate.affiliateUrl, "リンク")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />リンクをコピー</button>
              {candidate.ogpCheckRequired && <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-700 px-3 text-xs font-black text-cyan-200"><ImageIcon size={15} />OGPを確認</span>}
            {candidate.product ? (
                <a href={`https://x.com/intent/post?text=${encodeURIComponent(publishBody(candidate))}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white"><ExternalLink size={15} />X投稿画面を開く</a>
              ) : (
                <button type="button" disabled className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-zinc-500"><ExternalLink size={15} />X投稿画面を開く</button>
              )}
              <button type="button" disabled={!candidate.product || pendingId === candidate.id || (linkRequired && !linkReady)} onClick={() => createCandidate(candidate)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50"><Save size={15} />投稿ログへ保存</button>
            </div>
                </>
              );
            })()}
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-black">投稿後の登録と成績記録</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Xへ手動投稿しただけではここには増えません。投稿URLを貼って保存すると、投稿済みとして記録されます。</p>
          </div>
          <p className="text-xs font-black text-emerald-300">未入力の投稿: {postedPosts.length}件</p>
        </div>
        <div className="mt-4 space-y-4">
          {postedPosts.map((post) => (
            <article key={post.id} className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs font-black text-emerald-300">{post.status} / {post.link_strategy ?? "未設定"} / {post.post_type}</p>
              {(() => {
                const copy = postDisplayCopy(post);
                return (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs font-black text-zinc-500">{copy.label}</p>
                    {copy.warning && <p className="mt-2 text-xs font-bold leading-5 text-amber-200">{copy.warning}</p>}
                    {copy.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{copy.body}</p>}
                  </div>
                );
              })()}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => updatePost(post, "posted")} disabled={pendingId === post.id} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black"><Check size={15} />投稿済みにする</button>
                {post.x_post_url && <a href={post.x_post_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black"><ExternalLink size={15} />投稿URL</a>}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); updatePost(post, "url", event.currentTarget); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input name="x_post_url" type="url" defaultValue={post.x_post_url} placeholder="投稿URL" className={`${inputClass} min-w-0 flex-1`} />
                <button type="submit" className="h-11 rounded-lg bg-cyan-700 px-4 text-xs font-black">投稿URLを保存</button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); updatePost(post, "metrics", event.currentTarget); }} className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-xs font-black text-emerald-300">おすすめ：投稿から24時間後の数字を入力</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {metricFields.map((field) => (
                    <label key={field.name} className="grid min-w-0 gap-1.5 text-xs font-bold text-zinc-300">
                      <span>{field.label}</span>
                      <span className="min-h-8 text-[11px] leading-4 text-zinc-500">{field.description}</span>
                      <input
                        name={field.name}
                        type="number"
                        min="0"
                        defaultValue={field.name === "clicks" ? post.clicks ?? 0 : post[field.name]}
                        className={`${inputClass} w-full min-w-0`}
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="mt-3 h-11 w-full rounded-lg bg-cyan-700 px-4 text-xs font-black sm:w-auto">この成績を保存</button>
              </form>
            </article>
          ))}
          {!postedPosts.length && <p className="text-sm text-zinc-500">成績入力待ちの投稿はありません。Xに投稿した後、投稿URLを保存するとここに出ます。</p>}
        </div>
        {recordedPosts.length > 0 && (
          <details className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <summary className="cursor-pointer text-xs font-black text-zinc-500">入力済み履歴（直近{recordedPosts.length}件）</summary>
            <div className="mt-3 grid gap-2">
              {recordedPosts.map((post) => (
                <div key={post.id} className="rounded-md bg-zinc-900 p-3 text-xs leading-5 text-zinc-400">
                  <p className="font-black text-zinc-200">{post.metrics_recorded_at?.slice(0, 16).replace("T", " ")} 入力済み</p>
                  <p>表示 {post.impressions.toLocaleString("ja-JP")} / いいね {post.likes_count.toLocaleString("ja-JP")} / RP {post.reposts_count.toLocaleString("ja-JP")} / 返信 {post.replies_count.toLocaleString("ja-JP")} / クリック {(post.clicks ?? 0).toLocaleString("ja-JP")}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

export function AffiliatePasteImportForm() {
  const { pending, message, submit } = useMyfansSubmit("myfans画面コピーから商品候補を登録しました。");

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-amber-800/60 bg-zinc-950/80 p-4">
      <input type="hidden" name="action" value="affiliate_text_import" />
      <div className="flex flex-wrap gap-3">
        <a
          href="https://www.affiliate.myfans.jp/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-400 px-5 text-sm font-black text-amber-100 transition hover:bg-amber-950/40 disabled:cursor-wait disabled:opacity-60"
        >
          <ExternalLink size={17} />
          myfans管理画面を開く
        </a>
        <SubmitButton pending={pending} label="貼り付け内容から候補登録" />
      </div>
      <Field label="myfans管理画面からコピーした内容">
        <textarea
          name="affiliate_text"
          required
          className={`${textareaClass} min-h-36`}
          placeholder="クリエイター詳細、商品詳細、または最近生成したURLの表示内容をここに貼り付け"
        />
      </Field>
      <div className="mt-3"><StatusMessage message={message} /></div>
      <p className="mt-2 text-xs leading-5 text-amber-100/70">
        通常のChromeでmyfansにログイン済みの画面を使います。ログイン突破、パスワード保存、X API投稿は行いません。
      </p>
    </form>
  );
}

function QuickProductForm() {
  const { pending, message, submit } = useMyfansSubmit("商品候補を保存しました。");

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-amber-800/60 bg-zinc-950/80 p-4 lg:grid-cols-3">
      <input type="hidden" name="action" value="product" />
      <input type="hidden" name="status" value="candidate" />
      <input type="hidden" name="approved_media_name" value="@lumi_reviw" />
      <Field label="商品名"><input name="title" required className={inputClass} /></Field>
      <Field label="商品URL"><input name="product_url" type="url" className={inputClass} /></Field>
      <Field label="アフィリンク"><input name="affiliate_url" type="url" className={inputClass} /></Field>
      <Field label="ジャンル"><input name="genre" className={inputClass} /></Field>
      <Field label="価格"><input name="price" type="number" min="0" className={inputClass} /></Field>
      <Field label="報酬率 %"><input name="reward_rate" type="number" min="0" step="0.01" className={inputClass} /></Field>
      <Field label="引用元X URL"><input name="source_x_url" type="url" className={inputClass} /></Field>
      <Field label="いいね"><input name="likes_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="保存"><input name="saves_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="選定理由"><textarea name="selection_reason" className={`${textareaClass} lg:col-span-3`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <SubmitButton pending={pending} label="商品候補を追加" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function ClickForm({ products, posts }: { products: MyfansProduct[]; posts: MyfansXPost[] }) {
  const { pending, message, submit } = useMyfansSubmit("クリック実績を追加しました。");
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-4">
      <input type="hidden" name="action" value="click" />
      <Field label="商品"><select name="product_id" className={inputClass}><option value="">未選択</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
      <Field label="投稿"><select name="x_post_id" className={inputClass}><option value="">未選択</option>{posts.map((post) => <option key={post.id} value={post.id}>{post.body.slice(0, 40)}</option>)}</select></Field>
      <Field label="日時"><input name="clicked_at" type="datetime-local" className={inputClass} /></Field>
      <Field label="配置"><select name="placement" className={inputClass}><option value="self_reply">自己リプ</option><option value="body">本文</option><option value="fixed_post">固定投稿</option><option value="profile">プロフィール</option><option value="manual">手動</option><option value="other">その他</option></select></Field>
      <Field label="メモ"><input name="note" className={inputClass} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60">
          {pending ? <LoaderCircle size={17} className="animate-spin" /> : <MousePointerClick size={17} />}
          クリックを追加
        </button>
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function RevenueImportForm() {
  const { pending, message, submit } = useMyfansSubmit("CSVを取り込みました。");
  const month = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date()).slice(0, 7);
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <input type="hidden" name="action" value="revenue_import" />
      <Field label="対象月"><input type="month" name="reportMonth" defaultValue={month} required className={inputClass} /></Field>
      <Field label="myfansレポートCSV"><input type="file" name="file" accept=".csv,text/csv" required className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:border-0 file:bg-transparent file:font-bold file:text-emerald-400" /></Field>
      <button type="submit" disabled={pending} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <FileUp size={17} />}
        CSV取込
      </button>
      <div className="lg:col-span-3"><StatusMessage message={message} /></div>
    </form>
  );
}

export function XAccountMetricForm({ media }: { media: MyfansApprovedMedia[] }) {
  const { pending, message, submit } = useMyfansSubmit("Xアカウント成長の週次記録を保存しました。");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-4">
      <input type="hidden" name="action" value="x_account_metric" />
      <Field label="週の終了日"><input name="metric_date" type="date" defaultValue={today} required className={inputClass} /></Field>
      <Field label="承認済みメディア"><select name="approved_media_id" required className={inputClass}><option value="">選択</option>{media.map((item) => <option key={item.id} value={item.id}>{item.media_name}</option>)}</select></Field>
      <Field label="週末時点フォロワー数"><input name="followers_count" type="number" min="0" required className={inputClass} /></Field>
      <Field label="週末時点フォロー数"><input name="following_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間プロフィール遷移"><input name="profile_visits" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間総表示"><input name="total_impressions" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間投稿数"><input name="posts_count" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間いいね"><input name="likes" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間リポスト"><input name="reposts" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間返信"><input name="replies" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間アフィクリック"><input name="affiliate_clicks" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間CV"><input name="conversions" type="number" min="0" className={inputClass} /></Field>
      <Field label="週間報酬"><input name="reward_amount" type="number" min="0" className={inputClass} /></Field>
      <Field label="週次メモ"><textarea name="notes" className={`${textareaClass} lg:col-span-4`} /></Field>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        <SubmitButton pending={pending} label="週次記録を保存" />
        <StatusMessage message={message} />
      </div>
    </form>
  );
}

export function XMetricsSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/myfans/x-metrics-sync", { method: "POST" });
      const payload = (await response.json()) as { error?: string; message?: string; checked?: number; updated?: number; failed?: number };
      if (!response.ok) throw new Error(payload.error ?? "同期に失敗しました。");
      setMessage({
        text: payload.message ?? `確認${payload.checked ?? 0}件、更新${payload.updated ?? 0}件、失敗${payload.failed ?? 0}件`,
        error: false,
      });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "同期に失敗しました。", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
        {pending ? "同期中" : "X投稿成績を同期"}
      </button>
      <StatusMessage message={message} />
    </div>
  );
}

export function BulkProductGuide() {
  const { pending, message, submit } = useMyfansSubmit("商品CSVを取り込みました。");
  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm leading-7 text-zinc-300">
      <div className="flex items-center gap-2 font-black text-white"><Plus size={17} /> 初期20〜30件の登録導線</div>
      <p className="mt-2 text-zinc-400">CSVヘッダーは title, product_url, affiliate_url, source_x_url, genre, price, reward_rate, likes_count, saves_count, selection_reason が使えます。日本語ヘッダーも一部対応しています。</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="action" value="product_import" />
        <Field label="商品CSV"><input type="file" name="file" accept=".csv,text/csv" required className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:border-0 file:bg-transparent file:font-bold file:text-emerald-400" /></Field>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
          {pending ? <LoaderCircle size={17} className="animate-spin" /> : <FileUp size={17} />}
          一括登録
        </button>
        <StatusMessage message={message} />
      </form>
    </section>
  );
}
