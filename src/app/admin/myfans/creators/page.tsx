import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { CreatorForm, MediaForm } from "../MyfansAdminForms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyfansCreatorsPage() {
  const analytics = await getMyfansAnalytics();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/myfans" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft size={16} /> myfansへ戻る
        </Link>
        <h1 className="mt-7 text-3xl font-black sm:text-5xl">myfansクリエイター</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          クリエイターごとにジャンル、myfans URL、X URL、活動メモを保持します。
        </p>

        {analytics.error && (
          <section className="mt-8 rounded-xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-200">
            myfans用テーブルが未適用です。
          </section>
        )}

        <CreatorForm />
        <MediaForm />

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-black">承認済みメディア</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {analytics.media.map((item) => (
              <article key={item.id} className="rounded-lg bg-zinc-950 p-4">
                <p className="font-black">{item.media_name}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.affiliate_media_id || "メディアID未設定"} / {item.status}</p>
                {item.media_url && <a href={item.media_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300">URL <ExternalLink size={12} /></a>}
              </article>
            ))}
            {!analytics.media.length && <p className="text-sm text-zinc-500">承認済みメディアはまだありません。</p>}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analytics.creators.map((creator) => (
            <article key={creator.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{creator.display_name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{creator.genre || "ジャンル未設定"}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${creator.is_active ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>
                  {creator.is_active ? "active" : "paused"}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-emerald-300">
                {creator.myfans_url && <a href={creator.myfans_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">myfans <ExternalLink size={14} /></a>}
                {creator.x_url && <a href={creator.x_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">X <ExternalLink size={14} /></a>}
              </div>
            </article>
          ))}
          {!analytics.creators.length && <p className="text-sm text-zinc-500">クリエイターはまだありません。</p>}
        </section>
      </div>
    </main>
  );
}
