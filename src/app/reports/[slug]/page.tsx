import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import DealWorkCard from "@/components/deals/DealWorkCard";
import Header from "@/components/layout/Header";
import { isReportSlug, reportDefinitions } from "@/lib/editorialContent";
import { getEditorialReport } from "@/lib/getEditorialReport";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 1800;

export function generateStaticParams() {
  return reportDefinitions.map((report) => ({ slug: report.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = reportDefinitions.find((item) => item.slug === slug);
  if (!report) return {};
  return pageMetadata({ title: `${report.title} | 発掘LAB`, description: report.description, canonical: `/reports/${report.slug}` });
}

export default async function ReportDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isReportSlug(slug)) notFound();
  const definition = reportDefinitions.find((report) => report.slug === slug)!;
  const result = await getEditorialReport(slug);
  const url = `${SITE_URL}/reports/${slug}`;
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><CollectionPageJsonLd title={definition.title} description={definition.description} url={url} items={result.works.map((work) => ({ name: work.title, url: `${SITE_URL}/works/${work.id}`, image: work.image_url }))} /><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Link href="/reports" className="text-xs font-bold text-slate-500 hover:text-pink-600">データレポート / 最新</Link><p className="mt-6 text-xs font-black tracking-widest text-emerald-700">UPDATED DATA REPORT</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{definition.title}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{definition.description}</p><p className="mt-4 text-xs font-bold text-slate-500">データ更新: 30分ごとに再集計 / 編集: 発掘LAB編集部</p></div></section><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{result.error ? <div className="border border-rose-200 bg-white p-10 text-center font-black">データを読み込めませんでした</div> : result.works.length ? <><p className="mb-6 text-sm leading-7 text-slate-600">取得条件に該当した上位{result.works.length}作品です。順位は購入満足度を保証するものではありません。</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{result.works.map((work) => <DealWorkCard key={work.id} work={work} source="deals" />)}</div></> : <div className="border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">現在、条件に該当する作品はありません</p><p className="mt-2 text-sm text-slate-500">次回のデータ更新後にもう一度ご確認ください。</p></div>}<div className="mt-12 border-l-2 border-amber-400 bg-amber-50 px-5 py-5 text-sm leading-7 text-slate-700">価格・順位・販売状況は変動します。表示は取得時点の比較であり、購入直前にはFANZA公式ページの最新情報を確認してください。</div></div></main></>;
}
