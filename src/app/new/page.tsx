import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 1800;
type NewParams = { page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<NewParams> }): Promise<Metadata> {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  return pageMetadata({
    title: `FANZA新着作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "発売日の新しいFANZA作品を、価格・割引・レビュー情報とあわせて紹介します。",
    canonical: page > 1 ? `/new?page=${page}` : "/new",
  });
}
const PAGE_SIZE = 48;

function WorkCard({ work }: { work: Work }) {
  return <FanzaStyleWorkCard work={work} sourcePage="new" showChart={false} />;
}

export default async function NewPage({ searchParams }: { searchParams: Promise<NewParams> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let offset = (page - 1) * PAGE_SIZE;
  const buildQuery = () => supabase.from("works").select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,release_date,review_average,review_count,sale_end_at,affiliate_url", { count: "exact" }).eq("stage", "NEW").order("release_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
  let response = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
  const total = response.count ?? response.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) {
    offset = (currentPage - 1) * PAGE_SIZE;
    response = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
  }
  const works = (response.data ?? []) as unknown as Work[];
  const error = response.error;
  const href = (target: number) => target > 1 ? `/new?page=${target}` : "/new";

  return <><Header /><main className="min-h-screen bg-[#f8fafc] text-slate-950"><section className="bg-white"><div className="mx-auto max-w-[1500px] px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8"><h1 className="text-3xl font-black tracking-tight sm:text-5xl">FANZA新着作品</h1><p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">最新リリース作品を発売日の新しい順に掲載。価格・割引・レビュー情報とあわせて確認できます。</p><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-500 sm:text-sm">気になる作品は詳細ページで価格やセール情報を確認できます。発売日が新しい作品から、今チェックしたい作品を探せます。</p></div></section><section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{error ? <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center"><p className="font-black">新着作品を読み込めませんでした</p><p className="mt-2 text-sm text-slate-500">時間をおいて、もう一度お試しください。</p></div> : works.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{works.map((work) => <WorkCard key={work.id} work={work} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-14"><Sparkles className="mx-auto text-slate-300" size={40} /><p className="mt-4 font-black">現在表示できる新着作品はありません</p></div>}{totalPages > 1 && <nav aria-label="新着作品のページ送り" className="mt-10 flex items-center justify-center gap-3">{currentPage > 1 && <Link href={href(currentPage - 1)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>{currentPage < totalPages && <Link href={href(currentPage + 1)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次へ →</Link>}</nav>}</section></main></>;
}
