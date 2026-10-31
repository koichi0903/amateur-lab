"use client";

import { useState, useTransition } from "react";
import { postJson } from "./xGrowthActionRequest";

const MANUAL_TAGS = [
  ["first_seconds_strong", "冒頭が強い"],
  ["visual_mismatch", "ジャケとの差"],
  ["actress_fit", "女優×作品相性"],
  ["scene_surprise", "展開の意外性"],
  ["safe_preview", "安全な試聴"],
  ["too_explicit_for_reach", "REACH不向き"],
  ["weak_visual", "映像が弱い"],
] as const;


export function RightsReviewActions({ assetId }: { assetId: number }) {
  const [basisType, setBasisType] = useState("insufficient_evidence");
  const [basisUrl, setBasisUrl] = useState("");
  const [note, setNote] = useState("");
  const [quality, setQuality] = useState("unreviewed");
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = (status: "review" | "allowed" | "blocked") => startTransition(async () => {
    try {
      if (status === "allowed" && !confirm("権利根拠を確認済みの素材だけallowedにします。続行しますか？")) return;
      await postJson("/api/admin/x-growth/media/review", {
        id: assetId,
        status,
        rightsBasisType: basisType,
        rightsBasisUrl: basisUrl,
        rightsBasisNote: note,
        mediaQuality: quality,
        manualTags,
        reviewSource: status === "allowed" && note.includes("User confirmed") ? "user_confirmed" : "admin",
      });
      setMessage("保存しました。再読み込みで反映されます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  });
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={basisType} onChange={(event) => setBasisType(event.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100">
          {["insufficient_evidence", "explicit_permission", "official_policy", "creator_permission", "license", "prohibited"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={quality} onChange={(event) => setQuality(event.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100">
          {["unreviewed", "strong", "normal", "weak"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <input suppressHydrationWarning value={basisUrl} onChange={(event) => setBasisUrl(event.target.value)} placeholder="根拠URL" className="h-9 rounded-lg border border-zinc-700 bg-black px-2 text-xs text-zinc-100" />
      <textarea suppressHydrationWarning value={note} onChange={(event) => setNote(event.target.value)} placeholder="根拠メモ / blocked理由" className="h-20 resize-none rounded-lg border border-zinc-700 bg-black p-2 text-xs text-zinc-100" />
      <div className="grid gap-2 rounded-lg border border-zinc-800 bg-black/40 p-2 sm:grid-cols-2">
        {MANUAL_TAGS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
            <input
              suppressHydrationWarning
              type="checkbox"
              checked={manualTags.includes(value)}
              onChange={(event) => setManualTags((current) => event.target.checked ? [...current, value] : current.filter((tag) => tag !== value))}
              className="h-4 w-4 accent-emerald-400"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => submit("review")} className="h-9 rounded-lg border border-amber-700 px-3 text-xs font-black text-amber-100 disabled:opacity-50">reviewにする</button>
        <button disabled={pending} onClick={() => submit("allowed")} className="h-9 rounded-lg bg-emerald-500 px-3 text-xs font-black text-black disabled:opacity-50">allowedにする</button>
        <button disabled={pending} onClick={() => submit("blocked")} className="h-9 rounded-lg border border-rose-700 px-3 text-xs font-black text-rose-100 disabled:opacity-50">blockedにする</button>
      </div>
      {message && <p className="text-[11px] font-bold text-amber-200">{message}</p>}
    </div>
  );
}
