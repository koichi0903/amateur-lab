import Link from "next/link";
import { Suspense } from "react";
import { getBijyoManualJobsPage } from "@/lib/bijyoManualJobs";
import { ManualBijyoJobs } from "./ManualBijyoJobs";
import { BijyoHistorySection, BijyoReservedSection, BijyoUpcomingSection } from "./BijyoLazySections";

export const dynamic = "force-dynamic";

function SectionLoading({ label }: { label: string }) {
  return <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5" aria-busy="true"><p className="text-sm text-zinc-400">{label}を読み込み中…</p></section>;
}

export default async function BijyoReservedPage() {
  const manualPage = await getBijyoManualJobsPage();
  return <main className="min-h-screen bg-zinc-950 p-6 text-white md:p-10"><div className="mx-auto max-w-7xl"><Link href="/admin" className="text-sm text-cyan-300">← ADMIN</Link><div className="mt-4"><p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">手動投稿司令塔</p><h1 className="mt-2 text-4xl font-black">@bijyo1010 予約作品 手動投稿</h1><p className="mt-2 text-zinc-400">動画・本文・自己リプを準備して、あなたがXへ手動投稿します。</p></div>
    <nav aria-label="セクション内リンク" className="sticky top-2 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 text-sm shadow-lg shadow-black/20"><a href="#manual" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">手動追加した投稿</a><a href="#upcoming-releases" className="rounded-lg px-3 py-2 text-emerald-200 hover:bg-emerald-950/50">今日から1週間</a><a href="#reserved-works" className="rounded-lg px-3 py-2 text-emerald-200 hover:bg-emerald-950/50">予約作品一覧</a><a href="#history" className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">履歴</a></nav>
    <ManualBijyoJobs initialPage={manualPage} />
    <Suspense fallback={<SectionLoading label="今日から1週間の発売予定作品" />}><BijyoUpcomingSection /></Suspense>
    <Suspense fallback={<SectionLoading label="予約作品一覧" />}><BijyoReservedSection /></Suspense>
    <Suspense fallback={<SectionLoading label="投稿済み履歴" />}><BijyoHistorySection /></Suspense>
  </div></main>;
}