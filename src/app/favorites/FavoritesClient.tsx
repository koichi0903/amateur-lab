"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { FAVORITES_CHANGED_EVENT, readFavoriteIds } from "@/lib/favorites";

type FavoriteWork = {
  id: number; title: string; image_url: string | null; actress: string | null;
  maker: string | null; score: number | null; price: number | null; sale_price: number | null;
};

export default function FavoritesClient() {
  const [works, setWorks] = useState<FavoriteWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const ids = readFavoriteIds();
    if (!ids.length) { setWorks([]); setError(false); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as { works?: FavoriteWork[] };
      const byId = new Map((data.works ?? []).map((work) => [work.id, work]));
      setWorks(ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
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
  if (!works.length) return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-xl font-black">お気に入りはまだありません</p><p className="mt-2 text-sm text-slate-500">作品ページの「♡ お気に入り」から追加できます。</p><Link href="/" className="mt-5 inline-block rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">作品を探す</Link></div>;

  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{works.map((work) => {
    const price = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
    return <article key={work.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Link href={`/works/${work.id}`} className="block"><div className="relative aspect-[3/4] bg-slate-100">{work.image_url ? <Image src={work.image_url} alt={work.title} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">画像なし</div>}</div>
      <div className="p-4"><h2 className="line-clamp-2 font-black leading-6">{work.title}</h2><p className="mt-2 truncate text-xs text-slate-500">{work.actress || work.maker || "作品詳細を見る"}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="font-black text-pink-600">{price ? `¥${price.toLocaleString()}` : "価格未登録"}</span>{typeof work.score === "number" && <span className="text-xs font-bold text-slate-500">発掘 {work.score}</span>}</div></div></Link>
      <div className="px-4 pb-4"><FavoriteButton workId={work.id} className="w-full rounded-xl border border-pink-200 py-2 text-sm font-bold text-pink-600 transition hover:bg-pink-50" /></div>
    </article>;
  })}</div>;
}
