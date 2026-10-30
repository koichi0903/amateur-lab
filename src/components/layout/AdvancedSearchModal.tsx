"use client";

import { Filter, X } from "lucide-react";
import { useEffect, useState } from "react";

const genreOptions = [
  "10枚組", "16時間以上作品", "3D", "3P・4P", "4K", "4時間以上作品", "8KVR", "AI生成作品",
  "VR", "4時間以上作品", "人妻", "巨乳", "素人", "熟女", "美少女", "女子校生", "中出し", "企画",
  "単体作品", "ハイビジョン", "イラマチオ", "フェラ", "コスプレ", "レズ", "痴女", "NTR",
];

type AdvancedSearchModalProps = { open: boolean; onClose: () => void; catalog?: "fanza" | "amateur" };

export default function AdvancedSearchModal({ open, onClose, catalog = "fanza" }: AdvancedSearchModalProps) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [amateurGenreOptions, setAmateurGenreOptions] = useState<string[]>([]);
  const [amateurGenresLoaded, setAmateurGenresLoaded] = useState(false);
  const [amateurGenresError, setAmateurGenresError] = useState<string | null>(null);
  const isAmateur = catalog === "amateur";
  const availableGenres = isAmateur ? amateurGenreOptions : genreOptions;

  useEffect(() => {
    if (!open || !isAmateur || amateurGenresLoaded) return;
    let cancelled = false;
    fetch("/api/amateur/genres")
      .then(async (response) => {
        if (!response.ok) throw new Error("素人作品のジャンルを読み込めませんでした");
        return response.json() as Promise<{ genres?: unknown }>;
      })
      .then((data) => {
        if (cancelled) return;
        const genres = Array.isArray(data.genres) ? data.genres.filter((genre): genre is string => typeof genre === "string" && genre.trim().length > 0) : [];
        setAmateurGenreOptions(genres);
        setAmateurGenresLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setAmateurGenresError("素人作品のジャンルを読み込めませんでした");
      });
    return () => { cancelled = true; };
  }, [open, isAmateur, amateurGenresLoaded]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open) return null;

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre]);
  };

  const reset = () => {
    setSelectedGenres([]);
    const form = document.getElementById(isAmateur ? "advanced-search-form-amateur" : "advanced-search-form") as HTMLFormElement | null;
    form?.reset();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="advanced-search-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="advanced-search-title" className="flex items-center gap-2 text-lg font-black text-slate-950"><Filter size={19} className="text-pink-600" />詳細検索</h2>
          <button type="button" onClick={onClose} aria-label="詳細検索を閉じる" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form id={isAmateur ? "advanced-search-form-amateur" : "advanced-search-form"} action={isAmateur ? "/amateur/search" : "/search"} className="overflow-y-auto px-5 py-5">
          <label className="block text-xs font-black text-slate-600">キーワード<input name="q" maxLength={100} className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100" placeholder={isAmateur ? "作品名・品番など..." : "タイトル、メーカー名、女優名など..."} /></label>
          {isAmateur && <label className="mt-5 block text-xs font-black text-slate-600">女優名（登録名と一致）<input name="performer" maxLength={100} autoComplete="off" className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100" placeholder="例：美園和花" /></label>}
          <fieldset className="mt-5">
            <legend className="text-xs font-black text-slate-600">ジャンル</legend>
            <input name="genres" value={selectedGenres.join(",")} readOnly className="sr-only" aria-label="選択したジャンル" />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-300 bg-slate-50 p-2">
              {isAmateur && !amateurGenresLoaded && !amateurGenresError ? <p className="px-2 py-3 text-xs text-slate-500">素人作品のジャンルを読み込み中...</p> : amateurGenresError ? <p role="status" className="px-2 py-3 text-xs text-rose-600">{amateurGenresError}</p> : availableGenres.length ? <div className="flex flex-wrap gap-2">{availableGenres.map((genre) => <button key={genre} type="button" onClick={() => toggleGenre(genre)} className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-xs font-bold transition ${selectedGenres.includes(genre) ? "border-pink-500 bg-pink-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600"}`}>{genre}</button>)}</div> : <p className="px-2 py-3 text-xs text-slate-500">登録済みのジャンルはありません。</p>}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-600">発売日（開始）<input type="date" name="releaseFrom" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-pink-500" /></label>
            <label className="text-xs font-black text-slate-600">発売日（終了）<input type="date" name="releaseTo" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-pink-500" /></label>
            <label className="text-xs font-black text-slate-600">金額（最小）<input type="number" name="minPrice" min="0" step="1" placeholder="¥ 0" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-pink-500" /></label>
            <label className="text-xs font-black text-slate-600">金額（最大）<input type="number" name="maxPrice" min="0" step="1" placeholder="¥ 上限なし" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-pink-500" /></label>
          </div>
          <label className="mt-5 block text-xs font-black text-slate-600">並び替え<select name="sort" defaultValue={isAmateur ? "date_desc" : "release-desc"} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-pink-500">{isAmateur ? <><option value="date_desc">発売日が新しい順</option><option value="date_asc">発売日が古い順</option><option value="rank">人気順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option></> : <><option value="release-desc">発売日が新しい順</option><option value="release-asc">発売日が古い順</option><option value="score">発掘スコア順</option><option value="price">価格が安い順</option><option value="review">レビュー評価順</option></>}</select></label>
        </form>
        <div className="flex gap-3 border-t border-slate-200 px-5 py-4"><button type="button" onClick={reset} className="h-12 flex-1 rounded-lg border border-slate-300 text-sm font-black text-slate-700 hover:bg-slate-50">リセット</button><button type="submit" form={isAmateur ? "advanced-search-form-amateur" : "advanced-search-form"} className="h-12 flex-[1.5] rounded-lg bg-pink-600 text-sm font-black text-white hover:bg-pink-500">この条件で検索</button></div>
      </div>
    </div>
  );
}
