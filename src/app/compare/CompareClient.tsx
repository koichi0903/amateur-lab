"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, PlayCircle, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AffiliateLink from "@/app/components/AffiliateLink";
import {
  clearComparison,
  readComparisonIds,
  removeComparison,
  subscribeComparison,
} from "@/lib/comparison";
import { workDetailHref } from "@/lib/affiliateTracking";
import { parseDatabaseDate } from "@/lib/dateTime";

type CompareWork = {
  id: number;
  title: string;
  image_url: string | null;
  actress: string | null;
  genre: string | null;
  maker: string | null;
  series: string | null;
  score: number | null;
  price: number | null;
  sale_price: number | null;
  list_price: number | null;
  discount_rate: number | null;
  review_average: number | null;
  review_count: number | null;
  release_date: string | null;
  sample_movie_url: string | null;
  is_bottom_price: boolean | null;
  sale_end_at: string | null;
  affiliate_url: string | null;
};

function currentPrice(work: CompareWork) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = parseDatabaseDate(value);
  return !date || Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(date);
}

function ValueRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 py-3">
      <dt className="text-[10px] font-black tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-bold leading-6 text-slate-700">{children}</dd>
    </div>
  );
}

export default function CompareClient() {
  const [works, setWorks] = useState<CompareWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const ids = readComparisonIds();
    if (!ids.length) {
      setWorks([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("request failed");
      const payload = (await response.json()) as { works?: CompareWork[] };
      const byId = new Map((payload.works ?? []).map((work) => [work.id, work]));
      setWorks(ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeComparison(() => void load());
  }, [load]);

  if (loading) return <div className="rounded-3xl border bg-white p-14 text-center text-sm font-bold text-slate-500">比較作品を読み込んでいます…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-white p-14 text-center"><p className="font-black">比較作品を読み込めませんでした</p><button type="button" onClick={() => void load()} className="mt-4 text-sm font-black text-pink-600">もう一度試す</button></div>;
  if (!works.length) return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center">
      <p className="text-xl font-black">比較する作品はまだありません</p>
      <p className="mt-2 text-sm leading-7 text-slate-500">作品カードや詳細ページの「比較」から、最大4作品を追加できます。</p>
      <Link href="/deals" className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-pink-600">お得な作品から探す</Link>
    </div>
  );

  const prices = works.map(currentPrice).filter((price): price is number => !!price && price > 0);
  const lowest = prices.length ? Math.min(...prices) : null;
  const bestScore = Math.max(...works.map((work) => work.score ?? 0));
  const bestReview = Math.max(...works.map((work) => work.review_average ?? 0));

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-slate-500">{works.length}作品を比較中</p>
        <button type="button" onClick={clearComparison} className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-rose-600"><Trash2 size={14} />すべて外す</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {works.map((work) => {
          const price = currentPrice(work);
          const isLowest = lowest !== null && price === lowest;
          return (
            <article key={work.id} className="relative flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <button type="button" onClick={() => removeComparison(work.id)} aria-label={`${work.title}を比較から外す`} className="absolute right-2 top-2 z-10 rounded-full bg-white/95 p-2 text-slate-500 shadow transition hover:text-rose-600"><X size={16} /></button>
              <Link href={workDetailHref(work.id, "comparison")} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                {work.image_url ? <Image src={work.image_url} alt={work.title} fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">画像なし</span>}
              </Link>
              <h2 className="mt-4 line-clamp-3 min-h-[4.5rem] text-base font-black leading-6"><Link href={workDetailHref(work.id, "comparison")} className="hover:text-pink-600">{work.title}</Link></h2>
              <dl className="mt-3">
                <ValueRow label="現在の最安価格"><span className={`text-xl font-black ${isLowest ? "text-emerald-600" : "text-pink-600"}`}>{price ? `¥${price.toLocaleString("ja-JP")}` : "価格確認中"}</span>{isLowest && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">最安</span>}</ValueRow>
                <ValueRow label="割引・価格実績"><span className="flex flex-wrap gap-1.5">{work.discount_rate && work.discount_rate > 0 ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">{Math.round(work.discount_rate)}%OFF</span> : "割引なし"}{work.is_bottom_price && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">過去最安</span>}</span></ValueRow>
                <ValueRow label="発掘スコア"><span className={work.score === bestScore && bestScore > 0 ? "text-pink-600" : ""}>{work.score ? `${work.score}点` : "—"}{work.score === bestScore && bestScore > 0 && <Check className="ml-1 inline" size={14} />}</span></ValueRow>
                <ValueRow label="レビュー"><span className="flex items-center gap-1"><Star size={14} className="text-amber-500" fill="currentColor" />{work.review_average ? `${work.review_average.toFixed(2)}（${work.review_count ?? 0}件）` : "—"}{work.review_average === bestReview && bestReview > 0 && <Check className="text-emerald-600" size={14} />}</span></ValueRow>
                <ValueRow label="無料サンプル">{work.sample_movie_url ? <span className="flex items-center gap-1 text-sky-700"><PlayCircle size={14} />動画あり</span> : "なし・未取得"}</ValueRow>
                <ValueRow label="女優">{work.actress || "—"}</ValueRow>
                <ValueRow label="ジャンル">{work.genre || "—"}</ValueRow>
                <ValueRow label="メーカー / シリーズ">{[work.maker, work.series].filter(Boolean).join(" / ") || "—"}</ValueRow>
                <ValueRow label="発売日">{formatDate(work.release_date)}</ValueRow>
              </dl>
              <div className="mt-auto space-y-2 pt-4">
                <Link href={workDetailHref(work.id, "comparison")} className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-pink-300 hover:text-pink-600">詳細・価格履歴を見る</Link>
                {work.affiliate_url && <AffiliateLink href={work.affiliate_url} workId={work.id} placement="compare-card" sourcePage="comparison" className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:shadow-md" ariaLabel={`${work.title}をFANZA公式で確認する`}>FANZA公式で確認 <ExternalLink size={14} /></AffiliateLink>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
