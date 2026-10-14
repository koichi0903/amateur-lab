"use client";

import Link from "next/link";
import WorkImage from "@/components/home/WorkImage";
import type { RecentReleaseWork } from "@/lib/bijyoReservedWorkflow";
import { BijyoReservedActions } from "./BijyoReservedActions";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function BijyoReservedWorkCard({ work, allowWorkSkip = true }: { work: RecentReleaseWork; allowWorkSkip?: boolean }) {
  return <article className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-48"><WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 160px, 192px" className="object-contain" /></div>
    <div className="min-w-0 flex-1"><Link href={`/works/${work.id}`} target="_blank" className="line-clamp-2 font-black text-cyan-300">{work.title}</Link><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>work_id: <strong className="text-white">{work.id}</strong></span><span>発売日: <strong className="text-white">{work.release_date}</strong></span><span>登録日: <strong className="text-white">{dateLabel(work.created_at)}</strong></span><span>sample video: <strong className="text-emerald-300">あり</strong></span></div></div>
    <div className="flex shrink-0 items-center gap-3"><span className="rounded-full border border-emerald-700 px-2.5 py-1 text-xs font-bold text-emerald-200">未投稿</span><BijyoReservedActions workId={work.id} manualLabel="手動追加" allowWorkSkip={allowWorkSkip} allowWorkManualAdd={work.manualEligible === true} /></div>
  </article>;
}
