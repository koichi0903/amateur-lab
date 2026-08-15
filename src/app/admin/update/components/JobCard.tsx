import Link from "next/link";

type JobCardProps = {
  title: string;
  status: "completed" | "running" | "failed" | "idle";
  processed: number;
  total: number;
  lastProductId: string | null;
  lastProductTitle?: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export default function JobCard({
  title,
  status,
  processed,
  total,
  lastProductId,
  lastProductTitle,
  startedAt,
  finishedAt,
}: JobCardProps) {
  
  const percent =
  total > 0 ? Math.round((processed / total) * 100) : 0;

const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
const finishedAtMs = finishedAt ? Date.parse(finishedAt) : Number.NaN;
// The polling parent re-renders this card, so the running ETA follows wall time.
// eslint-disable-next-line react-hooks/purity
const now = Date.now();
const elapsed = Number.isFinite(startedAtMs)
  ? Math.max(
      ((Number.isFinite(finishedAtMs) ? finishedAtMs : now) - startedAtMs) /
        1000,
      0,
    )
  : 0;

const speed =
  elapsed > 0 ? processed / elapsed : 0;

const remain = Math.max(total - processed, 0);

const eta =
  speed > 0
    ? Math.round(remain / speed)
    : 0;

  const statusMap = {
    completed: {
      label: "🟢 完了",
      color: "bg-emerald-500",
    },
    running: {
      label: "🟡 更新中",
      color: "bg-amber-500",
    },
    failed: {
      label: "🔴 エラー",
      color: "bg-red-500",
    },
    idle: {
      label: "⚪ 待機中",
      color: "bg-zinc-500",
    },
  };

  const current =
    statusMap[status] ??
    {
      label: status,
      color: "bg-zinc-500",
    };

  return (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg transition hover:border-purple-500">

    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-white">
        {title}
      </h2>

      <span
        className={`${current.color} rounded-full px-3 py-1 text-sm font-bold text-white`}
      >
        {current.label}
      </span>
    </div>

    <div className="mt-4 text-sm text-zinc-400">
      {processed} / {total}
    </div>

    {total > 0 && (
      <>
        {/* プログレスバー */}
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 transition-all duration-500"
            style={{
              width: `${percent}%`,
            }}
          />
        </div>

        {/* パーセンテージ */}
        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>Progress</span>
          <span>{percent}%</span>
        </div>
        
        {lastProductId && (
  <div className="mt-3 rounded-lg bg-zinc-800 px-3 py-2">
    <div className="text-[11px] uppercase tracking-wider text-zinc-500">
      現在処理中
    </div>

    <Link
  href={`/works/${lastProductId}`}
  target="_blank"
  className="mt-1 block font-mono text-sm text-cyan-300 underline hover:text-cyan-200"
>
  {lastProductId}
</Link>

    {lastProductTitle && (
      <Link
  href={`/works/${lastProductId}`}
  target="_blank"
  className="mt-2 block text-sm text-white line-clamp-2 hover:text-cyan-300"
>
  {lastProductTitle}
</Link>
    )}
  </div>
)}

<div className="mt-3 grid grid-cols-3 gap-2">

  <div className="rounded-lg bg-zinc-800 p-2 text-center">
    <div className="text-[11px] text-zinc-500">
      SPEED
    </div>

    <div className="font-bold text-cyan-300">
      {speed.toFixed(1)}/s
    </div>
  </div>

  <div className="rounded-lg bg-zinc-800 p-2 text-center">
    <div className="text-[11px] text-zinc-500">
      LEFT
    </div>

    <div className="font-bold text-white">
      {remain}
    </div>
  </div>

  <div className="rounded-lg bg-zinc-800 p-2 text-center">
    <div className="text-[11px] text-zinc-500">
      ETA
    </div>

    <div className="font-bold text-amber-300">
      {eta}s
    </div>
  </div>

</div>
      </> 
    )}

    {total === 0 && (
      <div className="mt-6 text-center text-zinc-500">
        更新対象はありません
      </div>
    )}

  </div>
);
}
