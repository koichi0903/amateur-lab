"use client";

import { useEffect, useState } from "react";

type WorkMedia = {
  contentId: string;
  title: string | null;
  releaseDate: string | null;
  isListed: boolean;
  officialWorkImageUrl: string | null;
  sampleImageUrls: string[];
  sampleMovieUrl: string | null;
  sampleMovieReady: boolean;
};

const control = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";

export function BlueskySampleConsole({ initialContentId = "" }: { initialContentId?: string }) {
  const [contentId, setContentId] = useState(initialContentId);
  const [work, setWork] = useState<WorkMedia | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [startSeconds, setStartSeconds] = useState("0");
  const [endSeconds, setEndSeconds] = useState("15");
  const [clipUrl, setClipUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl); }, [clipUrl]);

  async function loadWork() {
    setLoading(true);
    setMessage("");
    setClipUrl("");
    setWork(null);
    setNeedsRegistration(false);
    try {
      const response = await fetch(`/api/admin/bluesky-post?contentId=${encodeURIComponent(contentId)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as WorkMedia & { error?: string };
      if (!response.ok) {
        if (response.status === 404) setNeedsRegistration(true);
        throw new Error(body.error ?? "作品素材を取得できませんでした。");
      }
      setWork(body);
      setSelectedImage(0);
      setMessage("作品素材を読み込みました。投稿候補や履歴の状態は変更していません。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function registerWork() {
    setLoading(true);
    setMessage("");
    setClipUrl("");
    try {
      const response = await fetch("/api/admin/bluesky-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ contentId }),
      });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "公式作品を登録できませんでした。");
      const workResponse = await fetch(`/api/admin/bluesky-post?contentId=${encodeURIComponent(contentId)}`, { credentials: "same-origin", cache: "no-store" });
      const workBody = await workResponse.json() as WorkMedia & { error?: string };
      if (!workResponse.ok) throw new Error(workBody.error ?? "登録後の素材を読み込めませんでした。");
      setWork(workBody);
      setNeedsRegistration(false);
      setSelectedImage(0);
      setMessage(body.message ?? "公式作品情報を素材画面に登録しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function makeClip() {
    if (!work) return;
    setLoading(true);
    setMessage("");
    setClipUrl("");
    try {
      const params = new URLSearchParams({ contentId: work.contentId, startSeconds, endSeconds });
      const response = await fetch(`/api/admin/bluesky-post/video?${params}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "切り抜き動画を作成できませんでした。");
      }
      setClipUrl(URL.createObjectURL(await response.blob()));
      setMessage("指定範囲のMP4を作成しました。投稿は行っていません。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  const activeImage = work?.sampleImageUrls[selectedImage] ?? null;
  return <>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <label className="block max-w-xl text-sm font-bold">FANZA品番
        <div className="mt-2 flex gap-2">
          <input value={contentId} onChange={(event) => setContentId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadWork(); }} placeholder="例: scute1583" className={`${control} min-w-0 flex-1`} />
          <button onClick={() => void loadWork()} disabled={loading || !contentId.trim()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40">{loading ? "取得中…" : "素材を表示"}</button>
        </div>
      </label>
      <p className="mt-2 text-xs leading-5 text-zinc-400">登録済みの公式サンプル素材を読み込みます。未登録品番は公式「素人」APIで照合して本画面用に登録できます。作品カタログ、投稿、投稿履歴は変更しません。</p>
    </section>

    {needsRegistration && <section className="mt-5 rounded-2xl border border-sky-900 bg-zinc-900 p-5"><p className="text-sm text-zinc-300">この品番は素材画面の登録一覧にありません。公式「素人」APIで品番を照合し、この画面専用の素材一覧へ登録できます。</p><button type="button" onClick={() => void registerWork()} disabled={loading} className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40">公式品番検索して登録</button></section>}

    {work && <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-xl font-black">公式サンプル画像</h3>
        <p className="mt-1 text-sm text-zinc-400">{work.title ?? work.contentId} / 発売日 {work.releaseDate ?? "未取得"}</p>
        {activeImage ? <>
          <a href={activeImage} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl bg-black text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeImage} alt={`${work.title ?? work.contentId} 公式サンプル ${selectedImage + 1}`} className="mx-auto max-h-[560px] w-auto max-w-full object-contain" />
          </a>
          <div className="mt-3 flex flex-wrap gap-2">{work.sampleImageUrls.map((url, index) => <button key={url} onClick={() => setSelectedImage(index)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${selectedImage === index ? "border-sky-400 bg-sky-950 text-sky-100" : "border-zinc-700 text-zinc-300"}`}>画像 {index + 1}</button>)}</div>
          <p className="mt-2 text-xs text-zinc-500">画像を選んで全体を目視確認してください。</p>
        </> : <>
          <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">この作品データには公式サンプル画像がありません。</p>
          {work.officialWorkImageUrl && <div className="mt-4">
            <h4 className="text-sm font-bold text-zinc-200">参考：FANZA公式の作品画像</h4>
            <a href={work.officialWorkImageUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl bg-black text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={work.officialWorkImageUrl} alt={`${work.title ?? work.contentId} FANZA公式作品画像`} className="mx-auto max-h-[560px] w-auto max-w-full object-contain" />
            </a>
            <p className="mt-2 text-xs text-amber-200">これはサンプル画像ではなく作品画像です。投稿素材として使えるかは別に確認してください。</p>
          </div>}
        </>}
        {!work.isListed && <p className="mt-3 text-xs text-amber-200">この作品は現在サイト掲載対象外です。</p>}
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-xl font-black">公式サンプル動画の切り抜き</h3>
        {work.sampleMovieReady && work.sampleMovieUrl ? <>
          <video controls preload="metadata" className="mt-4 aspect-video w-full rounded-xl bg-black" src={work.sampleMovieUrl}><track kind="captions" /></video>
          <p className="mt-2 text-xs text-zinc-400">全体を再生して確認したうえで、切り抜く範囲を秒で指定してください。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="text-xs text-zinc-400">開始秒<input type="number" min="0" max="600" step="0.1" value={startSeconds} onChange={(event) => setStartSeconds(event.target.value)} className={`${control} mt-1 block w-32`} /></label>
            <label className="text-xs text-zinc-400">終了秒<input type="number" min="0.1" max="600" step="0.1" value={endSeconds} onChange={(event) => setEndSeconds(event.target.value)} className={`${control} mt-1 block w-32`} /></label>
            <button onClick={() => void makeClip()} disabled={loading} className="self-end rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-black disabled:opacity-40">{loading ? "作成中…" : "指定範囲を切り抜く"}</button>
          </div>
          {clipUrl && <div className="mt-5 space-y-3"><video controls className="aspect-video w-full rounded-xl bg-black" src={clipUrl} /><a href={clipUrl} download={`bluesky-${work.contentId}.mp4`} className="inline-block rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-200">切り抜きMP4を保存</a></div>}
        </> : <div className="mt-4 rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-400"><p>利用できる公式サンプル動画が登録されていません。</p><button type="button" onClick={() => void registerWork()} disabled={loading} className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40">品番から公式検索して素材登録</button></div>}
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">素材準備専用です。安全性と素材利用条件は個別に確認してください。投稿や外部送信は行いません。</p>
      </article>
    </section>}
    {message && <p role="status" className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-sky-100">{message}</p>}
  </>;
}
