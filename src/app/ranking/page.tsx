import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Crown, Sparkles, Trophy } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "発掘スコアランキング | 発掘LAB",
  description: "発掘LAB独自のスコアで、注目のFANZA作品をランキング形式で紹介します。",
  alternates: { canonical: "/ranking" },
};

const rankingTypes = {
  overall: { label: "総合", score: "score", description: "作品の魅力を総合的に評価した発掘スコア" },
  actress: { label: "女優", score: "actress_score", description: "出演女優の注目度をもとにしたスコア" },
  genre: { label: "ジャンル", score: "genre_score", description: "ジャンルの注目度をもとにしたスコア" },
  maker: { label: "メーカー", score: "maker_score", description: "メーカーの実績をもとにしたスコア" },
  series: { label: "シリーズ", score: "series_score", description: "シリーズの実績をもとにしたスコア" },
} as const;

type RankingType = keyof typeof rankingTypes;
type RankedWork = Work & Record<(typeof rankingTypes)[RankingType]["score"], number | null>;

function getPrice(work: Work) {
  return work.sale_price > 0 ? work.sale_price : work.price;
}

function Price({ work }: { work: Work }) {
  const price = getPrice(work);
  if (!price || price <= 0) return <span className="text-slate-400">価格未取得</span>;

  return (
    <span className={work.sale_price > 0 ? "text-rose-600" : "text-slate-900"}>
      ¥{price.toLocaleString("ja-JP")}
      {work.discount_rate > 0 && (
        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">
          {work.discount_rate}%OFF
        </span>
      )}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles = [
    "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-amber-200",
    "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-200",
    "bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-orange-200",
  ];
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-black shadow-lg ${styles[rank - 1] ?? "bg-slate-900 text-white"}`}>
      {rank}
    </span>
  );
}

function TopCard({ work, rank, scoreKey }: { work: RankedWork; rank: number; scoreKey: keyof RankedWork }) {
  const score = work[scoreKey] as number | null;
  return (
    <Link href={`/works/${work.id}`} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-4 ${rank === 1 ? "border-amber-300 lg:-mt-4 lg:mb-4" : "border-slate-200"}`}>
      <div className="absolute left-5 top-5 z-10"><RankBadge rank={rank} /></div>
      {rank === 1 && <Crown className="absolute right-5 top-5 z-10 text-amber-500" size={27} />}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 768px) 92vw, 30vw" priority={rank === 1} unoptimized className="object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="flex items-baseline gap-2 text-pink-600"><span className="text-xs font-black tracking-wider">SCORE</span><strong className="text-3xl leading-none">{score && score > 0 ? score : "—"}</strong></div>
        <h2 className="mt-3 line-clamp-2 min-h-12 text-base font-black leading-6 text-slate-900">{work.title}</h2>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm font-black">
          <Price work={work} />
          <span className="flex shrink-0 items-center gap-1 text-pink-600">詳細 <ArrowRight size={15} /></span>
        </div>
      </div>
    </Link>
  );
}

