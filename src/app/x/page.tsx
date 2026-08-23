import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgePercent, Flame, Sparkles, Star } from "lucide-react";
import { getXGrowthHubData, type XHubWork } from "@/lib/xGrowthHub";
import { workDetailHref } from "@/lib/affiliateTracking";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = pageMetadata({
  title: "Xから来た人向けのFANZA作品メモ | 発掘LAB",
  description: "価格、サンプル、レビュー数、セール情報から、X経由で見やすいFANZA作品を整理しています。",
  canonical: "/x",
  robots: { index: false, follow: true },
});

function priceOf(work: XHubWork) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
}

function WorkCard({ work, reason }: { work: XHubWork; reason: string }) {
  const price = priceOf(work);

  return (
    <Link
      href={workDetailHref(work.id, "x")}
      className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition hover:border-pink-500 hover:bg-zinc-900/80"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-800">
        {work.image_url ? (
          <Image src={work.image_url} alt={work.title} fill sizes="76px" className="object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-black text-white">{work.title}</p>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{work.actress ?? work.genre ?? "作品情報"}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{reason}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black">
          {price ? <span className="rounded-full bg-pink-950 px-2 py-1 text-pink-300">¥{price.toLocaleString("ja-JP")}</span> : null}
          {work.discount_rate ? <span className="rounded-full bg-emerald-950 px-2 py-1 text-emerald-300">{Math.round(work.discount_rate)}%OFF</span> : null}
          {work.review_average ? <span className="rounded-full bg-amber-950 px-2 py-1 text-amber-300">評価 {work.review_average.toFixed(1)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function Section({
  title,
  icon,
  works,
  reason,
}: {
  title: string;
  icon: ReactNode;
  works: XHubWork[];
  reason: (work: XHubWork) => string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-black text-white">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {works.slice(0, 4).map((work) => (
          <WorkCard key={work.id} work={work} reason={reason(work)} />
        ))}
      </div>
    </section>
  );
}

export default async function XLandingPage() {
  const data = await getXGrowthHubData();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-pink-400">X向け入口</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">迷ったときに見るFANZA作品メモ</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              価格、サンプル、レビュー数、セール状況を見て、選びやすい候補だけをまとめています。
            </p>
          </div>
          <Link
            href="/sale?from=x"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-pink-100"
          >
            セール一覧へ <ArrowRight size={16} />
          </Link>
        </div>

        {data.error && (
          <p className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
            一部の作品データを取得できませんでした: {data.error}
          </p>
        )}

        <Section
          title="今日まず見る候補"
          icon={<Flame className="text-pink-400" size={20} />}
          works={data.recommended}
          reason={(work) => `発掘スコア${work.score ?? 0}。迷ったときに最初に確認しやすい候補です。`}
        />
        <Section
          title="セールで候補に入れたい作品"
          icon={<BadgePercent className="text-emerald-400" size={20} />}
          works={data.deals}
          reason={(work) => `${Math.round(work.discount_rate ?? 0)}%OFF。安さだけでなくサンプル確認までがおすすめです。`}
        />
        <Section
          title="評価から選びたい人向け"
          icon={<Star className="text-amber-300" size={20} />}
          works={data.highScore}
          reason={(work) => `評価${work.review_average?.toFixed(1) ?? "-"}、レビュー${work.review_count ?? 0}件。判断材料が多めです。`}
        />
        <Section
          title="新作から探す"
          icon={<Sparkles className="text-cyan-300" size={20} />}
          works={data.newest}
          reason={() => "新作はまずサンプルの雰囲気を見て、好みに合うか確認するのがよさそうです。"}
        />
      </div>
    </main>
  );
}
