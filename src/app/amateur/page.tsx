import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkCategorySwitch from "@/components/catalog/WorkCategorySwitch";
import FanzaAmateurApiCard from "@/components/catalog/FanzaAmateurApiCard";
import { getFanzaAmateurCatalogPage, type FanzaAmateurSort } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 900;

const SORTS: Array<{ value: FanzaAmateurSort; label: string }> = [
  { value: "rank", label: "人気順" },
  { value: "date", label: "新着順" },
  { value: "review", label: "レビュー順" },
  { value: "price", label: "価格が安い順" },
  { value: "-price", label: "価格が高い順" },
];

export const metadata: Metadata = pageMetadata({
  title: "FANZA素人作品｜新着・価格・レビューから探す | 発掘LAB",
  description: "FANZA公式APIの素人作品情報をSupabaseに保存し、新着・人気・価格・レビュー順で探せます。",
  canonical: "/amateur",
});

export default async function AmateurPage({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string }> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = SORTS.some((item) => item.value === params.sort) ? params.sort as FanzaAmateurSort : "rank";
  let result: Awaited<ReturnType<typeof getFanzaAmateurCatalogPage>> | null = null;
  let errorMessage: string | null = null;

  try {
    result = await getFanzaAmateurCatalogPage({ page, sort });
  } catch (error) {
    console.error("[fanza-amateur] catalog load failed", error instanceof Error ? error.message : "unknown");
    errorMessage = error instanceof Error ? error.message : "作品一覧を読み込めませんでした。";
  }

  const actualPage = result?.page ?? page;
  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (targetPage > 1) query.set("page", String(targetPage));
    if (sort !== "rank") query.set("sort", sort);
    const suffix = query.toString();
    return suffix ? `/amateur?${suffix}` : "/amateur";
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
            <WorkCategorySwitch active="amateur" />
            <p className="mt-6 text-xs font-black tracking-[0.18em] text-pink-600">FANZA AMATEUR</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">FANZA素人作品を探す</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">未保存ページはFANZA Web APIから取得してSupabaseに保存します。保存済みページはそのデータを表示します。定期更新ルールは未設定です。</p>
                <p className="mt-2 text-xs text-slate-500">対象：FANZA 動画・素人（APIフロア videoc）／送客ID：991</p>
              </div>
              {result && <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-4 py-3">
                <span className="text-xs font-bold text-slate-500">作品総数</span>
                <strong className="text-xl font-black text-pink-600">{result.totalCount.toLocaleString("ja-JP")}{result.totalCount >= 50_000 ? "+" : ""}</strong>
                <span className="text-xs font-bold text-slate-500">件</span>
              </div>}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-sm font-bold text-slate-600">{result ? `${result.items.length}作品を表示` : "作品一覧"}</p>
              {result?.fetchedAt && <p className="mt-1 text-xs text-slate-500">Supabase保存データ／取得 {new Date(result.fetchedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>}
            </div>
            <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-500" /><label htmlFor="amateur-sort" className="text-sm font-bold text-slate-600">並び順</label>
              <form>
                <select id="amateur-sort" name="sort" defaultValue={sort} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold" aria-label="並び順">
                  {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {actualPage > 1 && <input type="hidden" name="page" value={actualPage} />}
                <button type="submit" className="ml-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">適用</button>
              </form>
            </div>
          </div>

          {errorMessage ? (
            <div role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
              <p className="font-black">素人作品APIを読み込めませんでした</p>
              <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
            </div>
          ) : result?.items.length ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {result.items.map((item) => <FanzaAmateurApiCard key={item.content_id} item={item} />)}
              </div>
              {result.totalPages > 1 && <nav aria-label="素人作品一覧のページ送り" className="mt-8 flex items-center justify-center gap-4">
                {actualPage > 1 && <Link href={pageHref(actualPage - 1)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700">前へ</Link>}
                <span className="text-sm font-bold text-slate-500">{actualPage} / {result.totalPages}</span>
                {actualPage < result.totalPages && <Link href={pageHref(actualPage + 1)} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ</Link>}
              </nav>}
            </>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14">
              <p className="font-black">現在表示できる作品がありません</p>
              <p className="mt-2 text-sm text-slate-500">API応答を確認してから、再度お試しください。</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
