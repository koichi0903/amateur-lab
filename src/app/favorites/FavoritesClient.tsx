"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { FAVORITES_CHANGED_EVENT, readFavoriteIds } from "@/lib/favorites";
import { workDetailHref } from "@/lib/affiliateTracking";

type FavoriteWork = {
  id: number; title: string; image_url: string | null; actress: string | null;
  maker: string | null; price: number | null; sale_price: number | null;
};

type PersonalPick = FavoriteWork & { reason: string; review_average: number | null; review_count: number | null; affiliate_url: string | null };

function currentPrice(work: { price: number | null; sale_price: number | null }) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price ?? 0;
}

export default function FavoritesClient({ personalPickOnly = false }: { personalPickOnly?: boolean }) {
  const [works, setWorks] = useState<FavoriteWork[]>([]);
  const [personalPicks, setPersonalPicks] = useState<PersonalPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const ids = readFavoriteIds();
    if (!ids.length) { setWorks([]); setPersonalPicks([]); setError(false); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as { works?: FavoriteWork[]; personalPicks?: PersonalPick[] };
      const byId = new Map((data.works ?? []).map((work) => [work.id, work]));
      setWorks(ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
      setPersonalPicks(data.personalPicks ?? []);
      setError(false);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(FAVORITES_CHANGED_EVENT, load);
    window.addEventListener("storage", load);
    return () => { window.removeEventListener(FAVORITES_CHANGED_EVENT, load); window.removeEventListener("storage", load); };
  }, [load]);

  if (loading) return <div className="rounded-3xl border bg-white p-12 text-center text-sm font-bold text-slate-500">お気に入りを読み込んでいます…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-white p-12 text-center"><p className="font-black">お気に入りを読み込めませんでした</p><button type="button" onClick={() => void load()} className="mt-4 text-sm font-black text-pink-600">もう一度試す</button></div>;
  if (!works.length) return personalPickOnly ? (
    <div className="mx-auto max-w-3xl rounded-3xl border border-violet-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="text-5xl">✨</div>
      <h2 className="mt-5 text-2xl font-black">お気に入りを登録するとおすすめが届きます</h2>
      <p className="mt-3 text-sm leading-7 text-slate-500">作品カードや詳細ページのハートをタップすると、女優・ジャンル・価格帯・レビュー傾向を分析してあなた向けの作品を選びます。</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link href="/ranking" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🔎</span><br />Step 1<span className="mt-2 block text-xs font-medium text-slate-500">作品を探す</span></Link>
        <Link href="/sale" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🤍</span><br />Step 2<span className="mt-2 block text-xs font-medium text-slate-500">ハートをタップ</span></Link>
        <Link href="/new" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🎯</span><br />Step 3<span className="mt-2 block text-xs font-medium text-slate-500">ここへ戻る</span></Link>
      </div>
      <p className="mt-10 text-xs font-bold text-slate-400">まずはここから探してみましょう</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Link href="/ranking" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">📈 急上昇ランキング</Link>
        <Link href="/sale" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">🔥 セール中作品</Link>
        <Link href="/new" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">🆕 新着タイトル</Link>
      </div>
    </div>
  ) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-xl font-black">お気に入りはまだありません</p><p className="mt-2 text-sm text-slate-500">作品ページの「♡ お気に入り」から追加できます。</p><Link href="/" className="mt-5 inline-block rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">作品を探す</Link></div>;

  return <>
    {personalPicks.length > 0 && <section className="mb-12 rounded-3xl border border-violet-200 bg-violet-50/60 p-4 sm:p-6"><div className="mb-5"><p className="text-xs font-black tracking-[0.18em] text-violet-600">好み発掘</p><h2 className="mt-1 text-2xl font-black">お気に入りから選んだおすすめ</h2><p className="mt-2 text-sm text-slate-600">お気に入りの女優・ジャンル・価格帯・レビュー傾向だけを使って選んでいます。</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{personalPicks.map((work) => <article key={work.id} className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"><Link href={workDetailHref(work.id, "favorites")} className="block"><div className="relative aspect-[3/4] bg-slate-100">{work.image_url ? <Image src={work.image_url} alt={work.title} fill sizes="(min-width: 1280px) 16vw, 50vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">画像なし</div>}</div><div className="p-3"><p className="line-clamp-2 text-xs font-black leading-5">{work.title}</p><p className="mt-2 line-clamp-1 text-[11px] font-bold text-violet-600">{work.reason}</p><p className="mt-2 text-sm font-black text-pink-600">{currentPrice(work) > 0 ? `¥${currentPrice(work).toLocaleString()}` : "価格未登録"}</p><p className="mt-1 text-[11px] font-bold text-amber-500">★ {work.review_average ? work.review_average.toFixed(1) : "-"}（{work.review_count ?? 0}件）</p></div></Link><div className="px-3 pb-3"><FavoriteButton workId={work.id} className="w-full rounded-xl border border-violet-200 py-2 text-xs font-bold text-violet-600 transition hover:bg-violet-50" /></div></article>)}</div></section>}
    {!personalPickOnly && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{works.map((work) => {
    const price = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
    return <article key={work.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Link href={workDetailHref(work.id, "favorites")} className="block"><div className="relative aspect-[3/4] bg-slate-100">{work.image_url ? <Image src={work.image_url} alt={work.title} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">画像なし</div>}</div>
      <div className="p-4"><h2 className="line-clamp-2 font-black leading-6">{work.title}</h2><p className="mt-2 truncate text-xs text-slate-500">{work.actress || work.maker || "作品詳細を見る"}</p><div className="mt-3"><span className="font-black text-pink-600">{price ? `¥${price.toLocaleString()}` : "価格未登録"}</span></div></div></Link>
      <div className="px-4 pb-4"><FavoriteButton workId={work.id} className="w-full rounded-xl border border-pink-200 py-2 text-sm font-bold text-pink-600 transition hover:bg-pink-50" /></div>
    </article>;
  })}</div>}
  </>;
}
