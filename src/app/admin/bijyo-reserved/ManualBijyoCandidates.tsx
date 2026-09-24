'use client';

import Link from "next/link";
import { useState } from "react";
import { BijyoReservedActions } from "./BijyoReservedActions";
import { MANUAL_CANDIDATE_INITIAL_LIMIT, MANUAL_CANDIDATE_PAGE_SIZE, visibleManualCandidateCount } from "./ui";

type Candidate = { id: number; title: string; created_at: string; release_date: string };

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function remaining(value: string) {
  return Math.max(0, Math.ceil((new Date(value).getTime() + 7 * 86_400_000 - Date.now()) / 86_400_000));
}

export function ManualBijyoCandidates({ candidates }: { candidates: Candidate[] }) {
  const [visibleCount, setVisibleCount] = useState(MANUAL_CANDIDATE_INITIAL_LIMIT);
  const visibleCandidates = candidates.slice(0, visibleManualCandidateCount(candidates.length, visibleCount));
  const hasMore = visibleCandidates.length < candidates.length;

  return <details className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950">
    <summary className="cursor-pointer list-inside px-4 py-3 text-sm font-bold text-violet-200">追加候補を表示（{candidates.length}件）</summary>
    <div className="overflow-x-auto px-2 pb-2"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs text-zinc-500"><tr><th className="p-2">作品</th><th className="p-2">登録日</th><th className="p-2">候補期限</th><th className="p-2">発売日</th><th className="p-2">操作</th></tr></thead><tbody>{visibleCandidates.map((work) => <tr key={work.id} className="border-t border-zinc-800"><td className="p-2"><Link href={`/works/${work.id}`} target="_blank" className="font-bold text-cyan-300">{work.title}</Link><p className="text-xs text-zinc-600">work_id: {work.id}</p></td><td className="p-2">{dateLabel(work.created_at)}</td><td className="p-2">残り{remaining(work.created_at)}日</td><td className="p-2">{work.release_date}</td><td className="p-2"><BijyoReservedActions workId={work.id} /></td></tr>)}</tbody></table>{!candidates.length && <p className="p-6 text-sm text-zinc-500">現在、条件を満たす待機候補はありません。</p>}{hasMore && <div className="mt-4 flex justify-center"><button type="button" onClick={() => setVisibleCount((current) => current + MANUAL_CANDIDATE_PAGE_SIZE)} className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-black text-violet-200 hover:bg-violet-950/50">もっと見る（残り{candidates.length - visibleCandidates.length}件）</button></div>}</div>
  </details>;
}
