"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Send } from "lucide-react";
import type { XPostCandidate } from "@/lib/xPostCandidates";

const CATEGORY_STYLES: Record<XPostCandidate["category"], string> = {
  sales: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
  deal: "border-rose-800 bg-rose-950/30 text-rose-300",
  score: "border-violet-800 bg-violet-950/30 text-violet-300",
  new: "border-cyan-800 bg-cyan-950/30 text-cyan-300",
};

export default function XPostCandidatePanel({
  candidates,
  error,
}: {
  candidates: XPostCandidate[];
  error: string | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyPost(candidate: XPostCandidate) {
    await navigator.clipboard.writeText(candidate.postText);
    setCopiedKey(candidate.key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Send className="mt-0.5 shrink-0 text-sky-400" size={21} />
        <div>
          <h2 className="font-black">X投稿候補</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            売上・割引・発掘スコア・新作から候補を自動選定。投稿前に内容を確認してください。
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-xs leading-5 text-amber-200">
          一部候補を取得できませんでした: {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {candidates.map((candidate) => (
          <article key={candidate.key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${CATEGORY_STYLES[candidate.category]}`}>
                {candidate.label}
              </span>
              <span className="text-xs font-bold text-zinc-500">{candidate.reason}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-bold text-zinc-200">{candidate.title}</p>
            <textarea
              readOnly
              value={candidate.postText}
              aria-label={`${candidate.title}のX投稿文`}
              className="mt-3 h-44 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-6 text-zinc-200 outline-none focus:border-sky-600"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className={`text-xs font-bold ${candidate.postText.length > 280 ? "text-red-400" : "text-zinc-500"}`}>
                {candidate.postText.length}/280文字
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyPost(candidate)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 px-4 text-xs font-black transition hover:border-sky-500 hover:text-sky-300"
                >
                  {copiedKey === candidate.key ? <Check size={15} /> : <Copy size={15} />}
                  {copiedKey === candidate.key ? "コピー済み" : "本文をコピー"}
                </button>
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(candidate.postText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-black transition hover:bg-sky-100"
                >
                  Xで確認 <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!candidates.length && !error && (
        <p className="mt-5 text-sm text-zinc-500">投稿候補を作れる作品がまだありません。</p>
      )}
      <p className="mt-4 text-xs leading-5 text-zinc-600">
        自動投稿は行いません。成人向けコンテンツに関するXの設定・表示ルールを確認し、画像や文面を投稿前に必ず確認してください。
      </p>
      <span className="sr-only" aria-live="polite">{copiedKey ? "投稿文をコピーしました" : ""}</span>
    </section>
  );
}
