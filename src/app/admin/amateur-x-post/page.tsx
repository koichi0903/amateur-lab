import Link from "next/link";
import { AmateurXPostConsole } from "./AmateurXPostConsole";

export const dynamic = "force-dynamic";

export default function AmateurXPostPage() {
  return <main className="min-h-screen bg-zinc-950 p-6 text-white md:p-10">
    <div className="mx-auto max-w-7xl">
      <Link href="/admin" className="text-sm text-cyan-300">← ADMIN</Link>
      <div className="mt-4">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">手動投稿司令塔</p>
        <h1 className="mt-2 text-4xl font-black">FANZA素人動画 手動投稿</h1>
        <p className="mt-2 text-zinc-400">複数アカウント共通の投稿リストです。アカウントを選ばず候補動画・本文・自己リプを準備し、投稿後のX URLから実際の投稿先を記録します。</p>
      </div>
      <AmateurXPostConsole />
    </div>
  </main>;
}

