"use client";

import { Check, Copy, ExternalLink, LoaderCircle, Save, XCircle } from "lucide-react";
import type { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import {
  affiliateStatusLabel,
  linkStrategyLabel,
  monetizableStatusLabel,
  postModeLabel,
  postingSteps,
  publishBody,
  quoteIntentUrl,
  sourceMediaTypeLabel,
} from "./MyfansExecutionBoardRules";

type CandidateOptionSlot = ReturnType<typeof buildMyfansExecutionBoard>["candidateOptions"][number];
type CandidateOption = CandidateOptionSlot["candidates"][number];

type CopyHandler = (value: string, label: string) => void;

function CandidateOptionSourceDetails({ candidate }: { candidate: CandidateOption }) {
  return (
    <div className="mt-3 grid gap-1 text-xs leading-5 text-zinc-300">
      <p><span className="font-black text-zinc-500">post_mode:</span> {postModeLabel(candidate)} / {linkStrategyLabel(candidate)}</p>
      <p><span className="font-black text-zinc-500">候補タイプ:</span> {candidate.candidateType}</p>
      <p><span className="font-black text-zinc-500">引用元X投稿者:</span> {candidate.sourceAuthorLabel}</p>
      <p><span className="font-black text-zinc-500">引用元X:</span> {candidate.quoteXUrl || candidate.sourceXUrl || "-"}</p>
      <p><span className="font-black text-zinc-500">引用画像/動画:</span> {candidate.mediaPermalink || "なし（status URLを使用）"}</p>
      <p><span className="font-black text-zinc-500">引用メディア:</span> {sourceMediaTypeLabel(candidate)} / quote tweetは元Xを引用、再アップロードなし</p>
      <p><span className="font-black text-zinc-500">myfansクリエイター:</span> {candidate.myfansCreator?.name || "myfans未紐付け"}</p>
      <p><span className="font-black text-zinc-500">myfans作品:</span> {candidate.myfansCreator ? candidate.product?.title ?? "なし" : "なし"}</p>
    </div>
  );
}

function CandidateOptionMatchDetails({ candidate }: { candidate: CandidateOption }) {
  return (
    <div className="grid gap-1 text-xs leading-5 text-zinc-300">
      <p><span className="font-black text-zinc-500">monetizable status:</span> {monetizableStatusLabel(candidate)}</p>
      <p><span className="font-black text-zinc-500">Resolver:</span> {candidate.resolverEvidence ? `${candidate.resolverEvidence.confidence} / ${candidate.resolverEvidence.resolution_method} / ${candidate.resolverEvidence.evidence_source}` : "未解決"}</p>
      {candidate.resolverEvidence?.confidence === "strong" && <p className="font-bold text-amber-200">strong: myfansリンクは見つかっていますが、人間確認が必要です。</p>}
      <p><span className="font-black text-zinc-500">解決product:</span> {candidate.resolverEvidence?.product_id ? `product_id ${candidate.resolverEvidence.product_id}` : candidate.product?.id ? `product_id ${candidate.product.id}` : "-"}</p>
      <p><span className="font-black text-zinc-500">myfans送客先:</span> {candidate.affiliateTargetUrl || "-"}</p>
      <p><span className="font-black text-zinc-500">アフィリエイト:</span> {affiliateStatusLabel(candidate)} {candidate.affiliateUrl ? `/ ${candidate.affiliateUrl}` : ""}</p>
    </div>
  );
}

function CandidateOptionTopicDetails({ candidate }: { candidate: CandidateOption }) {
  return (
    <div className="grid gap-1 text-xs leading-5 text-zinc-300">
      <p><span className="font-black text-zinc-500">topic:</span> {candidate.topicIdentity || "-"}</p>
      <p><span className="font-black text-zinc-500">reason:</span> {candidate.topicValue?.reasonToCare ?? candidate.reason}</p>
      <p><span className="font-black text-zinc-500">visual根拠:</span> {candidate.visualUnderstanding?.visualAnalysisStatus ?? "unavailable"} / {candidate.visualUnderstanding?.humanObservation || candidate.visualUnderstanding?.rawVisualEvidence || "visual断定なし"}</p>
      <p><span className="font-black text-zinc-500">Quality:</span> {candidate.quality.total}/100 / {candidate.quality.verdict}</p>
      <p><span className="font-black text-zinc-500">Topic Value:</span> {candidate.topicValue?.score ?? "-"} / {candidate.topicValue?.verdict ?? "-"}</p>
    </div>
  );
}

function CandidateOptionReactionDetails({ candidate }: { candidate: CandidateOption }) {
  return (
    <div className="grid gap-1 text-xs leading-5 text-zinc-300">
      <p><span className="font-black text-zinc-500">Natural reaction:</span> {candidate.reactionReview?.naturalUserReaction ?? "-"}/100 / analyst risk {candidate.reactionReview?.analystCommentaryRisk ?? "-"}/100 / source specificity {candidate.reactionReview?.sourceSpecificity ?? candidate.sourceSpecificityScore}/100</p>
      <p><span className="font-black text-zinc-500">新規性:</span> {candidate.novelty.label} / 同じsource: {candidate.novelty.sameSourceLabel}</p>
      <p><span className="font-black text-zinc-500">最後に同じcreatorを使った日:</span> {candidate.novelty.lastSameCreatorDate ?? "未使用"}</p>
      <p><span className="font-black text-zinc-500">最後に同じsourceを使った日:</span> {candidate.novelty.lastSameSourceDate ?? "未使用"}</p>
      <p><span className="font-black text-zinc-500">過去投稿との近さ:</span> {candidate.novelty.pastBodySimilarityLabel} <span className="text-zinc-500">({candidate.novelty.maxPastSimilarity})</span></p>
    </div>
  );
}

function CandidateOptionEvidence({ candidate }: { candidate: CandidateOption }) {
  return (
    <>
      <CandidateOptionSourceDetails candidate={candidate} />
      <CandidateOptionMatchDetails candidate={candidate} />
      <CandidateOptionTopicDetails candidate={candidate} />
      <CandidateOptionReactionDetails candidate={candidate} />
    </>
  );
}

function CandidateOptionPostSet({ candidate, onCopy }: { candidate: CandidateOption; onCopy: CopyHandler }) {
  const sourceUrl = candidate.quoteXUrl || candidate.sourceXUrl;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-xs font-black text-zinc-500">完成投稿セット</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white"><ExternalLink size={14} />引用元Xを開く</a>}
        {sourceUrl && <a href={quoteIntentUrl(candidate)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white"><ExternalLink size={14} />引用投稿を開く</a>}
        {sourceUrl && <button type="button" onClick={() => onCopy(sourceUrl, "引用URL")} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white"><Copy size={14} />引用URLをコピー</button>}
        {candidate.affiliateTargetUrl && <a href={candidate.affiliateTargetUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white"><ExternalLink size={14} />myfansページ</a>}
        {candidate.monetizableStatus === "linked_no_affiliate" && candidate.product && <a href={candidate.product.product_url || "https://www.affiliate.myfans.jp/dashboard"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-black text-black"><ExternalLink size={14} />アフィリンクを作る</a>}
        {candidate.affiliateUrl && <button type="button" onClick={() => onCopy(candidate.affiliateUrl, "アフィリエイトリンク")} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white"><Copy size={14} />アフィリエイトリンク</button>}
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-zinc-300">
        {postingSteps(candidate).map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}

function CandidateOptionActions({
  candidate, slot, selected, pendingId, saved, saveBlockReason, onSelect, onSkip, onSave,
}: {
  candidate: CandidateOption;
  slot: CandidateOptionSlot;
  selected: boolean;
  pendingId: string | number | null;
  saved: boolean;
  saveBlockReason: string | null;
  onSelect: (slot: CandidateOptionSlot, candidate: CandidateOption) => void;
  onSkip: (candidate: CandidateOption) => void;
  onSave: (candidate: ExecutionCandidate) => void;
}) {
  const selectId = `select-${slot.postOrder}-${candidate.optionLabel}`;
  const skipId = `skip-${candidate.id}`;
  return (
    <div className="mt-4 grid gap-2">
      <button type="button" onClick={() => onSelect(slot, candidate)} disabled={pendingId === selectId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">
        {pendingId === selectId ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
        {selected ? "選択済み" : "この候補を選ぶ"}
      </button>
      <button type="button" onClick={() => onSkip(candidate)} disabled={pendingId === skipId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-800 bg-rose-950/40 px-3 text-xs font-black text-rose-200 disabled:cursor-wait disabled:opacity-60">
        {pendingId === skipId ? <LoaderCircle size={15} className="animate-spin" /> : <XCircle size={15} />}
        この候補を除外
      </button>
      <button type="button" disabled={saved || pendingId === candidate.id || Boolean(saveBlockReason)} onClick={() => onSave(candidate)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
        {saved ? <Check size={15} /> : <Save size={15} />} {saved ? "投稿ログに保存済み" : "この候補を投稿ログへ保存"}
      </button>
      {saveBlockReason && <p className="text-xs font-bold text-amber-200">保存不可: {saveBlockReason}</p>}
    </div>
  );
}

export function MyfansCandidateOption({
  candidate, slot, selected, pendingId, saved, saveBlockReason, onCopy, onSelect, onSkip, onSave,
}: {
  candidate: CandidateOption;
  slot: CandidateOptionSlot;
  selected: boolean;
  pendingId: string | number | null;
  saved: boolean;
  saveBlockReason: string | null;
  onCopy: CopyHandler;
  onSelect: (slot: CandidateOptionSlot, candidate: CandidateOption) => void;
  onSkip: (candidate: CandidateOption) => void;
  onSave: (candidate: ExecutionCandidate) => void;
}) {
  return (
    <div className={`rounded-lg border p-4 ${selected ? "border-emerald-500 bg-emerald-950/25" : "border-zinc-800 bg-zinc-950"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">候補{candidate.optionLabel}（{candidate.optionName}）</p>
          <p className="mt-1 text-xs font-bold text-zinc-500">{candidate.candidateType} / {candidate.dailyRole} / {candidate.postType}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-[11px] font-black ${selected ? "bg-emerald-400 text-black" : "bg-zinc-800 text-zinc-300"}`}>
          {selected ? "選択済み" : "未選択"}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <p className="text-xs font-black text-zinc-500">公開本文全文</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100">{publishBody(candidate)}</p>
      </div>
      <CandidateOptionEvidence candidate={candidate} />
      <div className="mt-4 grid gap-2">
        <CandidateOptionPostSet candidate={candidate} onCopy={onCopy} />
        <CandidateOptionActions
          candidate={candidate}
          slot={slot}
          selected={selected}
          pendingId={pendingId}
          saved={saved}
          saveBlockReason={saveBlockReason}
          onSelect={onSelect}
          onSkip={onSkip}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
