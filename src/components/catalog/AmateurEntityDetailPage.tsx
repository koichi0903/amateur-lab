import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import { getFanzaAmateurBrowsePage, type FanzaAmateurBrowseSort } from "@/lib/dmm/fanzaAmateurCatalog";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { SITE_URL } from "@/lib/seo";

type Kind = "genre" | "maker";
function decodeEntityName(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
const SORTS: Array<{ value: FanzaAmateurBrowseSort; label: string }> = [
  { value: "rank", label: "人気順" },
  { value: "date_desc", label: "発売日が新しい順" },
  { value: "date_asc", label: "発売日が古い順" },
  { value: "price", label: "価格が安い順" },
  { value: "review", label: "レビュー評価順" },
];

export default async function AmateurEntityDetailPage({ kind, name, page = 1, requestedSort = "rank" }: { kind: Kind; name: string; page?: number; requestedSort?: string }) {
  const entityName = decodeEntityName(name);
  const sort = SORTS.some((item) => item.value === requestedSort) ? requestedSort as FanzaAmateurBrowseSort : "rank";
  const result = await getFanzaAmateurBrowsePage({ page, ...(kind === "genre" ? { genre: entityName } : { maker: entityName }), sort });
  const label = kind === "genre" ? "GENRE" : "MAKER";
  const path = `/amateur/${kind}/${encodeURIComponent(entityName)}`;
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (sort !== "rank") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    return params.size ? `${path}?${params.toString()}` : path;
  };

  const pageTitle = `${entityName}｜FANZA素人作品の${kind === "genre" ? "ジャンル" : "メーカー"}別一覧`;
  const pageDescription = `${entityName}のFANZA素人作品を人気順などで掲載。登録作品数は${result.totalCount.toLocaleString("ja-JP")}件です。各作品の発売日・価格・サンプルを確認できます。`;

  return <main className="min-h-screen bg-[#f8fafc] text-slate-950"><CollectionPageJsonLd title={pageTitle} description={pageDescription} url={`${SITE_URL}${path}`} items={result.cards.map((card) => ({ name: card.item.title, url: `${SITE_URL}/amateur/${encodeURIComponent(card.item.content_id)}`, image: card.item.imageUrl }))} /><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black tracking-widest text-pink-600">{label}</p><h1 className="mt-1 break-words text-3xl font-black">{entityName}</h1><p className="mt-2 text-sm text-slate-500">全{result.totalCount.toLocaleString("ja-JP")}作品</p></div>
      <form action={path} className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-500" /><label htmlFor="amateur-entity-sort" className="text-sm font-bold text-slate-600">並び順</label><select id="amateur-entity-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="submit" className="h-10 rounded-full bg-slate-950 px-4 text-sm font-black text-white hover:bg-pink-600">適用</button></form>
    </div>
    {result.items.length ? <section className="mt-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{result.cards.map((card) => <FanzaAmateurTopCard key={card.item.content_id} card={card} showRank={false} sourcePage="amateur_detail" />)}</div>{result.totalPages > 1 && <nav aria-label={`${entityName}の作品一覧ページ送り`} className="mt-8 flex items-center justify-center gap-3">{page > 1 && <Link href={pageHref(page - 1)} className="rounded border border-slate-200 bg-white px-5 py-3 text-sm font-black">← 前へ</Link>}<span className="text-xs font-bold text-slate-400">{page} / {result.totalPages}</span>{page < result.totalPages && <Link href={pageHref(page + 1)} className="rounded bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-pink-600">次のページ →</Link>}</nav>}</section> : <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-black">この{kind === "genre" ? "ジャンル" : "メーカー"}の素人作品は見つかりませんでした</p><Link href={`/amateur/${kind}`} className="mt-3 inline-block text-sm font-black text-pink-600">{kind === "genre" ? "ジャンル" : "メーカー"}一覧に戻る</Link></div>}
  </div></main>;
}
