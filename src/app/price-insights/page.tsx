import type { Metadata } from "next";
import Link from "next/link";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import MiniPriceHistoryChart from "@/components/home/MiniPriceHistoryChart";
import { getHomePriceInsights } from "@/lib/getHomePriceInsights";
import { workDetailHref } from "@/lib/affiliateTracking";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "FANZA価格推移・今日の買い時ランキング | 発掘LAB",
  description:
    "FANZA作品の過去90日価格と現在価格を比較し、値下がり幅や過去最安値から今日の買い時作品をランキングで紹介します。",
  canonical: "/price-insights",
});

export default async function PriceInsightsPage() {
  const priceInsights = await getHomePriceInsights().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[price-insights] data is temporarily unavailable: ${message}`);
    return null;
  });
  const buyTiming = priceInsights?.buyTiming ?? [];
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
          title="FANZA価格推移・今日の買い時ランキング"
          description="過去90日の価格推移と現在価格を比較した買い時作品のランキングです。"
          url={`${SITE_URL}/price-insights`}
          items={structuredItems}
        />
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500">
              TOP / 価格推移 / 今日の買い時ランキング
            </Link>
            <p className="mt-5 text-xs font-black tracking-[.18em] text-pink-600">
              PRICE INTELLIGENCE
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">今日の買い時ランキング</h1>
            <p className="mt-3 text-sm text-slate-600">
              過去90日の値下がりと現在価格を比較し、買い時の作品を表示しています。
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
          {buyTiming.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-12 text-center">
              <p className="font-black text-slate-800">価格データを更新しています</p>
              <p className="mt-2 text-sm text-slate-500">
                時間をおいて再読み込みしてください。
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {buyTiming.map((work, index) => {
                const price = work.currentPrice;
                const activeSale = Boolean(
                  work.sale_price > 0 && work.sale_price === price && work.sale_end_at,
                );
                const regular =
                  work.list_price && work.list_price > price ? work.list_price : work.price;
                const discount =
                  regular > price ? Math.round((1 - price / regular) * 100) : 0;

                return (
                  <Link
                    key={work.id}
                    href={workDetailHref(work.id, "home")}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <WorkImage
                          src={work.image_url}
                          alt={work.title}
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-pink-600">{index + 1}位</p>
                        <h2 className="mt-2 line-clamp-3 text-sm font-black leading-5">
                          {work.title}
                        </h2>
                        <p className="mt-2 text-lg font-black text-pink-600">
                          ¥{price.toLocaleString("ja-JP")}{" "}
                          {activeSale && regular > price && (
                            <span className="text-xs text-slate-400 line-through">
                              ¥{regular.toLocaleString("ja-JP")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
                      {activeSale && discount > 0 ? (
                        <span className="font-black text-pink-600">{discount}%OFF</span>
                      ) : (
                        <span className="font-black text-slate-600">
                          価格 ¥{price.toLocaleString("ja-JP")}
                        </span>
                      )}
                      <span className="ml-4 text-slate-500">
                        過去90日最安 ¥{work.low90Price.toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <MiniPriceHistoryChart
                        points={work.priceHistory}
                        windowStartAt={work.priceWindowStartAt}
                        windowEndAt={work.priceWindowEndAt}
                        lowPrice={work.low90Price}
                        currentPrice={work.currentPrice}
                        variant="main"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
