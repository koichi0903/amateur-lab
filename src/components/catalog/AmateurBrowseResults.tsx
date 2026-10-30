import Link from "next/link";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import type { getFanzaAmateurBrowsePage } from "@/lib/dmm/fanzaAmateurCatalog";
import { buildFanzaAmateurBrowsePageHref } from "@/lib/dmm/fanzaAmateurBrowseProjection";
import type { FanzaAmateurBrowsePageMode, FanzaAmateurBrowsePageRequest } from "@/lib/dmm/fanzaAmateurBrowseRequest";

function hasBrowseResettableFilters(request: FanzaAmateurBrowsePageRequest) {
  return Boolean(request.query || request.performer || request.genre || request.maker);
}

function shouldShowBrowseResultSummary(mode: FanzaAmateurBrowsePageMode, request: FanzaAmateurBrowsePageRequest) {
  return !request.showCompactSearchHeader && mode !== "sale";
}

export function AmateurBrowseResults({ mode, request, result }: {
  mode: FanzaAmateurBrowsePageMode;
  request: FanzaAmateurBrowsePageRequest;
  result: Awaited<ReturnType<typeof getFanzaAmateurBrowsePage>>;
}) {
  return <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
    {mode === "personal" && !request.genre ? <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-8 text-center"><p className="font-black">気になるジャンルを選んでください</p><p className="mt-2 text-sm text-slate-500">選んだジャンルの素人作品からおすすめを表示します。</p></div> : result.items.length ? <>
      {shouldShowBrowseResultSummary(mode, request) && <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-600">検索結果：{result.totalCount.toLocaleString("ja-JP")}件</p>{hasBrowseResettableFilters(request) && <Link href={request.action} className="text-xs font-black text-pink-600">条件をクリア</Link>}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{result.cards.map((card) => <FanzaAmateurTopCard key={card.item.content_id} card={card} showRank={mode !== "sale"} />)}</div>
      {result.totalPages > 1 && <nav aria-label="素人作品検索結果のページ" className="mt-8 flex items-center justify-center gap-4">{request.page > 1 && <Link href={buildFanzaAmateurBrowsePageHref(request.action, { ...request, page: request.page - 1 })} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black">前へ</Link>}<span className="text-sm font-bold text-slate-500">{request.page} / {result.totalPages}</span>{request.page < result.totalPages && <Link href={buildFanzaAmateurBrowsePageHref(request.action, { ...request, page: request.page + 1 })} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">次へ</Link>}</nav>}
    </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black">該当する素人作品がありません</p><p className="mt-2 text-sm text-slate-500">条件を変えるか、素人作品一覧へ戻ってください。</p><Link href="/amateur" className="mt-4 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white">素人作品一覧</Link></div>}
  </section>;
}
