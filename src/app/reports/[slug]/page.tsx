import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import DealWorkCard, { type DealWork } from "@/components/deals/DealWorkCard";
import Header from "@/components/layout/Header";
import { isReportSlug, reportDefinitions, type ReportSlug } from "@/lib/editorialContent";
import { getEditorialReport } from "@/lib/getEditorialReport";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;

const priceBands = [
  { label: "1,000円未満", min: 0, max: 1000 },
  { label: "1,000〜3,000円", min: 1000, max: 3000 },
  { label: "3,000円以上", min: 3000, max: Number.POSITIVE_INFINITY },
] as const;

function currentPrice(work: DealWork) {
  return work.sale_price > 0 ? work.sale_price : work.price;
}

function getBandWorks(works: DealWork[], min: number, max: number) {
  return works.filter((work) => {
    const price = currentPrice(work);
    return price >= min && price < max;
  }).slice(0, 10);
}

export function generateStaticParams() {
  return reportDefinitions.map((report) => ({ slug: report.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = reportDefinitions.find((item) => item.slug === slug);
  if (!report) return {};
  return pageMetadata({
    title: `${report.title} | 発掘LAB`,
    description: report.description,
    canonical: `/reports/${report.slug}`,
  });
}

function ReportWorkGrid({ works }: { works: DealWork[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {works.map((work) => (
        <DealWorkCard key={work.id} work={work} source="price-report" />
      ))}
    </div>
  );
}

function PriceBandSections({ works }: { works: DealWork[] }) {
  return (
    <div className="space-y-10">
      {priceBands.map((band) => {
        const bandWorks = getBandWorks(works, band.min, band.max);
        return (
          <section key={band.label}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-widest text-pink-600">PRICE BAND</p>
                <h2 className="mt-1 text-2xl font-black">{band.label}</h2>
              </div>
              <span className="text-xs font-bold text-slate-500">{bandWorks.length}作品</span>
            </div>
            {bandWorks.length ? (
              <ReportWorkGrid works={bandWorks} />
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                現在、この価格帯の比較対象はありません
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default async function ReportDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isReportSlug(slug)) notFound();
  const definition = reportDefinitions.find((report) => report.slug === slug)!;
  const result = await getEditorialReport(slug as ReportSlug);
  const url = `${SITE_URL}/reports/${slug}`;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title={definition.title}
          description={definition.description}
          url={url}
          items={result.works.map((work) => ({
            name: work.title,
            url: `${SITE_URL}/works/${work.id}`,
            image: work.image_url,
          }))}
        />
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/reports" className="text-xs font-bold text-slate-500 hover:text-pink-600">
              データレポート / 最新
            </Link>
            <p className="mt-6 text-xs font-black tracking-widest text-emerald-700">UPDATED DATA REPORT</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">{definition.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{definition.description}</p>
            <p className="mt-4 text-xs font-bold text-slate-500">データ更新: 30分ごとに再集計 / 編集: 発掘LAB編集部</p>
          </div>
        </section>
        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {result.error ? (
            <div className="border border-rose-200 bg-white p-10 text-center font-black">データを読み込めませんでした</div>
          ) : result.works.length ? (
            <>
              <div className="mb-8 rounded-2xl border border-pink-100 bg-white p-5 text-sm leading-7 text-slate-600">
                <p className="font-black text-slate-900">このページの見方</p>
                <p className="mt-2">
                  価格だけでなく、レビュー件数、過去最安値、サンプルの有無を作品カードで確認できます。気になる作品は詳細ページで価格履歴と「今買う・比較して判断・待つ」の判定を確認してください。
                </p>
              </div>
              {slug === "price-bands" ? (
                <PriceBandSections works={result.works} />
              ) : (
                <>
                  <p className="mb-6 text-sm leading-7 text-slate-600">
                    取得条件に該当した上位{result.works.length}作品です。順位は購入満足度を保証するものではありません。気になる作品は価格履歴と買い時判定を確認してください。
                  </p>
                  <ReportWorkGrid works={result.works} />
                </>
              )}
            </>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="font-black">現在、条件に該当する作品はありません</p>
              <p className="mt-2 text-sm text-slate-500">次回のデータ更新後にもう一度ご確認ください。</p>
            </div>
          )}
          <div className="mt-12 border-l-2 border-amber-400 bg-amber-50 px-5 py-5 text-sm leading-7 text-slate-700">
            価格・順位・販売状況は変動します。表示は取得時点の比較であり、購入直前にはFANZA公式ページの最新情報を確認してください。
          </div>
        </div>
      </main>
    </>
  );
}
