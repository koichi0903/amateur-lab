import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Boxes, Clapperboard, Sparkles, Star, Tags, Trophy } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { SITE_URL, pageMetadata } from "@/lib/seo";
import { unstable_cache } from "next/cache";
import { workDetailHref } from "@/lib/affiliateTracking";
import CatalogIntentGuide from "@/components/catalog/CatalogIntentGuide";
import { analyzeCatalogIntent, type CatalogIntentWork } from "@/lib/catalog/catalogIntentAnalyzer";

export type CatalogKind = "maker" | "series" | "genre";

const catalogConfig = {
  maker: { label: "メーカー", eyebrow: "MAKER", column: "maker", icon: Boxes },
  series: { label: "シリーズ", eyebrow: "SERIES", column: "series", icon: Clapperboard },
  genre: { label: "ジャンル", eyebrow: "GENRE", column: "genre", icon: Tags },
} as const;

export function decodeCatalogName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function catalogMetadata(kind: CatalogKind, name: string, page = 1): Metadata {
  const { label } = catalogConfig[kind];
  const suffix = page > 1 ? ` ${page}ページ目` : "";
  const subject = kind === "series" ? `${name}シリーズ` : name;
  return pageMetadata({
    title: `${subject}のおすすめ作品・人気ランキング${suffix} | 発掘LAB`,
    description: `${subject}のおすすめ・人気作品を、発掘スコア、レビュー件数、現在価格で比較。${label}別の買い時と関連条件から作品を探せます。`,
    canonical: `/${kind}/${encodeURIComponent(name)}${page > 1 ? `?page=${page}` : ""}`,
  });
}

function splitValues(value: string | null) {
  return value?.split(" / ").map((item) => item.trim()).filter(Boolean) ?? [];
}

async function loadWorks(kind: CatalogKind, name: string) {
  const { column } = catalogConfig[kind];
  const pageSize = 1000;
  const works: Work[] = [];
  let error: unknown = null;

  for (let from = 0; ; from += pageSize) {
    const query = supabase.from("works").select("id,title,image_url,score,review_average,review_count,price,sale_price,genre");
    const result = kind === "genre"
      ? await query.ilike(column, `%${name}%`).order("score", { ascending: false, nullsFirst: false }).range(from, from + pageSize - 1)
      : await query.eq(column, name).order("score", { ascending: false, nullsFirst: false }).range(from, from + pageSize - 1);

    if (result.error) {
      error = result.error;
      break;
    }

    const page = (result.data ?? []) as Work[];
    works.push(...page);
    if (page.length < pageSize) break;
  }

  return {
    error,
    works: kind === "genre" ? works.filter((work) => splitValues(work.genre).includes(name)) : works,
  };
}

const getWorks = unstable_cache(
  loadWorks,
  ["catalog-detail-works-v2-review-count"],
  { revalidate: 86400 }
);

async function loadCatalogContext(kind: CatalogKind, name: string) {
  const { column } = catalogConfig[kind];
  const query = supabase
    .from("works")
    .select("id,title,score,review_average,review_count,price,sale_price,discount_rate,actress,genre,maker,series");
  const result = kind === "genre"
    ? await query.ilike(column, `%${name}%`).order("score", { ascending: false, nullsFirst: false }).limit(300)
    : await query.eq(column, name).order("score", { ascending: false, nullsFirst: false }).limit(300);
  const works = (result.data ?? []) as CatalogIntentWork[];
  return kind === "genre"
    ? works.filter((work) => splitValues(work.genre ?? null).includes(name))
    : works;
}

const getCatalogContext = unstable_cache(
  loadCatalogContext,
  ["catalog-detail-context-v1"],
  { revalidate: 86400 },
);

function Price({ work }: { work: Work }) {
  const price = work.sale_price > 0 ? work.sale_price : work.price;
  return <span className={work.sale_price > 0 ? "text-rose-600" : "text-slate-900"}>{price > 0 ? `¥${price.toLocaleString("ja-JP")}` : "価格未取得"}</span>;
}

function WorkCard({ work, rank, kind }: { work: Work; rank: number; kind: CatalogKind }) {
  return (
    <Link href={workDetailHref(work.id, kind)} className="group grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5 sm:p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} sizes="150px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
        <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white shadow">{rank}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-1.5 text-pink-600"><span className="text-[10px] font-black tracking-wider">SCORE</span><strong className="text-2xl leading-none">{work.score > 0 ? work.score : "—"}</strong></div>
        <h2 className="mt-2 line-clamp-2 break-words text-sm font-black leading-5 sm:text-base sm:leading-6">{work.title}</h2>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3 text-xs font-black sm:text-sm"><Price work={work} /><span className="flex shrink-0 items-center gap-1 text-pink-600">詳細 <ArrowRight size={14} /></span></div>
      </div>
    </Link>
  );
}

