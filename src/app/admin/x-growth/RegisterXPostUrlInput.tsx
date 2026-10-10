"use client";

import { useState } from "react";

export default function RegisterXPostUrlInput({
  postKey,
  account,
}: {
  postKey: string;
  account: "hakkutsu_lab" | "bijyo1010";
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/x-growth/register-post-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postKey, account, xPostUrl: url }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "投稿URLを登録できませんでした。");
      setMessage("投稿URLを登録しました。表示を更新します。");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投稿URLを登録できませんでした。");
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/15 p-3">
      <label className="block text-[11px] font-bold leading-5 text-amber-100" htmlFor={`x-post-url-${account}-${postKey}`}>
        この投稿のX URLを登録
      </label>
      <p className="mt-1 text-[10px] leading-4 text-zinc-500">投稿を開いたときの x.com/.../status/... URLを貼り付けます。</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id={`x-post-url-${account}-${postKey}`}
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://x.com/アカウント/status/..."
          className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-amber-400"
        />
        <button type="button" disabled={pending || !url.trim()} onClick={() => void save()} className="h-10 rounded-lg bg-amber-400 px-3 text-xs font-black text-black disabled:opacity-40">
          {pending ? "登録中…" : "投稿URLを登録"}
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-[11px] font-bold text-amber-100">{message}</p>}
    </div>
  );
}
