import Link from "next/link";

const PHASE_LABELS: Record<string, string> = {
  reserve_listing: "予約作品一覧を取得",
  reserve_register: "未登録の予約作品を初回登録",
  reserve_update: "予約作品の価格・発売日を更新",
  ranking_api: "DMMランキング対象作品を取得",
  ranking_register: "未登録作品を初回登録",
  ranking_save: "作品順位を保存",
  ranking_price_scan: "FANZA人気順一覧の価格を照合",
  ranking_playwright: "差分がある作品だけ価格・動画・詳細を補完",
  ranking_popularity: "リアルタイム・日次・週次・月次順位を取得",
  ranking_long_hit: "ロングヒット順位を取得",
  ranking_entities: "女優・ジャンル・メーカー・シリーズ順位を集計",
  ranking_finalize: "ランキング更新を確定",
  score_prepare: "スコア計算データを準備",
  score_calculate: "全作品の発掘スコアを再計算",
  score_statistics: "サイト統計を更新",
};

const STATUS_MAP = {
  completed: { label: "🟢 完了", color: "bg-emerald-500" },
  running: { label: "🟡 更新中", color: "bg-amber-500" },
  failed: { label: "🔴 エラー", color: "bg-red-500" },
  idle: { label: "⚪ 待機中", color: "bg-zinc-500" },
} as const;

type JobCardProps = {
  title: string;
  status: "completed" | "running" | "failed" | "idle";
  processed: number;
  total: number;
  lastProductId: string | null;
  lastProductTitle?: string;
  progressPhase?: string;
  phaseProcessed?: number;
  phaseTotal?: number;
  errorMessage?: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type ProgressMetrics = {
  percent: number;
  speed: number;
  remain: number;
  eta: number;
};

function getProgressMetrics({ processed, total, startedAt, finishedAt }: Pick<JobCardProps, "processed" | "total" | "startedAt" | "finishedAt">): ProgressMetrics {
  const percent = total > 0 ? Math.min(Math.max(Math.round((processed / total) * 100), 0), 100) : 0;
  const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const finishedAtMs = finishedAt ? Date.parse(finishedAt) : Number.NaN;
  // The polling parent re-renders this card, so the running ETA follows wall time.
  const now = Date.now();
  const elapsed = Number.isFinite(startedAtMs)
    ? Math.max(((Number.isFinite(finishedAtMs) ? finishedAtMs : now) - startedAtMs) / 1000, 0)
    : 0;
  const speed = elapsed > 0 ? processed / elapsed : 0;
  const remain = Math.max(total - processed, 0);
  const eta = speed > 0 ? Math.round(remain / speed) : 0;
  return { percent, speed, remain, eta };
}

function JobPhase({ phase, processed, total }: { phase?: string; processed?: number; total?: number }) {
  if (!phase) return null;
  return (
    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">現在の工程</div>
      <div className="mt-1 text-sm font-semibold text-cyan-200">{PHASE_LABELS[phase] ?? phase}</div>
      {total !== undefined && total > 0 && <div className="mt-1 text-xs text-zinc-400">{processed ?? 0} / {total}</div>}
    </div>
  );
}

function JobError({ message, status }: { message: string | null | undefined; status: JobCardProps["status"] }) {
  if (!message) return null;
  const isInformational = message.startsWith("INFO: ");
  const displayMessage = isInformational ? message.slice("INFO: ".length) : message;
  const readableMessage = displayMessage === "[object Object]" || displayMessage === "{}"
    ? "データベースとの通信が一時的に切断されました。再実行すると保存済みの位置から再開します。"
    : displayMessage;
  const color = isInformational
    ? "border-sky-900 bg-sky-950/30 text-sky-200"
    : status === "failed"
    ? "border-red-900 bg-red-950/60 text-red-200"
    : "border-amber-900 bg-amber-950/40 text-amber-200";
  return <div className={`mt-3 whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-sm ${color}`}>{readableMessage}</div>;
}

function CurrentProduct({ id, title }: { id: string | null; title?: string }) {
  if (!id) return null;
  return (
    <div className="mt-3 rounded-lg bg-zinc-800 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">現在処理中</div>
      <Link href={`/works/${id}`} target="_blank" className="mt-1 block font-mono text-sm text-cyan-300 underline hover:text-cyan-200">{id}</Link>
      {title && <Link href={`/works/${id}`} target="_blank" className="mt-2 block text-sm text-white line-clamp-2 hover:text-cyan-300">{title}</Link>}
    </div>
  );
}

function ProgressStats({ metrics, weighted }: { metrics: ProgressMetrics; weighted: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-lg bg-zinc-800 p-2 text-center"><div className="text-[11px] text-zinc-500">SPEED</div><div className="font-bold text-cyan-300">{metrics.speed.toFixed(1)}{weighted ? "%/s" : "/s"}</div></div>
      <div className="rounded-lg bg-zinc-800 p-2 text-center"><div className="text-[11px] text-zinc-500">LEFT</div><div className="font-bold text-white">{metrics.remain}{weighted ? "%" : ""}</div></div>
      <div className="rounded-lg bg-zinc-800 p-2 text-center"><div className="text-[11px] text-zinc-500">ETA</div><div className="font-bold text-amber-300">{metrics.eta}s</div></div>
    </div>
  );
}

function JobProgress({ title, metrics, lastProductId, lastProductTitle, weighted }: { title: string; metrics: ProgressMetrics; lastProductId: string | null; lastProductTitle?: string; weighted: boolean }) {
  return (
    <>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div role="progressbar" aria-label={`${title}の進捗`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.percent} className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 transition-all duration-500" style={{ width: `${metrics.percent}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400"><span>Progress</span><span>{metrics.percent}%</span></div>
      <CurrentProduct id={lastProductId} title={lastProductTitle} />
      <ProgressStats metrics={metrics} weighted={weighted} />
    </>
  );
}

function EmptyJobState({ status }: { status: JobCardProps["status"] }) {
  return status === "running"
    ? <div className="mt-6 text-center text-amber-300">処理対象を確認しています</div>
    : <div className="mt-6 text-center text-zinc-500">更新対象はありません</div>;
}

export default function JobCard({
  title,
  status,
  processed,
  total,
  lastProductId,
  lastProductTitle,
  progressPhase,
  phaseProcessed,
  phaseTotal,
  errorMessage,
  startedAt,
  finishedAt,
}: JobCardProps) {
  const metrics = getProgressMetrics({ processed, total, startedAt, finishedAt });
  const current = STATUS_MAP[status];
  const isWeightedRankingProgress = progressPhase?.startsWith("ranking_") ?? false;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg transition hover:border-purple-500">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <span className={`${current.color} rounded-full px-3 py-1 text-sm font-bold text-white`}>{current.label}</span>
      </div>
      <div className="mt-4 text-sm text-zinc-400">{processed} / {total}</div>
      <JobPhase phase={progressPhase} processed={phaseProcessed} total={phaseTotal} />
      <JobError message={errorMessage} status={status} />
      {total > 0 && <JobProgress title={title} metrics={metrics} lastProductId={lastProductId} lastProductTitle={lastProductTitle} weighted={isWeightedRankingProgress} />}
      {total === 0 && <EmptyJobState status={status} />}
    </div>
  );
}
