import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Sparkles, UserRound } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import {
  getEntityIndexSummaries,
  isEntityIndexable,
} from "@/lib/catalog/entityIndexSummaries";
import { pageMetadata } from "@/lib/seo";
import { getActressProfiles, type ActressProfile } from "@/lib/catalog/actressProfiles";

export const revalidate = 86400;

function normalizeActressSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return pageMetadata({
    title: `${query ? `「${query}」のFANZA女優検索結果` : "FANZA女優ランキング"}${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "FANZA作品の出演女優を、生年月日・身長・スリーサイズ・カップと出演作品数から探せます。",
    canonical: query ? "/actress" : `/actress${page > 1 ? `?page=${page}` : ""}`,
    robots: query ? { index: false, follow: true } : undefined,
  });
}

export default async function ActressPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = params.sort ?? "count-desc";
  const pageSize = 24;
  const ranked = (await getEntityIndexSummaries("actress")).filter((summary) =>
    isEntityIndexable("actress", summary),
  );
  const profiles = await getActressProfiles(ranked.map((item) => item.name));
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));
  const normalizedQuery = normalizeActressSearchText(query);
  const filtered = normalizedQuery
    ? ranked.filter((item) => {
      const profile = profileByName.get(item.name);
      return normalizeActressSearchText(item.name).includes(normalizedQuery)
        || normalizeActressSearchText(profile?.ruby).includes(normalizedQuery);
    })
    : ranked;
  const profileValue = (profile: ActressProfile | undefined, field: "height_cm" | "bust_cm" | "waist_cm" | "hip_cm") => profile?.[field] ?? null;
  const cupValue = (profile: ActressProfile | undefined) => profile?.cup ? [...profile.cup.toUpperCase()].reduce((sum, letter) => sum * 27 + (letter.charCodeAt(0) - 64), 0) : null;
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "count-desc" || sort === "count-asc") {
      return sort === "count-desc" ? b.count - a.count : a.count - b.count;
    }
    if (sort === "birthday-asc" || sort === "birthday-desc") {
      const aValue = profileByName.get(a.name)?.birthday ?? null;
      const bValue = profileByName.get(b.name)?.birthday ?? null;
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return sort === "birthday-asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    const descending = sort.endsWith("-desc");
    const fieldKey = sort.replace(/-(?:asc|desc)$/, "");
    const field = fieldKey === "height" ? "height_cm"
      : fieldKey === "bust" ? "bust_cm"
        : fieldKey === "waist" ? "waist_cm"
          : fieldKey === "hip" ? "hip_cm"
            : "cup";
    const aValue = field === "cup" ? cupValue(profileByName.get(a.name)) : profileValue(profileByName.get(a.name), field);
    const bValue = field === "cup" ? cupValue(profileByName.get(b.name)) : profileValue(profileByName.get(b.name), field);
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    return descending ? bValue - aValue : aValue - bValue;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
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
            <div>
              <div className="flex items-center gap-3"><UserRound size={24} /><h1 className="text-2xl font-black sm:text-3xl">AV女優検索</h1></div>
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
              {visible.map((item) => {
                const profile = profileByName.get(item.name);
                const profileImage = profile?.image_url_large || profile?.image_url_small || null;
                return (
                  <Link key={item.name} href={`/actress/${encodeURIComponent(item.name)}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg sm:p-3">
                    <div className="relative flex items-center justify-center">
                      <div className="relative h-28 w-28 overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm">
                        <WorkImage src={profileImage || item.imageUrl} fallbackSrc={profileImage ? item.imageUrl : null} alt={`${item.name}のプロフィール画像`} sizes="112px" unoptimized className="object-cover object-[50%_25%] transition duration-300 group-hover:scale-105" />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col px-1 pb-1 pt-1.5">
                      <h2 className="mt-0.5 truncate text-base font-black sm:text-lg">{item.name}</h2>
                      <div className="mt-1 h-[4rem] space-y-0.5 overflow-hidden text-xs font-bold leading-4 text-slate-500">
                        {profile?.birthday && <p>{profile.birthday}</p>}
                        {profile?.height_cm && <p>身長: {profile.height_cm}cm</p>}
                        {(profile?.bust_cm || profile?.waist_cm || profile?.hip_cm || profile?.cup) && <p>B{profile.bust_cm ?? "-"} W{profile.waist_cm ?? "-"} H{profile.hip_cm ?? "-"}{profile?.cup ? ` ${profile.cup}カップ` : ""}</p>}
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                        <div><p className="text-[10px] font-bold text-slate-400">登録作品数</p><p className="text-xl font-black text-pink-600">{item.count}<span className="ml-0.5 text-xs">作品</span></p></div>
                        <ArrowRight size={17} className="mb-1 text-pink-600" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Sparkles className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-black">該当する女優が見つかりませんでした</p><Link href="/actress" className="mt-3 inline-block text-sm font-black text-pink-600">一覧に戻る</Link></div>
          )}

          {totalPages > 1 && <nav aria-label="女優一覧のページ送り" className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}
        </div>
      </main>
    </>
  );
}
