import Link from "next/link";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { getHomePriceInsights } from "@/lib/getHomePriceInsights";
import { workDetailHref } from "@/lib/affiliateTracking";

export const revalidate = 1800;

function currentPrice(work: { currentPrice: number }) { return `¥${work.currentPrice.toLocaleString("ja-JP")}`; }

export default async function PriceInsightsPage() {
  const { buyTiming } = await getHomePriceInsights();
  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><Link href="/" className="text-xs font-bold text-slate-500">TOP / 価格推移 / 今日の買い時ランキング</Link><p className="mt-5 text-xs font-black tracking-[.18em] text-pink-600">PRICE INTELLIGENCE</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">今日の買い時ランキング</h1><p className="mt-3 text-sm text-slate-600">過去90日の価格推移、現在価格、割引率、過去最安を組み合わせて選出しています。</p></div></section><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{buyTiming.map((work, index) => <Link key={work.id} href={workDetailHref(work.id, "home")} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex gap-4"><div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100"><WorkImage src={work.image_url} alt={work.title} sizes="112px" className="object-cover" /></div><div className="min-w-0"><p className="text-xs font-black text-pink-600">{index + 1}位 / 買い時スコア {work.buyScore}点</p><h2 className="mt-2 line-clamp-3 text-sm font-black leading-5">{work.title}</h2><p className="mt-2 text-lg font-black text-pink-600">{currentPrice(work)}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs"><span>割引率<strong className="mt-1 block text-sm text-rose-600">{work.discount_rate}%OFF</strong></span><span>過去90日最安<strong className="mt-1 block text-sm text-emerald-600">¥{work.low90Price.toLocaleString("ja-JP")}</strong></span><span>{work.badge}<strong className="mt-1 block text-sm text-slate-700">{work.dropRate > 0 ? `${work.dropRate}%下落` : "価格安定"}</strong></span></div><div className="mt-3 flex h-10 items-end gap-1 rounded-lg bg-slate-50 px-2 py-1">{work.sparkline.map((value, point) => <span key={point} className="flex-1 rounded-t bg-pink-400" style={{ height: `${Math.max(12, (value / Math.max(...work.sparkline)) * 100)}%` }} />)}</div></Link>)}</div></div></main></>;
}
