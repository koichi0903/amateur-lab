import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgePercent } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkImage from "@/components/home/WorkImage";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { pageMetadata } from "@/lib/seo";
import { workDetailHref } from "@/lib/affiliateTracking";

const PAGE_SIZE = 20;

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  return pageMetadata({
    title: `セール中の作品${page > 1 ? ` ${page}ページ目` : ""} | 発掘LAB`,
    description: "現在セール中のFANZA作品を、割引率が高い順に紹介します。",
    canonical: page > 1 ? `/sale?page=${page}` : "/sale",
  });
}

function saleDetails(work: Work) {
  const salePrice = work.sale_price > 0 ? work.sale_price : 0;
  const regularPrice = work.list_price && work.list_price > salePrice ? work.list_price : work.price;
  const rate = work.discount_rate > 0
    ? Math.round(work.discount_rate)
    : regularPrice > salePrice && salePrice > 0
      ? Math.round((1 - salePrice / regularPrice) * 100)
      : 0;
  return { salePrice, regularPrice, rate };
}

function formatSaleEnd(value: string | null) {
  if (!value || Date.parse(value) <= Date.now()) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function SaleCard({ work }: { work: Work }) {
  const sale = saleDetails(work);
  const saleEnd = formatSaleEnd(work.sale_end_at);
  return (
    <Link href={workDetailHref(work.id, "sale")} className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <WorkImage src={work.image_url} alt={work.title} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px" unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
        <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">SALE</span>
        <span className="absolute bottom-2 right-2 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow-sm">{sale.rate}%OFF</span>
      </div>
      <h2 className="mt-3 line-clamp-2 min-h-10 break-all text-sm font-black leading-5">{work.title}</h2>
      <div className="mt-auto pt-3">
        <p className="text-[11px] font-bold text-slate-400 line-through">通常 ¥{sale.regularPrice.toLocaleString("ja-JP")}</p>
        <p className="text-lg font-black text-rose-600">¥{sale.salePrice.toLocaleString("ja-JP")}</p>
        {saleEnd && <p className="mt-1 text-[10px] font-bold text-amber-700">終了予定 {saleEnd}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] font-black">
          <span className="text-amber-600">
            {work.review_average > 0
              ? `★ ${work.review_average.toFixed(2)}（${work.review_count ?? 0}件）`
              : work.score > 0
                ? `発掘スコア ${work.score}`
                : "作品データを見る"}
          </span>
          <span className="shrink-0 text-pink-600">価格・サンプル →</span>
        </div>
      </div>
    </Link>
  );
}

export default async function SalePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const offset = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("works")
    .select("id,title,image_url,price,sale_price,list_price,discount_rate,score,review_average,review_count,sale_end_at", { count: "exact" })
    .gt("sale_price", 0)
    .gt("discount_rate", 0)
    .order("discount_rate", { ascending: false })
    .order("score", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const works = (data ?? []) as Work[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 transition hover:text-pink-600">TOP <span className="mx-1">/</span> セール</Link>
            <div className="mt-5 flex items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-rose-50 p-3 text-rose-600"><BadgePercent size={28} /></span>
              <div><p className="text-xs font-black tracking-[0.18em] text-rose-600">SALE DISCOVERY</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">セール中の作品</h1><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">現在セール中の作品を、割引率が高い順に掲載しています。価格・レビュー・無料サンプルを比較して選べます。</p></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-8 grid gap-3 rounded-2xl border border-rose-100 bg-white p-4 text-xs font-bold leading-6 text-slate-600 sm:grid-cols-3 sm:p-5">
            <p><span className="mr-2 text-emerald-600">✓</span>割引率が高い順に比較</p>
            <p><span className="mr-2 text-emerald-600">✓</span>レビューと発掘スコアを確認</p>
            <p><span className="mr-2 text-emerald-600">✓</span>最終価格はFANZA公式で確認</p>
          </div>
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-rose-600">ON SALE</p><h2 className="mt-1 text-2xl font-black">セール作品一覧</h2></div><span className="shrink-0 text-xs font-bold text-slate-500">全{total.toLocaleString("ja-JP")}作品</span></div>
          {error ? (
            <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center font-black">セール作品を読み込めませんでした</div>
          ) : works.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{works.map((work) => <SaleCard key={work.id} work={work} />)}</div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">現在掲載中のセール作品はありません</p></div>
          )}

          {totalPages > 1 && (
            <nav aria-label="セール作品のページ送り" className="mt-10 flex items-center justify-center gap-3">
              {page > 1 ? <Link href={page === 2 ? "/sale" : `/sale?page=${page - 1}`} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black shadow-sm hover:border-pink-300 hover:text-pink-600"><ArrowLeft size={15} /> 前へ</Link> : <span />}
              <span className="text-sm font-bold text-slate-500">{page} / {totalPages}</span>
              {page < totalPages ? <Link href={`/sale?page=${page + 1}`} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black shadow-sm hover:border-pink-300 hover:text-pink-600">次へ <ArrowRight size={15} /></Link> : <span />}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
