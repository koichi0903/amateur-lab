import type { Metadata } from "next";
import Link from "next/link";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import { supabase } from "@/lib/supabase";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { isVrWork } from "@/lib/vr";
import { sortTrendingWorks } from "@/lib/trendingRanking";
import type { Work } from "@/types/work";

export const revalidate = 1800;
export const dynamic = "force-dynamic";
const VR_DATA_TIMEOUT_MS = 10_000;

type VrParams = { page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<VrParams> }): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return pageMetadata({
    title: `FANZA VR人気ランキング${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "FANZAのVR作品を、急上昇度・ランキング・レビュー・価格で比較できます。",
    canonical: page > 1 ? `/vr?page=${page}` : "/vr",
  });
}

async function getVrWorks() {
  try {
    const { data, error } = await Promise.race([
      supabase
        .from("works")
        .select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,review_average,review_count,ranking,realtime_rank,previous_realtime_rank,sale_end_at,affiliate_url")
        .or("genre.ilike.%VR%,title.ilike.%VR%")
        .limit(2000),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("VR works request timed out")), VR_DATA_TIMEOUT_MS)),
    ]);

    if (error) throw error;
    return sortTrendingWorks((data ?? []).filter(isVrWork) as unknown as Work[]);
  } catch (error) {
    console.warn("[vr] works are temporarily unavailable", error instanceof Error ? error.message : error);
    return [];
  }
}

export default async function VrPage({ searchParams }: { searchParams: Promise<VrParams> }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 30;
  const allWorks = await getVrWorks();
  const totalPages = Math.max(1, Math.ceil(allWorks.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const works = allWorks.slice((page - 1) * pageSize, page * pageSize);
  const pageHref = (targetPage: number) => targetPage > 1 ? `/vr?page=${targetPage}` : "/vr";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="VR人気ランキング"
          description="急上昇度・ランキング・レビュー・価格で比較できるVR作品一覧です。"
          url={`${SITE_URL}/vr`}
          items={works.map((work) => ({ name: work.title, url: `${SITE_URL}/works/${work.id}`, image: work.image_url }))}
        />
        <section className="bg-white">
          <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">FANZA VR人気ランキング</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">VR作品を急上昇度・ランキング・レビュー情報とあわせて比較できます。</p>
            <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-500 sm:text-sm">VR作品だけを対象に、いま注目されている作品から確認できます。価格やセール情報は作品詳細で確認してください。</p>
          </div>
        </section>
        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {works.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {works.map((work, index) => <FanzaStyleWorkCard key={work.id} work={work} sourcePage="ranking" rank={(page - 1) * pageSize + index + 1} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center font-black">VR作品を集計中です</div>
          )}
          {totalPages > 1 && <nav aria-label="VRランキングのページ送り" className="mt-10 flex items-center justify-center gap-3">
            {page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}
            <span className="text-xs font-bold text-slate-400">{page} / {totalPages}</span>
            {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}
          </nav>}
        </section>
      </main>
    </>
  );
}
