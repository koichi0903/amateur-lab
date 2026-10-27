import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search, Sparkles, UserRound } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkCategorySwitch from "@/components/catalog/WorkCategorySwitch";
import WorkImage from "@/components/home/WorkImage";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { getFanzaAmateurActressIndex, type FanzaAmateurActressSort } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

const SORTS: Array<{ value: FanzaAmateurActressSort; label: string }> = [
  { value: "count-desc", label: "登録作品数（多い順）" },
  { value: "count-asc", label: "登録作品数（少ない順）" },
  { value: "birthday-desc", label: "生年月日（新しい順）" },
  { value: "birthday-asc", label: "生年月日（古い順）" },
  { value: "cup-desc", label: "カップ数（大きい順）" },
  { value: "cup-asc", label: "カップ数（小さい順）" },
  { value: "height-desc", label: "身長（高い順）" },
  { value: "height-asc", label: "身長（低い順）" },
  { value: "bust-desc", label: "バスト（大きい順）" },
  { value: "bust-asc", label: "バスト（小さい順）" },
  { value: "waist-desc", label: "ウエスト（細い順）" },
  { value: "waist-asc", label: "ウエスト（太い順）" },
  { value: "hip-desc", label: "ヒップ（大きい順）" },
  { value: "hip-asc", label: "ヒップ（小さい順）" },
];

function pageHref(target: number, query: string, sort: FanzaAmateurActressSort) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== "count-desc") params.set("sort", sort);
  if (target > 1) params.set("page", String(target));
  return params.size ? `/amateur/actress?${params.toString()}` : "/amateur/actress";
}

function visiblePageNumbers(currentPage: number, totalPages: number): Array<number | "start-ellipsis" | "end-ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 3) return [1, "start-ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "start-ellipsis", currentPage - 1, currentPage, currentPage + 1, "end-ellipsis", totalPages];
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return pageMetadata({
    title: `${query ? `「${query}」の素人出演女優検索結果` : "素人出演女優検索・出演作品一覧"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "出演者が確認できたFANZA素人作品を、女優プロフィールや作品数から検索できます。",
    canonical: query ? "/amateur/actress" : `/amateur/actress${page > 1 ? `?page=${page}` : ""}`,
    robots: query || (params.sort && params.sort !== "count-desc") ? { index: false, follow: true } : undefined,
  });
}

export default async function AmateurActressPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = SORTS.some(({ value }) => value === params.sort) ? params.sort as FanzaAmateurActressSort : "count-desc";
  const result = await getFanzaAmateurActressIndex({ query, sort, page });
  if (page > result.totalPages) notFound();
  const currentPage = page;
  const canonicalUrl = `${SITE_URL}/amateur/actress${currentPage > 1 ? `?page=${currentPage}` : ""}`;

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950">
    <CollectionPageJsonLd
      title={`FANZA素人 女優検索・出演作品一覧${currentPage > 1 ? ` ${currentPage}ページ目` : ""} | 発掘LAB`}
      description="出演者が確認できたFANZA素人作品を、女優プロフィールや作品数から探せます。作品別の価格情報と価格履歴も確認できます。"
      url={canonicalUrl}
      items={result.items.map((item) => ({
        name: item.name,
        url: `${SITE_URL}/amateur/actress/${encodeURIComponent(item.name)}`,
        image: item.profile_image_url || item.image_url || undefined,
      }))}
    />
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <WorkCategorySwitch active="amateur" />
        <div className="mt-4"><div className="flex items-center gap-3"><UserRound size={24} /><h1 className="text-2xl font-black sm:text-3xl">FANZA素人 女優検索・出演作品一覧</h1></div>
          <p className="mt-2 text-sm text-slate-500">素人作品で出演者が確認できた女優を、プロフィールや作品数から探せます。</p></div>
        <div className="mt-5 flex w-full max-w-xl items-center gap-3">
          <form action="/amateur/actress" className="flex h-12 min-w-0 flex-1 items-center rounded border border-slate-200 bg-slate-50 px-3">
            <input type="search" name="q" defaultValue={query} aria-label="女優名で検索" placeholder="名前で検索（ひらがな可）" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            {sort !== "count-desc" && <input type="hidden" name="sort" value={sort} />}
            <button aria-label="女優名を検索" className="text-slate-400 hover:text-pink-600"><Search size={19} /></button>
          </form>
        </div>
        <form action="/amateur/actress" className="mt-3 flex max-w-sm items-center gap-3">
          {query && <input type="hidden" name="q" value={query} />}
          <select id="amateur-actress-sort" name="sort" defaultValue={sort} aria-label="並び順" className="h-10 min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
            {SORTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-pink-600">適用</button>
        </form>
      </div>
    </section>
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {result.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {result.items.map((item) => {
          const profileImage = item.profile_image_url;
          return <Link key={item.name} href={`/amateur/actress/${encodeURIComponent(item.name)}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
            <div className="relative flex items-center justify-center"><div className="relative h-28 w-28 overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">
              <WorkImage src={profileImage || item.image_url} fallbackSrc={profileImage ? item.image_url : null} alt={`${item.name}のプロフィール画像`} sizes="112px" unoptimized className="object-cover object-[50%_25%] transition duration-300 group-hover:scale-105" />
            </div></div>
            <div className="flex flex-1 flex-col px-1 pb-1 pt-1.5">
              <h2 className="mt-0.5 truncate text-base font-black sm:text-lg">{item.name}</h2>
              <div className="mt-1 h-[4rem] space-y-0.5 overflow-hidden text-xs font-bold leading-4 text-slate-500">
                {item.birthday && <p>{item.birthday}</p>}
                {item.height_cm && <p>身長: {item.height_cm}cm</p>}
                {(item.bust_cm || item.waist_cm || item.hip_cm || item.cup) && <p>B{item.bust_cm ?? "-"} W{item.waist_cm ?? "-"} H{item.hip_cm ?? "-"}{item.cup ? ` ${item.cup}カップ` : ""}</p>}
              </div>
              <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2"><div><p className="text-[10px] font-bold text-slate-400">素人作品</p><p className="text-xl font-black text-pink-600">{Number(item.work_count).toLocaleString("ja-JP")}<span className="ml-0.5 text-xs">作品</span></p></div><ArrowRight size={17} className="mb-1 text-pink-600" /></div>
            </div>
          </Link>;
        })}
      </div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">該当する女優が見つかりませんでした</p><Link href="/amateur/actress" className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>}
      {result.totalPages > 1 && <nav aria-label="素人女優一覧のページ送り" className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {currentPage > 1 && <Link href={pageHref(currentPage - 1, query, sort)} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black">← 前へ</Link>}
        <span className="sr-only">{currentPage} / {result.totalPages}</span>
        {visiblePageNumbers(currentPage, result.totalPages).map((pageNumber, index) => typeof pageNumber !== "number"
          ? <span key={pageNumber} aria-hidden="true" className="px-1 text-sm font-black text-slate-400">…</span>
          : pageNumber === currentPage
            ? <span key={pageNumber} aria-current="page" aria-label={`${pageNumber}ページ目（現在のページ）`} className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full bg-pink-600 px-3 text-sm font-black text-white">{pageNumber}</span>
            : <Link key={`${pageNumber}-${index}`} href={pageHref(pageNumber, query, sort)} aria-label={`${pageNumber}ページ目へ`} className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:border-pink-300 hover:text-pink-600">{pageNumber}</Link>)}
        {currentPage < result.totalPages && <Link href={pageHref(currentPage + 1, query, sort)} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}
      </nav>}
    </div>
  </main></>;
}

