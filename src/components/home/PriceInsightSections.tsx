import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, BadgePercent, Crown, Search, Trophy } from "lucide-react";
import WorkImage from "@/components/home/WorkImage";
import { workDetailHref } from "@/lib/affiliateTracking";
import type { HomePriceInsightWork } from "@/lib/getHomePriceInsights";

const formatPrice = (value: number | null | undefined) =>
  value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "価格確認中";

function MiniChart({ values, color = "#ec4899" }: { values: number[]; color?: string }) {
  const width = 240;
  const height = 56;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" aria-label="価格推移" role="img">
      <path d={`M 0 ${height - 8} H ${width}`} stroke="#e2e8f0" strokeDasharray="3 4" />
      <polyline points={points} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <circle cx={width} cy={Number(points.split(" ").at(-1)?.split(",")[1] ?? height / 2)} r="4" fill={color} stroke="white" strokeWidth="2" />
    </svg>
  );
}

function MainBuyCard({ work, rank }: { work: HomePriceInsightWork; rank: number }) {
  const previous = work.previousPrice ?? work.list_price ?? work.price;
  const productDiscountRate = Math.max(0, Math.round(work.discount_rate ?? 0));
  return (
    <Link href={workDetailHref(work.id, "home")} className="group grid min-w-[280px] grid-cols-[112px_1fr] gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md sm:min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} className="object-cover transition duration-300 group-hover:scale-105" sizes="112px" />
        <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-lg font-black text-slate-900 shadow-sm">{rank}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-900">{work.title}</h3>
          <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] font-black text-emerald-700">{work.badge}</span>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500">現在価格</p>
        <p className="text-xl font-black text-pink-600">{formatPrice(work.currentPrice)}</p>
        <p className="mt-1 text-[11px] font-bold text-slate-500">通常価格 {formatPrice(previous)}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-md bg-pink-50 px-1.5 py-1 text-[11px] font-black text-pink-700">商品 {productDiscountRate}%OFF</span>
          <span className="text-[11px] font-black text-slate-500">買い時 {work.buyScore}点</span>
        </div>
      </div>
      <div className="col-span-2 rounded-lg bg-slate-50 px-2 py-1"><MiniChart values={work.sparkline} color={rank === 1 ? "#ec4899" : "#60a5fa"} /></div>
    </Link>
  );
}

function CompactCard({ work, color }: { work: HomePriceInsightWork; color: "blue" | "green" }) {
  return (
    <Link href={workDetailHref(work.id, "home")} className="group min-w-[160px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-pink-300 hover:shadow-md sm:min-w-0">
      <div className="flex gap-2">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100"><WorkImage src={work.image_url} alt={work.title} className="object-cover" sizes="56px" /></div>
        <div className="min-w-0"><h3 className="line-clamp-2 text-xs font-black leading-4">{work.title}</h3><p className={`mt-1 text-sm font-black ${color === "green" ? "text-emerald-600" : "text-blue-600"}`}>{formatPrice(work.currentPrice)}</p></div>
      </div>
      <div className="mt-2"><MiniChart values={work.sparkline} color={color === "green" ? "#34d399" : "#3b82f6"} /></div>
      <span className={`inline-flex rounded-md px-1.5 py-1 text-[10px] font-black ${color === "green" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{work.badge}</span>
    </Link>
  );
}

function Row({ icon: Icon, eyebrow, title, href, children }: { icon: typeof Crown; eyebrow: string; title: string; href: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200/80 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-end justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-black tracking-[.12em] text-pink-600"><Icon size={15} />{eyebrow}</p><h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{title}</h2></div><Link href={href} className="flex shrink-0 items-center gap-1 text-xs font-black text-slate-500 hover:text-pink-600">もっと見る <ArrowRight size={14} /></Link></div>
      {children}
    </section>
  );
}

export default function PriceInsightSections({ priceDrops, lowestUpdates, buyTiming }: { priceDrops: HomePriceInsightWork[]; lowestUpdates: HomePriceInsightWork[]; buyTiming: HomePriceInsightWork[] }) {
  if (!priceDrops.length && !lowestUpdates.length && !buyTiming.length) return null;
  return (
    <section className="mx-auto mt-14 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-pink-600"><BadgePercent size={18} />PRICE INTELLIGENCE</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">価格推移から、買い時を発掘</h2><p className="mt-2 text-sm font-bold text-slate-500">過去の価格と現在価格を比較して、今チェックしたい作品をまとめました。</p></div><Link href="/compare" className="hidden rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600 sm:block">価格を比較する <ArrowRight className="ml-1 inline" size={14} /></Link></div>
        <div className="space-y-7">
          {buyTiming.length > 0 && <Row icon={Crown} eyebrow="BUY TIMING" title="今日の買い時ランキング" href="/price-insights"><div className="grid gap-3 overflow-x-auto pb-1 sm:grid-cols-2 lg:grid-cols-3">{buyTiming.slice(0, 3).map((work, index) => <MainBuyCard key={work.id} work={work} rank={index + 1} />)}</div></Row>}
          {priceDrops.length > 0 && <Row icon={ArrowDownRight} eyebrow="PRICE DROP" title="本日の価格急落" href="/sale"><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{priceDrops.slice(0, 5).map((work) => <CompactCard key={work.id} work={work} color="blue" />)}</div></Row>}
          {lowestUpdates.length > 0 && <Row icon={Trophy} eyebrow="LOWEST UPDATE" title="過去最安を更新した作品" href="/deals/lowest-price"><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{lowestUpdates.slice(0, 5).map((work) => <CompactCard key={work.id} work={work} color="green" />)}</div></Row>}
        </div>
        <div className="mt-7 border-t border-slate-200/80 pt-6"><div className="mb-3 flex items-center gap-2 text-lg font-black"><Search size={19} className="text-pink-600" />価格から探す</div><div className="grid gap-2 sm:grid-cols-3"><Link href="/sale" className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black transition hover:border-pink-300 hover:text-pink-600">値下げ作品ランキング <ArrowRight size={16} /></Link><Link href="/deals/lowest-price" className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black transition hover:border-pink-300 hover:text-pink-600">過去最安から探す <ArrowRight size={16} /></Link><Link href="/compare" className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black transition hover:border-pink-300 hover:text-pink-600">価格推移を比較する <ArrowRight size={16} /></Link></div></div>
      </div>
    </section>
  );
}
