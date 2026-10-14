"use client";

import { useState } from "react";
import ManualXImpressionInput from "./ManualXImpressionInput";
import RegisterXPostUrlInput from "./RegisterXPostUrlInput";

const PAGE_SIZE = 20;

type QueueRow = {
  postKey: string;
  account: "hakkutsu_lab" | "bijyo1010";
  title: string;
  postedAt: string;
  xPostId?: string | null;
};

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function QueuePagination({ page, pageCount, total, onPageChange }: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;
  const first = page * PAGE_SIZE + 1;
  const last = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <nav aria-label="投稿タスクのページ" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
      <p aria-live="polite" className="text-xs font-bold text-zinc-300">{first}–{last}件 / 全{total}件</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 0} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">前へ</button>
        <span className="min-w-16 text-center text-xs font-bold text-zinc-400">{page + 1} / {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pageCount} className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-black text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">次へ</button>
      </div>
    </nav>
  );
}

export default function XDailyTaskQueue({ kind, rows }: { kind: "unlinked" | "due"; rows: QueueRow[] }) {
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isUnlinked = kind === "unlinked";

  return (
    <div className="mt-3">
      <QueuePagination page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {visibleRows.map((row) => (
          <article key={`${row.account}:${row.postKey}`} className={`min-w-0 rounded-lg border p-3 ${isUnlinked ? "border-amber-900/70 bg-black" : "border-emerald-900 bg-zinc-950"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-[11px] font-black ${isUnlinked ? "text-amber-200" : "text-emerald-300"}`}>@{row.account} / {isUnlinked ? "URL未登録" : "今すぐ記録"}</p>
              {!isUnlinked && row.xPostId && <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[11px] font-black text-cyan-200 hover:bg-zinc-700">X投稿を開く ↗</a>}
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-white">{row.title}</p>
            <p className="mt-1 text-[10px] text-zinc-500">投稿 {formatJst(row.postedAt)}</p>
            {isUnlinked
              ? <RegisterXPostUrlInput
                  postKey={row.postKey}
                  account={row.account}
                  draftValue={drafts[`${row.account}:${row.postKey}`] ?? ""}
                  onDraftChange={(value) => setDrafts((current) => ({ ...current, [`${row.account}:${row.postKey}`]: value }))}
                />
              : <ManualXImpressionInput
                  postKey={row.postKey}
                  account={row.account}
                  compact
                  draftValue={drafts[`${row.account}:${row.postKey}`] ?? ""}
                  onDraftChange={(value) => setDrafts((current) => ({ ...current, [`${row.account}:${row.postKey}`]: value }))}
                />}
          </article>
        ))}
      </div>
      <QueuePagination page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
    </div>
  );
}
