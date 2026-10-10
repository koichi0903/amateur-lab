"use client";

import { useState } from "react";

export default function ManualXImpressionInput({
  postKey,
  account,
  initialValue,
  compact = false,
}: {
  postKey: string;
  account: "hakkutsu_lab" | "bijyo1010";
  initialValue?: number | null;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initialValue == null ? "" : String(initialValue));
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!/^\d+$/.test(value)) {
      setMessage("Xに表示された閲覧数を整数で入力してください。");
      return;
    }
    const impressions = Number(value);
    if (!Number.isSafeInteger(impressions) || impressions < 0 || impressions > 1_000_000_000) {
      setMessage("0以上の閲覧数を入力してください。");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/x-growth/manual-impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postKey, account, impressions }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "保存できませんでした。");
      setMessage("記録しました。");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
      setPending(false);
    }
  };

  return (
    <div className={compact ? "mt-2" : "mt-3 rounded-lg border border-emerald-900 bg-zinc-950 p-3"}>
      {!compact && <p className="text-xs leading-5 text-zinc-400">投稿から24時間以上たったら、X画面に表示された閲覧数を入力してください。投稿後30日以内なら記録できます。遅れて入力した場合は、その入力時点の数値として保存します。</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`x-impressions-${postKey}`}>X閲覧数</label>
        <input
          id={`x-impressions-${postKey}`}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="閲覧数"
          className="h-10 w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-emerald-400"
        />
        <button
          type="button"
          disabled={pending || value === ""}
          onClick={() => void save()}
          className="h-10 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "保存中…" : initialValue == null ? "閲覧数を記録" : "記録を更新"}
        </button>
        {message && <span role="status" className="text-[11px] font-bold text-emerald-200">{message}</span>}
      </div>
    </div>
  );
}
