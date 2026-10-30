import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles, UserRound } from "lucide-react";
import Header from "@/components/layout/Header";
import ActressDirectoryCard from "@/components/catalog/ActressDirectoryCard";
import {
  getEntityIndexSummaries,
  isEntityIndexable,
} from "@/lib/catalog/entityIndexSummaries";
import { pageMetadata } from "@/lib/seo";
import { getActressProfiles } from "@/lib/catalog/actressProfiles";
import WorkCategorySwitch from "@/components/catalog/WorkCategorySwitch";
import { prepareActressDirectory, resolveActressSort } from "@/lib/catalog/actressDirectory";

export const revalidate = 43200;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return pageMetadata({
    title: `${query ? `「${query}」のFANZA女優検索結果` : "FANZA女優一覧｜出演作品数・プロフィール"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "FANZA作品の出演女優を、生年月日・身長・スリーサイズ・カップと出演作品数から探せます。",
    canonical: query ? "/actress" : `/actress${page > 1 ? `?page=${page}` : ""}`,
    robots: query || (params.sort !== undefined && params.sort !== "count-desc")
      ? { index: false, follow: true }
      : undefined,
  });
}

export default async function ActressPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = resolveActressSort(params.sort);
  const pageSize = 24;
  const ranked = (await getEntityIndexSummaries("actress")).filter((summary) =>
    isEntityIndexable("actress", summary),
  );
  const profiles = await getActressProfiles(ranked.map((item) => item.name));
  const { sorted, profileByName } = prepareActressDirectory(ranked, profiles, query, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (page > totalPages) notFound();
  const currentPage = page;
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (sort !== "count-desc") next.set("sort", sort);
    if (target > 1) next.set("page", String(target));
    const value = next.toString();
    return value ? `/actress?${value}` : "/actress";
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <WorkCategorySwitch active="actress" />
            <div>
              <div className="flex items-center gap-3"><UserRound size={24} /><h1 className="text-2xl font-black sm:text-3xl">FANZA女優検索・出演作品一覧</h1></div>
              <p className="mt-2 text-sm text-sky-300">出演作品数やプロフィールを見ながら女優を探せます。</p>
            </div>
            <div className="mt-5 flex w-full max-w-xl items-center gap-3">
              <form action="/actress" className="flex h-12 min-w-0 flex-1 items-center rounded border border-slate-200 bg-slate-50 px-3">
                <input type="search" name="q" defaultValue={query} aria-label="女優名で検索" placeholder="名前で検索（ひらがな可）" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                <button aria-label="女優名を検索" className="text-slate-400 hover:text-pink-600"><Search size={19} /></button>
              </form>
              <button type="button" className="h-12 shrink-0 rounded border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">▽ 絞り込み▼</button>
            </div>
            <form action="/actress" className="mt-3 flex max-w-sm items-center gap-3">
            {query && <input type="hidden" name="q" value={query} />}
            <select id="actress-sort" name="sort" defaultValue={sort} aria-label="並び順" className="h-10 min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
              <option value="count-desc">登録作品数（多い順）</option>
              <option value="count-asc">登録作品数（少ない順）</option>
              <option value="birthday-desc">生年月日（新しい順）</option>
              <option value="birthday-asc">生年月日（古い順）</option>
              <option value="cup-desc">カップ数（大きい順）</option>
              <option value="cup-asc">カップ数（小さい順）</option>
              <option value="height-desc">身長（高い順）</option>
              <option value="height-asc">身長（低い順）</option>
              <option value="bust-desc">バスト（大きい順）</option>
              <option value="bust-asc">バスト（小さい順）</option>
              <option value="waist-desc">ウエスト（大きい順）</option>
              <option value="waist-asc">ウエスト（小さい順）</option>
              <option value="hip-desc">ヒップ（大きい順）</option>
              <option value="hip-asc">ヒップ（小さい順）</option>
            </select>
            <button className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-pink-600">適用</button>
            </form>
          </div>
        </section>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visible.map((item) => (
                <ActressDirectoryCard key={item.name} item={item} profile={profileByName.get(item.name)} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">該当する女優が見つかりませんでした</p><Link href="/actress" className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="女優一覧のページ送り"
              className="mt-10 flex flex-wrap items-center justify-center gap-2"
            >
              {currentPage > 1 && (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black"
                >
                  ← 前へ
                </Link>
              )}
              <span className="sr-only">{currentPage} / {totalPages}</span>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                pageNumber === currentPage ? (
                  <span
                    key={pageNumber}
                    aria-current="page"
                    aria-label={`${pageNumber}ページ目（現在のページ）`}
                    className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full bg-pink-600 px-3 text-sm font-black text-white"
                  >
                    {pageNumber}
                  </span>
                ) : (
                  <Link
                    key={pageNumber}
                    href={pageHref(pageNumber)}
                    aria-label={`${pageNumber}ページ目へ`}
                    className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:border-pink-300 hover:text-pink-600"
                  >
                    {pageNumber}
                  </Link>
                )
              ))}
              {currentPage < totalPages && (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-pink-600"
                >
                  次へ →
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
