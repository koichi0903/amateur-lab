type JobCardProps = {
  title: string;
  status: "completed" | "running" | "failed" | "idle";
  processed: number;
  total: number;
};

export default function JobCard({
  title,
  status,
  processed,
  total,
}: JobCardProps) {
  const percent =
    total > 0 ? Math.round((processed / total) * 100) : 0;

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
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-zinc-700">

            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{
                width: `${percent}%`,
              }}
            />

          </div>

          <div className="mt-2 flex justify-end">

            <span className="text-sm font-bold text-purple-300">
              {percent}%
            </span>

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