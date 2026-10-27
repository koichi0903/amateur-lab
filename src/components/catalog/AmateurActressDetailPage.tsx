import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Ruler, Shapes } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkCategorySwitch from "@/components/catalog/WorkCategorySwitch";
import WorkImage from "@/components/home/WorkImage";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import { getFanzaAmateurActressIndex, getFanzaAmateurActressWorks } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata } from "@/lib/seo";

export const AMATEUR_ACTRESS_PAGE_SIZE = 60;

async function getActressSummary(actressName: string) {
  const result = await getFanzaAmateurActressIndex({ query: actressName, sort: "count-desc", page: 1 });
  return result.items.find((item) => item.name === actressName) ?? null;
}

export async function amateurActressMetadata(actressName: string, page = 1): Promise<Metadata> {
  const summary = await getActressSummary(actressName).catch(() => null);
  if (!summary) return pageMetadata({ title: `${actressName}の素人出演作品 | 発掘LAB`, description: `${actressName}が出演するFANZA素人作品一覧です。`, canonical: `/amateur/actress/${encodeURIComponent(actressName)}`, robots: { index: false, follow: true } });
  return pageMetadata({
    title: `${actressName}の素人出演作品・プロフィール${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: `${actressName}のプロフィール、高コスパ素人作品、最新作、出演作品一覧を掲載。`,
    canonical: `/amateur/actress/${encodeURIComponent(actressName)}${page > 1 ? `/page/${page}` : ""}`,
    robots: page > 1 ? { index: false, follow: true } : undefined,
  });
}

function priceOf(card: Awaited<ReturnType<typeof getFanzaAmateurActressWorks>>["cards"][number]) {
  return card.item.currentPrice ?? Number(card.item.prices?.list_price?.match(/[0-9]+/)?.[0] ?? 0);
}

function costPerformanceScore(card: Awaited<ReturnType<typeof getFanzaAmateurActressWorks>>["cards"][number]) {
  const item = card.item;
  const reviewAverage = Math.min(Math.max(item.reviewAverage ?? 0, 0), 5) / 5;
  const reviewConfidence = Math.min(Math.log10(Math.max(item.review?.count ?? 0, 0) + 1) / 2.5, 1);
  const listPrice = Number(item.prices?.list_price?.match(/[0-9]+/)?.[0] ?? 0);
  const discount = listPrice > 0 && item.currentPrice != null ? Math.min(Math.max((listPrice - item.currentPrice) / listPrice, 0), 1) : 0;
  const pricePenalty = Math.min(priceOf(card) / 5000, 1);
  return reviewAverage * 0.4 + reviewConfidence * 0.35 + discount * 0.25 - pricePenalty * 0.12;
}

export async function AmateurActressDetailPage({ actressName, currentPage }: { actressName: string; currentPage: number }) {
  const summary = await getActressSummary(actressName);
  if (!summary || summary.work_count < 1) notFound();
  const totalCount = Number(summary.work_count);
  const totalPages = Math.max(1, Math.ceil(totalCount / AMATEUR_ACTRESS_PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const [pageResult, contextResult, newestResult] = await Promise.all([
    getFanzaAmateurActressWorks({ name: actressName, page: safeCurrentPage, pageSize: AMATEUR_ACTRESS_PAGE_SIZE, sort: "newest" }),
    getFanzaAmateurActressWorks({ name: actressName, page: 1, pageSize: 300, sort: "review" }),
    getFanzaAmateurActressWorks({ name: actressName, page: 1, pageSize: 4, sort: "newest" }),
  ]);

  const currentCards = pageResult.cards;
  const contextCards = contextResult.cards;
  const highCostWorks = [...contextCards]
    .filter((card) => priceOf(card) > 0)
    .sort((a, b) => costPerformanceScore(b) - costPerformanceScore(a) || (b.item.reviewAverage ?? 0) - (a.item.reviewAverage ?? 0) || (b.item.review?.count ?? 0) - (a.item.review?.count ?? 0))
    .slice(0, 6);
  const newestWorks = newestResult.cards.slice(0, 4);
  const pageHref = (targetPage: number) => targetPage > 1
    ? `/amateur/actress/${encodeURIComponent(actressName)}/page/${targetPage}`
    : `/amateur/actress/${encodeURIComponent(actressName)}`;
  const profileImage = summary.profile_image_url || summary.image_url;

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
    <WorkCategorySwitch active="amateur" />
    <Link href="/amateur/actress" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-pink-600"><ArrowLeft size={15} /> 素人女優一覧に戻る</Link>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-pink-600 bg-slate-100 sm:h-32 sm:w-32"><WorkImage src={profileImage} fallbackSrc={summary.image_url} alt={`${actressName}のプロフィール写真`} sizes="128px" unoptimized className="object-cover" /></div>
      <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-3 sm:items-center">
        <div><h1 className="text-3xl font-black sm:text-4xl">{actressName}の出演作品・プロフィール</h1>{summary.ruby && <p className="mt-1 text-sm text-slate-500">{summary.ruby}</p>}</div>
        <div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-slate-500"><CalendarDays size={15} /> 生年月日 <strong className="text-slate-800">{summary.birthday ?? "未取得"}</strong></p><p className="flex items-center gap-2 text-slate-500"><Ruler size={15} /> 身長 <strong className="text-slate-800">{summary.height_cm ? `${summary.height_cm} cm` : "未取得"}</strong></p></div>
        <p className="flex items-center gap-2 text-sm text-slate-500"><Shapes size={15} /> スリーサイズ <strong className="text-slate-800">{summary.bust_cm || summary.waist_cm || summary.hip_cm ? `B${summary.bust_cm ?? "-"} / W${summary.waist_cm ?? "-"} / H${summary.hip_cm ?? "-"}` : "未取得"}</strong></p>
      </div>
    </div><p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">出演が確認できた素人作品は全{totalCount.toLocaleString("ja-JP")}作品です。プロフィール写真はFANZA女優情報を使用し、登録がない場合は素人作品の画像を表示します。</p></section>
    {highCostWorks.length > 0 && <section className="mt-8"><SectionTitle title="高コスパ作品" count={highCostWorks.length} color="amber" /><div className="grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{highCostWorks.map((card) => <FanzaAmateurTopCard key={`cost-${card.item.content_id}`} card={card} sourcePage="amateur_detail" />)}</div></section>}
    {newestWorks.length > 0 && <section className="mt-10"><SectionTitle title="最新作" count={newestWorks.length} color="pink" /><div className="grid max-w-[1500px] grid-cols-2 gap-3 lg:grid-cols-4">{newestWorks.map((card) => <FanzaAmateurTopCard key={`new-${card.item.content_id}`} card={card} showChart={false} showRank={false} sourcePage="amateur_detail" />)}</div></section>}
    {currentCards.length > 0 && <section className="mt-10"><SectionTitle title="出演作品一覧" count={totalCount} color="pink" /><div className="grid max-w-[1500px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{currentCards.map((card) => <FanzaAmateurTopCard key={card.item.content_id} card={card} showRank={false} sourcePage="amateur_detail" />)}</div>
      {totalPages > 1 && <nav aria-label={`${actressName}の出演作品一覧のページ送り`} className="mt-8 flex items-center justify-center gap-3">{safeCurrentPage > 1 && <Link href={pageHref(safeCurrentPage - 1)} className="rounded border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{safeCurrentPage} / {totalPages}</span>{safeCurrentPage < totalPages && <Link href={pageHref(safeCurrentPage + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}</nav>}
    </section>}
  </div></main></>;
}

function SectionTitle({ title, count, color }: { title: string; count?: number; color: "amber" | "pink" }) {
  return <div className="mb-4 flex items-center gap-3"><span className={`h-7 w-1 rounded-full ${color === "amber" ? "bg-amber-400" : "bg-pink-500"}`} /><h2 className="text-xl font-black">{title}</h2>{count != null && <span className="text-xs font-bold text-zinc-500">({count}件)</span>}</div>;
}
