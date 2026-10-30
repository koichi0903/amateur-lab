import Link from "next/link";
import { ArrowRight, Building2, Search, Tags } from "lucide-react";
import WorkImage from "@/components/home/WorkImage";
import { getFanzaAmateurTaxonomy } from "@/lib/dmm/fanzaAmateurCatalog";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { SITE_URL } from "@/lib/seo";
import { getPaginationItems } from "@/lib/catalog/pagination";

type Kind = "genre" | "maker";
type Sort = "count-desc" | "count-asc";
const PAGE_SIZE = 24;

export default async function AmateurTaxonomyPage({ kind, query = "", page = 1, sort = "count-desc" }: { kind: Kind; query?: string; page?: number; sort?: Sort }) {
  const isGenre = kind === "genre";
  const label = isGenre ? "ジャンル" : "メーカー";
  const Icon = isGenre ? Tags : Building2;
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const allItems = await getFanzaAmateurTaxonomy(kind);
  const filtered = allItems.filter((item) => item.name.toLocaleLowerCase("ja").includes(normalizedQuery));
  const sorted = [...filtered].sort((a, b) => sort === "count-asc" ? a.count - b.count || a.name.localeCompare(b.name, "ja") : b.count - a.count || a.name.localeCompare(b.name, "ja"));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginationItems = getPaginationItems(totalPages, currentPage);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const basePath = `/amateur/${kind}`;
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "count-desc") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    return params.size ? `${basePath}?${params.toString()}` : basePath;
  };

  const pageTitle = `FANZA素人作品の${label}検索`;
  const pageDescription = `FANZA公式APIの登録情報をもとに、素人作品の${label}と掲載作品数を一覧で確認できます。気になる${label}から作品を探せます。`;

  return <main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <CollectionPageJsonLd title={pageTitle} description={pageDescription} url={`${SITE_URL}${basePath}`} items={visible.map((item) => ({ name: item.name, url: `${SITE_URL}${basePath}/${encodeURIComponent(item.name)}`, image: item.imageUrl }))} />
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3"><Icon size={24} className="text-pink-600" /><h1 className="text-2xl font-black sm:text-3xl">素人作品の{label}検索</h1></div>
            <p className="mt-2 text-sm text-slate-600">素人作品の登録数が多い順・少ない順で{label}を探せます。</p>
          </div>
          <form action={basePath} className="flex w-full items-center gap-2 lg:w-auto">
            <input type="search" name="q" maxLength={100} defaultValue={query} aria-label={`${label}名で検索`} placeholder={`${label}名で検索`} className="h-10 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-pink-400 lg:w-[300px] lg:flex-none" />
            <button aria-label={`${label}を検索`} className="h-10 rounded bg-slate-950 px-4 text-sm font-black text-white hover:bg-pink-600"><Search size={17} /></button>
          </form>
        </div>
        <form action={basePath} className="mt-5 flex max-w-sm items-center gap-3">
          {query && <input type="hidden" name="q" value={query} />}
          <select name="sort" defaultValue={sort} aria-label="並び順" className="h-10 min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="count-desc">登録作品数（多い順）</option><option value="count-asc">登録作品数（少ない順）</option></select>
          <button className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-pink-600">適用</button>
        </form>
      </div>
    </section>
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visible.map((item) => <Link key={item.name} href={`${basePath}/${encodeURIComponent(item.name)}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"><WorkImage src={item.imageUrl} alt={`${item.name}の素人作品`} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px" unoptimized className="object-cover" /></div>
        <div className="flex flex-1 flex-col px-1 pb-1 pt-3"><h2 className="mt-1 line-clamp-2 break-all text-base font-black sm:text-lg">{item.name}</h2><div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-[10px] font-bold text-slate-400">登録作品数</p><p className="text-xl font-black text-pink-600">{item.count.toLocaleString("ja-JP")}<span className="ml-0.5 text-xs">作品</span></p></div><ArrowRight size={17} className="mb-1 shrink-0 text-pink-600" /></div></div>
      </Link>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">該当する素人作品の{label}が見つかりませんでした</p><Link href={basePath} className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>}
      {totalPages > 1 && <nav aria-label={`${label}一覧のページ送り`} className="mt-10 flex flex-wrap items-center justify-center gap-2">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black">← 前へ</Link>}{paginationItems.map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-sm text-slate-400">…</span> : <Link key={item} href={pageHref(item)} aria-current={item === currentPage ? "page" : undefined} aria-label={`${item}ページ目`} className={`min-w-9 rounded-full px-3 py-2 text-sm font-black ${item === currentPage ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600"}`}>{item}</Link>)}{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}
    </section>
  </main>;
}
