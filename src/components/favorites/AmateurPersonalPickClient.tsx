"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FanzaAmateurApiCard from "@/components/catalog/FanzaAmateurApiCard";
import { AMATEUR_FAVORITES_CHANGED_EVENT, readAmateurFavoriteIds } from "@/lib/amateurFavorites";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";

type Pick = { item: FanzaAmateurCatalogItem; reason: string };

export default function AmateurPersonalPickClient() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasFavorites, setHasFavorites] = useState(false);

  const load = useCallback(async () => {
    const ids = readAmateurFavoriteIds();
    setHasFavorites(ids.length > 0);
    if (!ids.length) {
      setPicks([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/amateur/personal-pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as { personalPicks?: Pick[] };
      setPicks(data.personalPicks ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(AMATEUR_FAVORITES_CHANGED_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(AMATEUR_FAVORITES_CHANGED_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [load]);

  if (loading) return <div className="rounded-3xl border bg-white p-12 text-center text-sm font-bold text-slate-500">お気に入りを読み込んでいます…</div>;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-white p-12 text-center"><p className="font-black">お気に入りを読み込めませんでした</p><button type="button" onClick={() => void load()} className="mt-4 text-sm font-black text-pink-600">もう一度試す</button></div>;
  if (!hasFavorites) return <div className="mx-auto max-w-3xl rounded-3xl border border-violet-200 bg-white p-8 text-center shadow-sm sm:p-12">
    <div className="text-5xl">✨</div>
    <h2 className="mt-5 text-2xl font-black">お気に入りを登録するとおすすめが届きます</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">素人作品カードや作品詳細ページのハートをタップすると、ジャンル・メーカー・シリーズ・価格帯・レビュー傾向を分析して、素人作品からおすすめを選びます。</p>
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      <Link href="/amateur" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🔎</span><br />Step 1<span className="mt-2 block text-xs font-medium text-slate-500">作品を探す</span></Link>
      <Link href="/amateur/sale" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🤍</span><br />Step 2<span className="mt-2 block text-xs font-medium text-slate-500">ハートをタップ</span></Link>
      <Link href="/amateur" className="rounded-2xl border border-slate-200 p-4 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50"><span className="text-2xl">🎯</span><br />Step 3<span className="mt-2 block text-xs font-medium text-slate-500">ここへ戻る</span></Link>
    </div>
    <p className="mt-10 text-xs font-bold text-slate-400">まずはここから探してみましょう</p>
    <div className="mt-3 flex flex-wrap justify-center gap-3">
      <Link href="/amateur" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">📈 人気の素人作品</Link>
      <Link href="/amateur/sale" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">🔥 セール中作品</Link>
      <Link href="/amateur" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:border-violet-300 hover:bg-violet-50">🆕 新着タイトル</Link>
    </div>
  </div>;

  if (!picks.length) return <div className="rounded-3xl border border-violet-200 bg-white p-10 text-center"><p className="text-xl font-black">おすすめを選ぶための傾向がまだ足りません</p><p className="mt-2 text-sm text-slate-500">素人作品のお気に入りを増やすと、共通するジャンルや価格帯から候補を探します。</p><Link href="/amateur" className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">素人作品を探す</Link></div>;

  return <section className="rounded-3xl border border-violet-200 bg-violet-50/60 p-4 sm:p-6">
    <div className="mb-5"><p className="text-xs font-black tracking-[0.18em] text-violet-600">好み発掘</p><h2 className="mt-1 text-2xl font-black">お気に入りから選んだおすすめ</h2><p className="mt-2 text-sm text-slate-600">お気に入りの素人作品のジャンル・メーカー・シリーズ・価格帯・レビュー傾向から選んでいます。</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{picks.map(({ item, reason }) => <div key={item.content_id} className="min-w-0"><p className="mb-2 truncate rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-700">{reason}</p><FanzaAmateurApiCard item={item} /></div>)}</div>
  </section>;
}
