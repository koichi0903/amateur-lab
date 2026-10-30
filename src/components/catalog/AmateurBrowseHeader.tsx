import Link from "next/link";
import type { FanzaAmateurBrowsePageMode, FanzaAmateurBrowsePageRequest } from "@/lib/dmm/fanzaAmateurBrowseRequest";

type GenreOption = { name: string; count: number };

export function AmateurBrowseHeader({
  mode,
  request,
  today,
  totalCount,
  availableGenreOptions,
}: {
  mode: FanzaAmateurBrowsePageMode;
  request: FanzaAmateurBrowsePageRequest;
  today: string;
  totalCount: number;
  availableGenreOptions: GenreOption[];
}) {
  const hiddenFilters = [
    { name: "q", value: request.query },
    { name: "performer", value: request.performer || null },
    { name: "genre", value: request.genre || null },
    { name: "genres", value: request.genres.length ? request.genres.join(",") : null },
    { name: "maker", value: request.maker || null },
    { name: "releaseFrom", value: request.releaseFrom ?? null },
    { name: "releaseTo", value: request.releaseTo ?? null },
    { name: "minPrice", value: request.minPrice != null ? String(request.minPrice) : null },
    { name: "maxPrice", value: request.maxPrice != null ? String(request.maxPrice) : null },
    { name: "minRating", value: request.minRating != null ? String(request.minRating) : null },
  ].filter((field) => field.value !== null);

  if (mode === "sale") {
    return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-black tracking-tight">今日（{today}）のFANZAセール情報</h1>
      <form action={request.action} className="mt-5 flex max-w-[1040px] flex-wrap items-end gap-3">
        <label className="w-[calc(100%-88px)] text-xs font-black text-slate-600 sm:w-[220px]">並び順<select name="sort" defaultValue={request.sort} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="rank">人気順</option><option value="discount">割引率が高い順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option><option value="ending">終了が近い順</option></select></label>
        <label className="w-full text-xs font-black text-slate-600 sm:w-[220px]">上限価格<select name="maxPrice" defaultValue={request.maxPrice ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="300">300円以下</option><option value="500">500円以下</option><option value="1000">1,000円以下</option></select></label>
        <label className="w-full text-xs font-black text-slate-600 sm:w-[220px]">レビュー<select name="minRating" defaultValue={request.minRating ?? ""} className="mt-1 block h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">指定なし</option><option value="3.5">3.5以上</option><option value="4">4.0以上</option><option value="4.5">4.5以上</option></select></label>
        <button type="submit" className="h-11 shrink-0 rounded bg-slate-950 px-4 text-sm font-black text-white hover:bg-pink-600 sm:px-6">検索</button>
      </form>
    </div></section>;
  }

  if (request.showCompactSearchHeader) {
    return <section className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="flex items-baseline gap-2 text-2xl font-black tracking-tight sm:text-3xl">検索結果 <span className="text-sm font-bold text-slate-500 sm:text-base">{totalCount.toLocaleString("ja-JP")}件</span></h1>
      <form action={request.action} className="flex items-center gap-2">
        {hiddenFilters.map(({ name, value }) => <input key={name} type="hidden" name={name} value={value ?? ""} />)}
        <label htmlFor="amateur-sort" className="text-sm font-bold text-slate-600">並び順</label>
        <select id="amateur-sort" name="sort" defaultValue={request.sort} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
          <option value="rank">人気順</option>
          <option value="date_desc">発売日が新しい順</option>
          <option value="date_asc">発売日が古い順</option>
          <option value="price">価格が安い順</option>
          <option value="review">レビュー評価順</option>
        </select>
        <button type="submit" className="h-10 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-pink-600">適用</button>
      </form>
    </div></section>;
  }

  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
    <nav aria-label="パンくずリスト" className="text-xs font-bold text-slate-500"><Link href="/amateur" className="hover:text-pink-600">FANZA素人作品</Link><span className="mx-2">/</span><span aria-current="page">{request.title}</span></nav>
    <p className="mt-5 text-xs font-black tracking-[0.18em] text-pink-600">FANZA AMATEUR</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{request.title}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">FANZA素人カタログに保存された作品だけを検索します。女優作品のデータは含めません。</p>
    {mode !== "personal" && <form action={request.action} className="mt-6 grid max-w-5xl gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <label className="text-xs font-black text-slate-600">作品名・品番<input name="q" defaultValue={request.query} maxLength={100} placeholder="作品名、品番を入力" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
      <label className="text-xs font-black text-slate-600">女優名（登録名と一致）<input name="performer" defaultValue={request.performer} maxLength={100} placeholder="例：美園和花" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
      <label className="text-xs font-black text-slate-600">ジャンル<input name="genre" defaultValue={request.genre} maxLength={100} placeholder="例：素人、女子校生" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
      <label className="text-xs font-black text-slate-600">メーカー<input name="maker" defaultValue={request.maker} maxLength={100} placeholder="メーカー名を入力" className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" /></label>
      <button className="self-end rounded-lg bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-pink-600">検索する</button>
    </form>}
    {mode === "personal" && <form action={request.action} className="mt-6 flex max-w-2xl flex-wrap items-end gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <label className="min-w-56 flex-1 text-xs font-black text-slate-700">気になるジャンル<select name="genre" defaultValue={request.genre} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold"><option value="">ジャンルを選ぶ</option>{availableGenreOptions.map((item) => <option key={item.name} value={item.name}>{item.name}（直近保存データ内 {item.count}作品）</option>)}</select></label>
      <button className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700">おすすめを見る</button>
    </form>}
  </div></section>;
}
