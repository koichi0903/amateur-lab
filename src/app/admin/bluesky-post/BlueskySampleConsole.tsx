"use client";

import { useEffect, useState } from "react";

type WorkMedia = {
  contentId: string;
  title: string | null;
  releaseDate: string | null;
  isListed: boolean;
  coverImageUrl: string | null;
  sampleImageUrls: string[];
  sampleMovieUrl: string | null;
  sampleMovieReady: boolean;
};

const control = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";

export function BlueskySampleConsole() {
  const [contentId, setContentId] = useState("");
  const [work, setWork] = useState<WorkMedia | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [startSeconds, setStartSeconds] = useState("0");
  const [endSeconds, setEndSeconds] = useState("15");
  const [clipUrl, setClipUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl); }, [clipUrl]);

  async function loadWork() {
    setLoading(true); setMessage(""); setClipUrl(""); setWork(null);
    try {
      const response = await fetch(`/api/admin/bluesky-post?contentId=${encodeURIComponent(contentId)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as WorkMedia & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "作品素材を取得できませんでした。");
      setWork(body); setSelectedImage(0); setMessage("作品素材を読み込みました。投稿候補や履歴の状態は変更していません。");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }

  async function makeClip() {
    if (!work) return;
    setLoading(true); setMessage(""); setClipUrl("");
    try {
      const params = new URLSearchParams({ contentId: work.contentId, startSeconds, endSeconds });
      const response = await fetch(`/api/admin/bluesky-post/video?${params}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "切り抜き動画を作成できませんでした。");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      setClipUrl(objectUrl); setMessage("指定範囲のMP4を作成しました。投稿は行っていません。");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }

  const activeImage = work?.sampleImageUrls[selectedImage] ?? null;
  return <>
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <label className="block max-w-xl text-sm font-bold">FANZA品番
        <div className="mt-2 flex gap-2"><input value={contentId} onChange={(event) => setContentId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadWork(); }} placeholder="例: hoi435" className={`${control} min-w-0 flex-1`} /><button onClick={() => void loadWork()} disabled={loading || !contentId.trim()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40">{loading ? "取得中…" : "素材を表示"}</button></div>
      </label>
      <p className="mt-2 text-xs leading-5 text-zinc-400">FANZA作品データに保存済みの公式サンプル画像・動画を読み込みます。読み取り専用で、X/Blueskyへの投稿や投稿履歴の変更はしません。</p>
    </section>

    {work && <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-xl font-black">公式サンプル画像</h2>
        <p className="mt-1 text-sm text-zinc-400">{work.title ?? work.contentId} / 発売日 {work.releaseDate ?? "未取得"}</p>
        {activeImage ? <>
          <a href={activeImage} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl bg-black text-center">
            {/* DMM's public sample image is rendered from the saved official API URL. */}
            {/* Dynamic DMM sample hosts vary by work; use their saved official URL directly. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeImage} alt={`${work.title ?? work.contentId} 公式サンプル ${selectedImage + 1}`} className="mx-auto max-h-[560px] w-auto max-w-full object-contain" />
          </a>
          <div className="mt-3 flex flex-wrap gap-2">{work.sampleImageUrls.map((url, index) => <button key={url} onClick={() => setSelectedImage(index)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${selectedImage === index ? "border-sky-400 bg-sky-950 text-sky-100" : "border-zinc-700 text-zinc-300"}`}>画像 {index + 1}</button>)}</div>
          <p className="mt-2 text-xs text-zinc-500">画像をクリックすると公式画像を別タブで開きます。</p>
        </> : <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">この作品のサンプル画像URLは保存データにありません。</p>}
        {!work.isListed && <p className="mt-3 text-xs text-amber-200">現在、サイト掲載対象外の作品です。</p>}
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-xl font-black">公式サンプル動画の切り抜き</h2>
        {work.sampleMovieReady && work.sampleMovieUrl ? <>
          <video controls preload="metadata" className="mt-4 aspect-video w-full rounded-xl bg-black" src={work.sampleMovieUrl}><track kind="captions" /></video>
          <p className="mt-2 text-xs text-zinc-400">元動画の長さを読み込んで、切り抜く範囲を秒で指定してください。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="text-xs text-zinc-400">開始秒<input type="number" min="0" max="600" step="0.1" value={startSeconds} onChange={(event) => setStartSeconds(event.target.value)} className={`${control} mt-1 block w-32`} /></label>
            <label className="text-xs text-zinc-400">終了秒<input type="number" min="0.1" max="600" step="0.1" value={endSeconds} onChange={(event) => setEndSeconds(event.target.value)} className={`${control} mt-1 block w-32`} /></label>
            <button onClick={() => void makeClip()} disabled={loading} className="self-end rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-black disabled:opacity-40">{loading ? "作成中…" : "指定範囲を切り抜く"}</button>
          </div>
          {clipUrl && <div className="mt-5 space-y-3"><video controls className="aspect-video w-full rounded-xl bg-black" src={clipUrl} /><a href={clipUrl} download={`bluesky-${work.contentId}.mp4`} className="inline-block rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-200">切り抜きMP4を保存</a></div>}
        </> : <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">利用できる公式サンプル動画が登録されていません。</p>}
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">素材準備専用です。投稿・外部送信・アフィリエイトIDの使用は行いません。素材の掲載可否は投稿前に個別確認してください。</p>
      </article>
    </section>}
    {message && <p role="status" className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-sky-100">{message}</p>}
  </>;
}

