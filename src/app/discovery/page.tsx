import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gem, SearchCheck, ShieldCheck, Star } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";
import { getTodayDiscovery } from "@/lib/getTodayDiscovery";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;

export const metadata: Metadata = pageMetadata({
  title: "今日の発掘作品 | 評価と価格で見つける候補 | 発掘LAB",
  description:
    "ランキング上位の定番作だけでなく、評価、レビュー件数、価格条件、買うタイミングに強みがある作品を埋もれ度で紹介します。",
  canonical: "/discovery",
});

function formatPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "確認中";
}

function formatRanking(value: number | null | undefined) {
  return value && value > 0 && value < 9999 ? `${value}位` : "圏外/未取得";
}

function compactReasons(reasons: string[]) {
  return reasons.slice(0, 3);
}

export default async function DiscoveryPage() {
  const works = await getTodayDiscovery(30);
  const structuredItems = works.map((work) => ({
    name: work.title,
    url: `${SITE_URL}/works/${work.id}`,
    image: work.image_url,
  }));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="今日の発掘作品"
          description="ランキングだけでは見落としやすい高評価・好条件作品の一覧です。"
          url={`${SITE_URL}/discovery`}
          items={structuredItems}
        />

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              TOP / 今日の発掘作品
            </Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <Gem size={30} />
              </span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-600">
                  HIDDEN GEM RANKING
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  今日の発掘作品
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                  FANZAランキング上位の定番作だけに寄せず、評価・レビュー件数・価格条件に強みがある作品を拾います。迷ったら上から数本を比較してください。
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 border-y border-emerald-100 bg-emerald-50/40 p-5 text-sm font-bold leading-6 text-slate-600 sm:grid-cols-3">
              <p className="flex gap-2">
                <SearchCheck className="shrink-0 text-emerald-600" size={20} />
                定番以外も候補化
              </p>
              <p className="flex gap-2">
                <Star className="shrink-0 text-amber-500" size={20} />
                評価とレビュー件数を信頼度補正
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="shrink-0 text-sky-600" size={20} />
                少ないPVのCTRを補正
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {works.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-12 text-center">
              <p className="font-black text-slate-800">発掘データを更新しています</p>
              <p className="mt-2 text-sm text-slate-500">
                レビュー、価格履歴、ランキングの取得後に再読み込みしてください。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {works.map((work, index) => (
                <article
                  key={work.id}
                  className="group border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
                >
                  <div className="grid gap-4 md:grid-cols-[160px_1fr] lg:grid-cols-[180px_1fr_auto]">
                    <Link
                      href={workDetailHref(work.id, "discovery")}
                      className="relative aspect-[4/3] overflow-hidden bg-slate-100 md:aspect-[3/4]"
                    >
                      <WorkImage
                        src={work.image_url}
                        alt={work.title}
                        sizes="(max-width: 768px) 92vw, 180px"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-black text-white">
                        {index + 1}位
                      </span>
                    </Link>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          埋もれ度 {work.discovery.score}/100
                        </span>
                        <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-700">
                          判断 {work.buyTiming.score}/100
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {work.discovery.label}
                        </span>
                      </div>

                      <h2 className="mt-3 line-clamp-2 break-all text-lg font-black leading-7 sm:text-xl">
                        <Link href={workDetailHref(work.id, "discovery")} className="hover:text-emerald-600">
                          {work.title}
                        </Link>
                      </h2>

                      <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                        <p className="bg-slate-50 px-3 py-2">評価 {work.review_average?.toFixed(2) ?? "未取得"}</p>
                        <p className="bg-slate-50 px-3 py-2">レビュー {work.review_count ?? 0}件</p>
                        <p className="bg-slate-50 px-3 py-2">ランキング {formatRanking(work.ranking)}</p>
                        <p className="bg-slate-50 px-3 py-2">割引 {work.discovery.discountRate}%OFF</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-2xl font-black text-emerald-600">
                          {formatPrice(work.discovery.currentPrice)}
                        </span>
                        {work.discovery.regularPrice &&
                          work.discovery.currentPrice &&
                          work.discovery.regularPrice > work.discovery.currentPrice && (
                            <span className="text-sm font-bold text-slate-400 line-through">
                              {formatPrice(work.discovery.regularPrice)}
                            </span>
                          )}
                        <span className="text-xs font-bold text-amber-700">
                          {work.discovery.lowestPriceText}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {compactReasons(work.discovery.reasons).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between border-t border-slate-100 pt-4 lg:w-56 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                      <div className="space-y-2 text-[11px] font-bold leading-5 text-slate-500">
                        <p>既存発掘スコア {Math.round(work.score ?? 0)}</p>
                        <p>定番外の加点 {work.discovery.hiddenRankBonus}</p>
                        <p>
                          直近30日 PV {work.buyTiming.funnel.pageViews} / 送客 {work.buyTiming.funnel.fanzaClicks} / 補正CTR {work.buyTiming.funnel.adjustedCtr}%
                        </p>
                      </div>
                      <Link
                        href={workDetailHref(work.id, "discovery")}
                        className="mt-4 flex h-11 items-center justify-center gap-2 bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                      >
                        詳細を見る <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
