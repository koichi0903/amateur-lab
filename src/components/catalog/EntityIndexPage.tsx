import Link from "next/link";
import { ArrowRight, Building2, Clapperboard, Search, Sparkles, Tags, Trophy } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { getAllWorks } from "@/lib/supabase/getAllWorks";

type EntityKind = "maker" | "series" | "genre";
type EntitySource = {
  id: number;
  title: string;
  maker: string | null;
  series: string | null;
  genre: string | null;
  image_url: string | null;
  score: number | null;
};
type EntitySummary = { name: string; count: number; maxScore: number; imageUrl: string | null };

const configs = {
  maker: { label: "メーカー", plural: "社", eyebrow: "MAKER RANKING", title: "メーカー登録作品数ランキング", description: "発掘LABに登録されている作品数が多いメーカー順に紹介します。", Icon: Building2 },
  series: { label: "シリーズ", plural: "件", eyebrow: "SERIES RANKING", title: "シリーズ登録作品数ランキング", description: "発掘LABに登録されている作品数が多いシリーズ順に紹介します。", Icon: Clapperboard },
  genre: { label: "ジャンル", plural: "件", eyebrow: "GENRE RANKING", title: "ジャンル登録作品数ランキング", description: "発掘LABに登録されている作品数が多いジャンル順に紹介します。", Icon: Tags },
} as const;

export default async function EntityIndexPage({ kind, searchParams }: { kind: EntityKind; searchParams: Promise<{ q?: string; page?: string }> }) {
  const config = configs[kind];
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 48;
  const works = await getAllWorks<EntitySource>("id,title,maker,series,genre,image_url,score");
  const summaries = new Map<string, EntitySummary>();

  for (const work of works) {
    const values = kind === "genre" ? work.genre?.split(" / ") ?? [] : [work[kind]];
    for (const rawName of values) {
      const name = rawName?.trim();
      if (!name) continue;
      const score = work.score ?? 0;
      const current = summaries.get(name);
      if (!current) summaries.set(name, { name, count: 1, maxScore: score, imageUrl: work.image_url });
      else {
        current.count += 1;
        if (score > current.maxScore) {
          current.maxScore = score;
          current.imageUrl = work.image_url;
        }
      }
    }
  }

  const ranked = [...summaries.values()].sort((a, b) => b.count - a.count || b.maxScore - a.maxScore || a.name.localeCompare(b.name, "ja"));
  const normalizedQuery = query.toLocaleLowerCase("ja");
  const filtered = query ? ranked.filter((item) => item.name.toLocaleLowerCase("ja").includes(normalizedQuery)) : ranked;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (target > 1) next.set("page", String(target));
    return next.size ? `/${kind}?${next}` : `/${kind}`;
  };

  return <><Header /><main className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP <span className="mx-1">/</span> {config.label}</Link>
      <div className="mt-5 flex max-w-3xl items-start gap-4"><span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><config.Icon size={28} /></span><div className="min-w-0"><p className="text-xs font-black tracking-[0.18em] text-pink-600">{config.eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{config.title}</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{config.description}</p></div></div>
      <form className="mt-8 flex max-w-xl items-center rounded-full border border-slate-200 bg-slate-50 px-5 shadow-sm" action={`/${kind}`}><Search size={18} className="shrink-0 text-slate-400" /><input type="search" name="q" maxLength={100} defaultValue={query} aria-label={`${config.label}名で検索`} placeholder={`${config.label}名で検索`} className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-bold outline-none placeholder:font-normal" /><button className="shrink-0 text-sm font-black text-pink-600">検索</button></form>
    </div></section>
    <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mb-6 flex min-w-0 items-end justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black tracking-widest text-pink-600">{query ? "SEARCH RESULT" : `${kind.toUpperCase()} RANKING`}</p><h2 className="mt-1 break-all text-2xl font-black">{query ? `「${query}」の検索結果` : "登録作品数が多い順"}</h2>{!query && <p className="mt-2 text-sm leading-6 text-slate-500">同数の場合は、所属作品の最高発掘スコアが高い順に表示しています。</p>}</div><span className="shrink-0 text-xs font-bold text-slate-400">全{filtered.length}{config.plural}</span></div>
      {visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visible.map((item) => { const rank = ranked.findIndex((candidate) => candidate.name === item.name) + 1; return <Link key={item.name} href={`/${kind}/${encodeURIComponent(item.name)}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={item.imageUrl} alt={`${item.name}の代表作品`} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" />{!query && rank <= 3 && <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md"><Trophy size={18} className={rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : "text-orange-600"} /></span>}</div><div className="flex flex-1 flex-col px-1 pb-1 pt-3"><p className="text-[10px] font-black tracking-wider text-pink-600">登録作品数 {rank}位</p><h2 className="mt-1 line-clamp-2 break-all text-base font-black sm:text-lg">{item.name}</h2><div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-[10px] font-bold text-slate-400">登録作品数</p><p className="text-xl font-black text-pink-600">{item.count}<span className="ml-0.5 text-xs">作品</span></p></div><ArrowRight size={17} className="mb-1 shrink-0 text-pink-600" /></div></div></Link>; })}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-12"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">該当する{config.label}が見つかりませんでした</p><Link href={`/${kind}`} className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>}
      {totalPages > 1 && <nav aria-label={`${config.label}一覧のページ送り`} className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}
    </div>
  </main></>;
}
