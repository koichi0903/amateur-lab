import Link from "next/link";
import { getFanzaAmateurBrowsePage, getFanzaAmateurTaxonomy, type FanzaAmateurBrowseSort } from "@/lib/dmm/fanzaAmateurCatalog";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";

type Mode = "search" | "sale" | "personal";
type Params = { q?: string; genres?: string; genre?: string; maker?: string; page?: string; sort?: string; maxPrice?: string; minRating?: string; releaseFrom?: string; releaseTo?: string; minPrice?: string };

function formatTodayJa() {
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}年${value("month")}月${value("day")}日`;
}

export default async function AmateurBrowsePage({ mode, searchParams }: { mode: Mode; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const genre = (params.genre ?? "").trim().slice(0, 100);
  const genres = [...new Set((params.genres ?? "").split(",").map((value) => value.trim().slice(0, 100)).filter(Boolean))].slice(0, 30);
  const maker = (params.maker ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const parsedMaxPrice = /^\d+$/.test(params.maxPrice ?? "") ? Math.min(Number(params.maxPrice), 1_000_000) : undefined;
  const maxPrice = mode === "sale" ? ([300, 500, 1000].includes(parsedMaxPrice ?? -1) ? parsedMaxPrice : undefined) : parsedMaxPrice;
  const minRating = ["3.5", "4", "4.5"].includes(params.minRating ?? "") ? Number(params.minRating) : undefined;
  const allowedSorts: FanzaAmateurBrowseSort[] = mode === "sale" ? ["rank", "discount", "price", "review", "ending"] : ["rank", "date_desc", "date_asc", "price", "review"];
  const sort: FanzaAmateurBrowseSort = allowedSorts.includes(params.sort as FanzaAmateurBrowseSort) ? params.sort as FanzaAmateurBrowseSort : mode === "sale" ? "rank" : "date_desc";
  const title = mode === "sale" ? "素人作品のセール" : mode === "personal" ? "素人作品の好み発掘" : "素人作品を詳細検索";
  const releaseFrom = /^\d{4}-\d{2}-\d{2}$/.test(params.releaseFrom ?? "") ? params.releaseFrom : undefined;
  const releaseTo = /^\d{4}-\d{2}-\d{2}$/.test(params.releaseTo ?? "") ? params.releaseTo : undefined;
  const minPrice = /^\d+$/.test(params.minPrice ?? "") ? Math.min(Number(params.minPrice), 1_000_000) : undefined;
  const result = await getFanzaAmateurBrowsePage({ page, query, genre, genres, maker, sort, campaignOnly: mode === "sale", maxPrice, minRating, releaseFrom, releaseTo, minPrice });
  const availableGenreOptions = mode === "personal" && !genre ? await getFanzaAmateurTaxonomy("genre") : [];
  const action = mode === "sale" ? "/amateur/sale" : mode === "personal" ? "/amateur/personal-pick" : "/amateur/search";
  const showCompactSearchHeader = mode === "search" && (Boolean(query) || Boolean(genre) || Boolean(genres.length) || Boolean(maker) || Boolean(releaseFrom) || Boolean(releaseTo) || minPrice != null || maxPrice != null || sort === "rank");
  const today = formatTodayJa();

  return <main className="min-h-screen bg-[#f8fafc] text-slate-950">
    {mode === "sale" ? <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight">今日（{today}）のFANZAセール情報</h1>
      <form action={action} className="mt-5 flex max-w-[1040px] flex-wrap items-end gap-3">
        <label className="w-[calc(100%-88px)] text-xs font-black text-slate-600 sm:w-[220px]">並び順<select name="sort" defaultValue={sort} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="rank">人気順</option><option value="discount">割引率が高い順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option><option value="ending">終了が近い順</option></select></label>
        <label className="w-full text-xs font-black text-slate-600 sm:w-[220px]">上限価格<select name="maxPrice" defaultValue={maxPrice ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="300">300円以下</option><option value="500">500円以下</option><option value="1000">1,000円以下</option></select></label>
        <label className="w-full text-xs font-black text-slate-600 sm:w-[220px]">レビュー<select name="minRating" defaultValue={minRating ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="3.5">3.5以上</option><option value="4">4.0以上</option><option value="4.5">4.5以上</option></select></label>
        <button type="submit" className="h-11 shrink-0 rounded bg-slate-950 px-4 text-sm font-black text-white hover:bg-pink-600 sm:px-6">検索</button>
      </form>
    </div></section> : showCompactSearchHeader ? <section className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="flex items-baseline gap-2 text-2xl font-black tracking-tight sm:text-3xl">検索結果 <span className="text-sm font-bold text-slate-500 sm:text-base">{result.totalCount.toLocaleString("ja-JP")}件</span></h1>
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="q" value={query} />
        {genre && <input type="hidden" name="genre" value={genre} />}
        {genres.length > 0 && <input type="hidden" name="genres" value={genres.join(",")} />}
        {maker && <input type="hidden" name="maker" value={maker} />}
        {releaseFrom && <input type="hidden" name="releaseFrom" value={releaseFrom} />}
        {releaseTo && <input type="hidden" name="releaseTo" value={releaseTo} />}
        {minPrice != null && <input type="hidden" name="minPrice" value={minPrice} />}
        {maxPrice != null && <input type="hidden" name="maxPrice" value={maxPrice} />}
        {minRating != null && <input type="hidden" name="minRating" value={minRating} />}
        <label htmlFor="amateur-sort" className="text-sm font-bold text-slate-600">並び順</label>
        <select id="amateur-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
          <option value="rank">人気順</option>
          <option value="date_desc">発売日が新しい順</option>
          <option value="date_asc">発売日が古い順</option>
          <option value="price">価格が安い順</option>
          <option value="review">レビュー評価順</option>
        </select>
        <button type="submit" className="h-10 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-pink-600">適用</button>
      </form>
    </div></section> : <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="パンくずリスト" className="text-xs font-bold text-slate-500"><Link href="/amateur" className="hover:text-pink-600">FANZA素人作品</Link><span className="mx-2">/</span><span aria-current="page">{title}</span></nav>
      <p className="mt-5 text-xs font-black tracking-[0.18em] text-pink-600">FANZA AMATEUR</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">FANZA素人カタログに保存された作品だけを検索します。女優作品のデータは含めません。</p>
      {mode !== "personal" && <form action={action} className="mt-6 grid max-w-5xl gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-xs font-black text-slate-600">作品名・品番<input name="q" defaultValue={query} maxLength={100} placeholder="作品名、品番を入力" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
        <label className="text-xs font-black text-slate-600">ジャンル<input name="genre" defaultValue={genre} maxLength={100} placeholder="例：素人、女子校生" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
        <label className="text-xs font-black text-slate-600">メーカー<input name="maker" defaultValue={maker} maxLength={100} placeholder="メーカー名を入力" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
        <button className="self-end rounded-lg bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-pink-600">検索する</button>
      </form>}
      {mode === "personal" && <form action={action} className="mt-6 flex max-w-2xl flex-wrap items-end gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <label className="min-w-56 flex-1 text-xs font-black text-slate-700">気になるジャンル<select name="genre" defaultValue={genre} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold"><option value="">ジャンルを選ぶ</option>{availableGenreOptions.map((item) => <option key={item.name} value={item.name}>{item.name}（直近保存データ内 {item.count}作品）</option>)}</select></label>
        <button className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700">おすすめを見る</button>
      </form>}
    </div></section>}

    <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      {mode === "personal" && !genre ? <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-8 text-center"><p className="font-black">気になるジャンルを選んでください</p><p className="mt-2 text-sm text-slate-500">選んだジャンルの素人作品からおすすめを表示します。</p></div> : result.items.length ? <>
        {!showCompactSearchHeader && mode !== "sale" && <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-600">検索結果：{result.totalCount.toLocaleString("ja-JP")}件</p>{(query || genre || maker) && <Link href={action} className="text-xs font-black text-pink-600">条件をクリア</Link>}</div>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{result.cards.map((card) => <FanzaAmateurTopCard key={card.item.content_id} card={card} showRank={mode !== "sale"} />)}</div>
        {result.totalPages > 1 && <nav aria-label="素人作品検索結果のページ" className="mt-8 flex items-center justify-center gap-4">{page > 1 && <Link href={`${action}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(genre ? { genre } : {}), ...(genres.length ? { genres: genres.join(",") } : {}), ...(maker ? { maker } : {}), ...(releaseFrom ? { releaseFrom } : {}), ...(releaseTo ? { releaseTo } : {}), ...(minPrice != null ? { minPrice: String(minPrice) } : {}), ...(maxPrice ? { maxPrice: String(maxPrice) } : {}), ...(minRating ? { minRating: String(minRating) } : {}), sort, page: String(page - 1) })}`} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black">前へ</Link>}<span className="text-sm font-bold text-slate-500">{page} / {result.totalPages}</span>{page < result.totalPages && <Link href={`${action}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(genre ? { genre } : {}), ...(genres.length ? { genres: genres.join(",") } : {}), ...(maker ? { maker } : {}), ...(releaseFrom ? { releaseFrom } : {}), ...(releaseTo ? { releaseTo } : {}), ...(minPrice != null ? { minPrice: String(minPrice) } : {}), ...(maxPrice ? { maxPrice: String(maxPrice) } : {}), ...(minRating ? { minRating: String(minRating) } : {}), sort, page: String(page + 1) })}`} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">次へ</Link>}</nav>}
      </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black">該当する素人作品がありません</p><p className="mt-2 text-sm text-slate-500">条件を変えるか、素人作品一覧へ戻ってください。</p><Link href="/amateur" className="mt-4 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white">素人作品一覧</Link></div>}
    </section>
  </main>;
}