function ListCard({ work, rank, scoreKey }: { work: RankedWork; rank: number; scoreKey: keyof RankedWork }) {
  const score = work[scoreKey] as number | null;
  return (
    <Link href={`/works/${work.id}`} className="group grid min-w-0 grid-cols-[38px_112px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:grid-cols-[48px_150px_minmax(0,1fr)] sm:gap-5 sm:p-4">
      <span className="text-center text-xl font-black text-slate-400 sm:text-2xl">{rank}</span>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} sizes="150px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
      </div>
      <div className="min-w-0 self-stretch py-0.5">
        <div className="flex items-baseline gap-1.5 text-pink-600"><span className="text-[10px] font-black tracking-wider">SCORE</span><strong className="text-2xl leading-none">{score && score > 0 ? score : "—"}</strong></div>
        <h2 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900 sm:text-base sm:leading-6">{work.title}</h2>
        <div className="mt-2 text-xs font-black sm:text-sm"><Price work={work} /></div>
      </div>
    </Link>
  );
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const params = await searchParams;
  const requestedType = params.type;
  const type: RankingType = requestedType && requestedType in rankingTypes ? requestedType as RankingType : "overall";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 30;
  const offset = (page - 1) * pageSize;
  const current = rankingTypes[type];
  const { data, error, count } = await supabase
    .from("works")
    .select("*", { count: "exact" })
    .gt(current.score, 0)
    .order(current.score, { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);
  const works = (data ?? []) as RankedWork[];
  const totalWorks = count ?? works.length;
  const hasNextPage = offset + works.length < totalWorks;
  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (type !== "overall") query.set("type", type);
    if (targetPage > 1) query.set("page", String(targetPage));
    const value = query.toString();
    return value ? `/ranking?${value}` : "/ranking";
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 transition hover:text-pink-600">TOP <span className="mx-1">/</span> ランキング</Link>
            <div className="mt-5 flex max-w-3xl items-start gap-4">
              <span className="rounded-2xl bg-pink-50 p-3 text-pink-600"><Trophy size={28} /></span>
              <div><p className="text-xs font-black tracking-[0.18em] text-pink-600">AI SCORE RANKING</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">発掘ランキング</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">独自のスコアで、いま注目したい作品を発掘。{current.description}のランキングです。</p></div>
            </div>
            <nav aria-label="ランキング種別" className="mt-8 flex gap-2 overflow-x-auto pb-1">
              {(Object.entries(rankingTypes) as [RankingType, (typeof rankingTypes)[RankingType]][]).map(([key, item]) => (
                <Link key={key} href={key === "overall" ? "/ranking" : `/ranking?type=${key}`} aria-current={key === type ? "page" : undefined} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black transition ${key === type ? "bg-slate-950 text-white shadow-md" : "border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-pink-600"}`}>{item.label}</Link>
              ))}
            </nav>
          </div>
        </section>

        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black text-slate-900">ランキングを読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div>
          ) : works.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black text-slate-900">ランキングを集計中です</p><p className="mt-2 text-sm text-slate-500">スコアのある作品が登録されると、ここに表示されます。</p></div>
          ) : (
            <>
              {page === 1 && <section aria-labelledby="top-ranking"><div className="mb-6"><p className="text-xs font-black tracking-widest text-pink-600">TOP PICKS</p><h2 id="top-ranking" className="mt-1 text-2xl font-black">注目のTOP3</h2></div><div className="grid gap-4 md:grid-cols-3 lg:items-start">{works.slice(0, 3).map((work, index) => <TopCard key={work.id} work={work} rank={index + 1} scoreKey={current.score} />)}</div></section>}
              {(page > 1 || works.length > 3) && <section className={page === 1 ? "mt-12" : ""} aria-labelledby="all-ranking"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-pink-600">RANKING</p><h2 id="all-ranking" className="mt-1 text-2xl font-black">{page === 1 ? "4位以降のランキング" : `${offset + 1}〜${offset + works.length}位のランキング`}</h2></div><span className="shrink-0 text-xs font-bold text-slate-400">全{totalWorks}作品</span></div><div className="grid gap-3 lg:grid-cols-2">{(page === 1 ? works.slice(3) : works).map((work, index) => <ListCard key={work.id} work={work} rank={offset + index + (page === 1 ? 4 : 1)} scoreKey={current.score} />)}</div></section>}
              {(page > 1 || hasNextPage) && (
                <nav aria-label="ランキングのページ送り" className="mt-10 flex items-center justify-center gap-3">
                  {page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600">← 前の30件</Link>}
                  {hasNextPage && <Link href={pageHref(page + 1)} className="flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-md transition hover:bg-pink-600">{page === 1 ? "31位以降を見る" : "次の30件"}<ArrowRight size={16} /></Link>}
                </nav>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
