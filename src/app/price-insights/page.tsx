import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeJapaneseYen, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";
import { getTodayBuyTiming } from "@/lib/getTodayBuyTiming";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;

export const metadata: Metadata = pageMetadata({
  title: "今日の買い時ランキング | 価格とレビューで選ぶ | 発掘LAB",
  description:
    "FANZA作品の現在価格、割引、過去最安、レビュー、ランキング、直近30日の送客傾向をもとに、今チェックする理由がある作品を紹介します。",
  canonical: "/price-insights",
});

function formatPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "確認中";
}

function primaryReasons(reasons: string[]) {
  return reasons.slice(0, 2);
}

export default async function PriceInsightsPage() {
  const buyTiming = await getTodayBuyTiming(30);
  const structuredItems = buyTiming.map((work) => ({
    name: work.title,
    url: `${SITE_URL}/works/${work.id}`,
    image: work.image_url,
  }));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="今日の買い時ランキング"
          description="価格・レビュー・収益ファネルを総合した買い時作品ランキングです。"
          url={`${SITE_URL}/price-insights`}
          items={structuredItems}
        />

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              TOP / 今日の買い時
            </Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600">
                <BadgeJapaneseYen size={30} />
              </span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-pink-600">
                  BUY TIMING RANKING
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  今日の買い時ランキング
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                  値下げ幅、過去最安との近さ、レビューの安定感、直近30日の送客傾向を合わせて、今日チェックする理由がある作品を並べています。
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 rounded-2xl border border-pink-100 bg-white p-5 text-sm font-bold leading-6 text-slate-600 sm:grid-cols-3">
              <p className="flex gap-2">
                <ShieldCheck className="shrink-0 text-emerald-600" size={20} />
                少ないPVのCTRは信頼度補正
              </p>
              <p className="flex gap-2">
                <Sparkles className="shrink-0 text-pink-600" size={20} />
                発掘指数とは別に判定
              </p>
              <p className="flex gap-2">
                <TrendingUp className="shrink-0 text-indigo-600" size={20} />
                詳細ページと同じ基準
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {buyTiming.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-12 text-center">
              <p className="font-black text-slate-800">買い時データを更新しています</p>
              <p className="mt-2 text-sm text-slate-500">
                時間をおいて再読み込みしてください。
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {buyTiming.map((work, index) => {
                const decision = work.buyTiming;

                return (
                  <article
                    key={work.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg"
                  >
                    <div className="flex gap-4">
                      <Link
                        href={workDetailHref(work.id, "deals")}
                        className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-40 sm:w-36"
                      >
                        <WorkImage
                          src={work.image_url}
                          alt={work.title}
                          sizes="(max-width: 640px) 112px, 144px"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute left-2 top-2 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-black text-white">
                          {index + 1}位
                        </span>
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-700">
                            判断 {decision.score}/100
                          </span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {decision.label}
                          </span>
                        </div>

                        <h2 className="mt-3 line-clamp-2 break-all text-base font-black leading-6 sm:text-lg">
                          <Link href={workDetailHref(work.id, "deals")} className="hover:text-pink-600">
                            {work.title}
                          </Link>
                        </h2>

                        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-2xl font-black text-pink-600">
                            {formatPrice(decision.currentPrice)}
                          </span>
                          {decision.regularPrice && decision.currentPrice && decision.regularPrice > decision.currentPrice && (
                            <span className="text-sm font-bold text-slate-400 line-through">
                              {formatPrice(decision.regularPrice)}
                            </span>
                          )}
                          {decision.discountRate > 0 && (
                            <span className="text-sm font-black text-red-600">
                              {decision.discountRate}%OFF
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                          {decision.lowestPriceText}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {primaryReasons(decision.reasons).map((reason) => (
                            <span
                              key={reason}
                              className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] font-bold leading-5 text-slate-500">
                        直近30日: PV {decision.funnel.pageViews} / クリック {decision.funnel.fanzaClicks} / 補正CTR {decision.funnel.adjustedCtr}%
                      </p>
                      <Link
                        href={workDetailHref(work.id, "deals")}
                        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-black text-white transition hover:bg-pink-700"
                      >
                        価格と理由を見る <ArrowRight size={16} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
