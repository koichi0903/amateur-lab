'use client';

import { useState } from "react";
import { historyBlockStart } from "./ui";

type HistoryJob = {
  id: number; work_id: number; kind: "auto" | "manual"; slot_index: number | null; scheduled_at: string;
  status: string; trim_start_seconds: number; trim_status: string; main_text: string; reply_text: string;
  posted_at: string | null; failure_reason: string | null; skip_reason: string | null; trim_failure_reason: string | null;
  work?: { title: string } | null;
};

const STATUS_LABELS: Record<string, string> = { pending: "未投稿", posted: "投稿済み", manual_posted: "投稿済み（手動）", skipped: "スキップ", excluded: "対象外", trim_failed: "trimエラー" };

function dateLabel(value: string) { return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function BijyoHistory({ initialJobs, initialHasMore }: { initialJobs: HistoryJob[]; initialHasMore: boolean }) {
  const [blocks, setBlocks] = useState<HistoryJob[][]>([initialJobs]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [busy, setBusy] = useState(false);

  async function loadNext() {
    if (busy || !hasMore) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/bijyo-reserved?historyPage=${blocks.length + 1}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("履歴を取得できませんでした。");
      const data = await response.json() as { jobs?: HistoryJob[]; historyHasMore?: boolean };
      const next = data.jobs ?? [];
      setBlocks((current) => [...current, next]);
      setHasMore(data.historyHasMore === true);
    } finally { setBusy(false); }
  }

  return <div className="mt-4 space-y-3">{blocks.map((jobs, index) => <details key={index} open={index === 0} className="overflow-hidden rounded-lg border border-zinc-800"><summary className="cursor-pointer bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-300">{index === 0 ? "最新20件" : `過去${historyBlockStart(index + 1)}〜${historyBlockStart(index + 1) + jobs.length - 1}件`}（{jobs.length}件）</summary><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="text-zinc-500"><tr><th className="p-2">日時</th><th className="p-2">区分</th><th className="p-2">slot</th><th className="p-2">work/title</th><th className="p-2">trim</th><th className="p-2">status</th><th className="p-2">理由</th><th className="p-2">本文 / 自己リプ</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-t border-zinc-800 align-top"><td className="p-2">{dateLabel(job.posted_at ?? job.scheduled_at)}</td><td className="p-2">{job.kind === "manual" ? "manual" : "自動予約"}</td><td className="p-2">{job.slot_index == null ? "追加" : `${job.slot_index + 1}枠`}</td><td className="p-2">{job.work_id}<br />{job.work?.title ?? "-"}</td><td className="p-2">{Number(job.trim_start_seconds).toFixed(1)}秒<br />{job.trim_status}</td><td className="p-2">{STATUS_LABELS[job.status] ?? job.status}</td><td className="p-2">{job.skip_reason ?? job.failure_reason ?? job.trim_failure_reason ?? "-"}</td><td className="whitespace-pre-wrap p-2">{job.main_text}<br /><span className="text-violet-200">{job.reply_text}</span></td></tr>)}</tbody></table></div></details>)}{!blocks.some((jobs) => jobs.length) && <p className="p-6 text-sm text-zinc-500">履歴はまだありません。</p>}{hasMore && <div className="flex justify-center"><button type="button" onClick={loadNext} disabled={busy} className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-black text-violet-200 disabled:opacity-50">{busy ? "読み込み中…" : "さらに20件表示"}</button></div>}</div>;
}