function JsonLd({ kind, name, works, page, pageSize }: { kind: CatalogKind; name: string; works: Work[]; page: number; pageSize: number }) {
  const baseUrl = SITE_URL;
  const pageUrl = `${baseUrl}/${kind}/${encodeURIComponent(name)}${page > 1 ? `?page=${page}` : ""}`;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "TOP", item: baseUrl },
        { "@type": "ListItem", position: 2, name: catalogConfig[kind].label, item: `${baseUrl}/${kind}` },
        { "@type": "ListItem", position: 3, name, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${name}の作品一覧`,
      url: pageUrl,
      numberOfItems: works.length,
      itemListElement: works.map((work, index) => ({
        "@type": "ListItem",
        position: (page - 1) * pageSize + index + 1,
        url: `${baseUrl}/works/${work.id}`,
        name: work.title,
      })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default async function CatalogDetailPage({ kind, name, page = 1 }: { kind: CatalogKind; name: string; page?: number }) {
  const config = catalogConfig[kind];
  const [{ works, error }, contextWorks] = await Promise.all([
    getWorks(kind, name),
    getCatalogContext(kind, name),
  ]);
  if (!error && works.length === 0) notFound();
  const scoredWorks = works.filter((work) => work.score > 0);
  const reviewedWorks = works.filter((work) => work.review_average > 0);
  const averageScore = scoredWorks.length ? Math.round(scoredWorks.reduce((sum, work) => sum + work.score, 0) / scoredWorks.length) : 0;
  const averageReview = reviewedWorks.length ? (reviewedWorks.reduce((sum, work) => sum + work.review_average, 0) / reviewedWorks.length).toFixed(2) : "—";
  const topWork = works[0];
  const pageSize = 60;
  const totalPages = Math.max(1, Math.ceil(works.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * pageSize;
  const displayedWorks = works.slice(offset, offset + pageSize);
  const pageHref = (targetPage: number) => targetPage > 1
    ? `/${kind}/${encodeURIComponent(name)}?page=${targetPage}`
    : `/${kind}/${encodeURIComponent(name)}`;
  const Icon = config.icon;
  const intentAnalysis = currentPage === 1
    ? analyzeCatalogIntent({ kind, name, works, relatedWorks: contextWorks })
    : null;

  return <><Header /><JsonLd kind={kind} name={name} works={displayedWorks} page={currentPage} pageSize={pageSize} /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <nav aria-label="パンくず" className="min-w-0 truncate text-xs font-bold text-slate-500"><Link href="/" className="hover:text-pink-600">TOP</Link><span className="mx-1">/</span><Link href={`/${kind}`} className="hover:text-pink-600">{config.label}</Link><span className="mx-1">/</span><span>{name}</span></nav>
      <div className="mt-6 grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-sm"><WorkImage src={topWork?.image_url} alt={`${name}の作品`} sizes="(max-width: 768px) 92vw, 280px" priority unoptimized className="object-cover" /></div>
        <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-pink-600"><Icon size={16} />{config.eyebrow}</p><h1 className="mt-2 break-words text-3xl font-black tracking-tight sm:text-5xl">{name}</h1><p className="mt-4 text-sm leading-7 text-slate-600">{config.label}に登録された作品を発掘スコア順に掲載。高評価作品から、新しい一本を発掘できます。</p>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ icon: Clapperboard, label: "登録作品", value: `${works.length}作品` }, { icon: Trophy, label: "最高スコア", value: topWork?.score > 0 ? String(topWork.score) : "—" }, { icon: Sparkles, label: "平均スコア", value: averageScore > 0 ? String(averageScore) : "—" }, { icon: Star, label: "平均レビュー", value: averageReview }].map((stat) => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><stat.icon size={18} className="text-pink-600" /><p className="mt-3 text-xs font-bold text-slate-500">{stat.label}</p><p className="mt-1 text-xl font-black">{stat.value}</p></div>)}</div>
        </div>
      </div>
    </div></section>
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{!error && works.length > 0 && <CatalogIntentGuide name={name} source={kind} analysis={intentAnalysis} />}{error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">作品を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div> : works.length ? <><div className="mb-6 flex items-end justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black tracking-widest text-pink-600">TOP WORKS</p><h2 className="mt-1 break-words text-2xl font-black">{name}の作品</h2></div><span className="shrink-0 text-xs font-bold text-slate-400">全{works.length}作品中 {offset + 1}〜{offset + displayedWorks.length}作品</span></div><div className="grid gap-3 lg:grid-cols-2">{displayedWorks.map((work, index) => <WorkCard key={work.id} work={work} rank={offset + index + 1} kind={kind} />)}</div>{totalPages > 1 && <nav aria-label={`${name}の作品一覧のページ送り`} className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600">← 前の60作品</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-600">次の60作品 →</Link>}</nav>}</> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Icon className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">登録作品がまだありません</p><Link href={`/${kind}`} className="mt-3 inline-block text-sm font-black text-pink-600">{config.label}一覧に戻る</Link></div>}</div>
  </main></>;
}
