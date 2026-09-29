import Link from "next/link";
import { ArrowRight, Building2, Search, Sparkles, Tags } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { getEntityIndexSummaries, isEntityIndexable } from "@/lib/catalog/entityIndexSummaries";

type SearchParams = { q?: string; page?: string; sort?: string };
type EntityKind = "genre" | "maker";

export default async function GenreIndexPage({ kind = "genre", searchParams }: { kind?: EntityKind; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const label = kind === "maker" ? "メーカー" : "ジャンル";
  const Icon = kind === "maker" ? Building2 : Tags;
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = params.sort ?? "count-desc";
  const pageSize = 24;
  const ranked = (await getEntityIndexSummaries(kind)).filter((summary) => isEntityIndexable(kind, summary));
  const normalizedQuery = query.toLocaleLowerCase("ja");
  const filtered = query ? ranked.filter((item) => item.name.toLocaleLowerCase("ja").includes(normalizedQuery)) : ranked;
  const sorted = [...filtered].sort((a, b) => sort === "count-asc" ? a.count - b.count : b.count - a.count);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const basePath = `/${kind}`;
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (sort !== "count-desc") next.set("sort", sort);
    if (target > 1) next.set("page", String(target));
    return next.toString() ? `${basePath}?${next}` : basePath;
  };

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><div className="flex items-start justify-between gap-8"><div><div className="flex items-center gap-3"><Icon size={24} className="text-pink-600" /><h1 className="text-2xl font-black sm:text-3xl">{label}検索</h1></div><p className="mt-2 text-sm text-slate-600">登録作品数や発掘スコアを見ながら{label}を探せます。</p></div><div className="hidden items-center gap-2 lg:flex"><form action={basePath} className="flex h-10 w-[300px] items-center rounded border border-slate-200 bg-slate-50 px-3"><input type="search" name="q" maxLength={100} defaultValue={query} aria-label={`${label}名で検索`} placeholder={`${label}名で検索`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /><button aria-label={`${label}を検索`} className="text-slate-400 hover:text-pink-600"><Search size={17} /></button></form><button type="button" className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">▽ 絞り込み▼</button></div></div><form action={basePath} className="mt-5 flex max-w-sm items-center gap-3">{query && <input type="hidden" name="q" value={query} />}<select id={`${kind}-sort`} name="sort" defaultValue={sort} aria-label="並び順" className="h-10 min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="count-desc">登録作品数（多い順）</option><option value="count-asc">登録作品数（少ない順）</option></select><button className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-pink-600">適用</button></form></div></section>
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visible.map((item) => <Link key={item.name} href={`${basePath}/${encodeURIComponent(item.name)}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><WorkImage src={item.imageUrl} alt={`${item.name}の代表作品`} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" /></div><div className="flex flex-1 flex-col px-1 pb-1 pt-3"><h2 className="mt-1 line-clamp-2 break-all text-base font-black sm:text-lg">{item.name}</h2><div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-[10px] font-bold text-slate-400">登録作品数</p><p className="text-xl font-black text-pink-600">{item.count}<span className="ml-0.5 text-xs">作品</span></p></div><ArrowRight size={17} className="mb-1 shrink-0 text-pink-600" /></div></div></Link>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">該当する{label}が見つかりませんでした</p><Link href={basePath} className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>}{totalPages > 1 && <nav aria-label={`${label}一覧のページ送り`} className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}</div>
  </main></>;
}
