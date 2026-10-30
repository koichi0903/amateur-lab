"use client";

import { Check, Copy, Download, ExternalLink, Image as ImageIcon, LoaderCircle, Save } from "lucide-react";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import {
  affiliateStatusLabel,
  canUseAffiliateLink,
  linkStrategyLabel,
  monetizableStatusLabel,
  needsFreshAffiliateLink,
  postModeLabel,
  postingSteps,
  publishBody,
  quoteIntentUrl,
  sourceMediaTypeLabel,
} from "./MyfansExecutionBoardRules";
import { MYFANS_CLICK_ATTRIBUTION_WINDOW_HOURS, myfansAffiliateLinkStatus, myfansAffiliateLinkStatusLabel } from "@/lib/myfansAffiliateLink";
import { candidateSaveBlockReason } from "@/lib/myfansCandidateSave";
import { getXWeightedLength } from "@/lib/xText";
import type { Message } from "./MyfansFormPrimitives";
import { inputClass } from "./MyfansFormPrimitives";
import { CreativeCardPreview, downloadCardPng } from "./MyfansCreativeCard";

type CopyHandler = (value: string, label: string) => void;

const strategyLabels: Record<string, string> = {
  quote_post: "creator X投稿の引用",
  myfans_ogp: "myfans正規OGP",
  comparison_card: "自作比較カード",
  ranking_card: "自作ランキングカード",
  discovery_card: "自作発見カード",
  revenue_data_card: "自作収益カード",
  text_only: "text only",
  permitted_media: "許諾済み画像/動画",
};

function CandidateQualityScore({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <>
      <div className={`mt-3 rounded-lg border p-3 ${candidate.quality.verdict === "PASS" ? "border-emerald-700 bg-emerald-950/30" : "border-amber-700 bg-amber-950/30"}`}>
        <p className="text-sm font-black">{candidate.quality.verdict} {candidate.quality.total}/100</p>
        <p className="mt-1 text-xs leading-5 text-zinc-300">{candidate.quality.reasons.join(" / ")}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          stop {candidate.quality.breakdown.stopPower ?? candidate.quality.breakdown.firstLineStop ?? "-"} / visual {candidate.quality.breakdown.visualLeverage ?? candidate.quality.breakdown.visual ?? "-"} / specificity {candidate.quality.breakdown.specificity ?? "-"} / proof {candidate.quality.breakdown.proof ?? "-"} / curiosity {candidate.quality.breakdown.broadCuriosity ?? candidate.quality.breakdown.audience ?? "-"} / follow {candidate.quality.breakdown.followReason ?? "-"} / role {candidate.quality.breakdown.roleDifferentiation ?? "-"} / smell {candidate.quality.breakdown.spamSalesSmell ?? "-"}
        </p>
      </div>
    </>
  );
}

function CandidateTopicValueReview({ candidate }: { candidate: ExecutionCandidate }) {
  if (!candidate.topicValue) return null;
  return (
    <div className={`rounded-lg border p-3 ${candidate.topicValue.verdict === "PASS" ? "border-sky-700 bg-sky-950/30" : "border-amber-700 bg-amber-950/30"}`}>
      <p className="font-black text-white">Topic Value {candidate.topicValue.score}/100 / {candidate.topicValue.verdict} / threshold {candidate.topicThreshold}</p>
      <p className="mt-1"><span className="font-black text-zinc-500">reason_to_care:</span> {candidate.topicValue.reasonToCare ?? "-"}</p>
      <p className="mt-1"><span className="font-black text-zinc-500">evidence:</span> {candidate.topicValue.evidence.join(" / ") || "-"}</p>
      <p className="mt-1 text-zinc-400"><span className="font-black text-zinc-500">baseline:</span> {candidate.topicValue.baseline.join(" / ") || "-"}</p>
      {candidate.topicValue.whyRejected.length > 0 && <p className="mt-1 text-amber-200"><span className="font-black">why rejected:</span> {candidate.topicValue.whyRejected.join(" / ")}</p>}
    </div>
  );
}

function CandidateIdentityReview({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <>
      <p><span className="font-black text-zinc-500">今日の目的:</span> {candidate.objective}</p>
      <p><span className="font-black text-zinc-500">候補タイプ:</span> {candidate.candidateType}</p>
      <p><span className="font-black text-zinc-500">monetizable status:</span> {monetizableStatusLabel(candidate)}</p>
      <p><span className="font-black text-zinc-500">role:</span> {candidate.dailyRole}</p>
      <p><span className="font-black text-zinc-500">投稿型:</span> {candidate.postType}</p>
      <p><span className="font-black text-zinc-500">link_strategy:</span> {candidate.linkStrategy}</p>
      <p><span className="font-black text-zinc-500">creative_strategy:</span> {strategyLabels[candidate.creativeStrategy] ?? candidate.creativeStrategy}</p>
      <p><span className="font-black text-zinc-500">引用元X投稿者:</span> {candidate.sourceAuthorLabel}</p>
      <p><span className="font-black text-zinc-500">myfansクリエイター:</span> {candidate.myfansCreator?.name || "myfans未紐付け"}</p>
      <p><span className="font-black text-zinc-500">product creator:</span> {candidate.productCreator?.name || "-"}</p>
      <p><span className="font-black text-zinc-500">matching:</span> {candidate.sourceProductMatch.confidence} / {candidate.sourceProductMatch.source}</p>
      <p><span className="font-black text-zinc-500">Resolver:</span> {candidate.resolverEvidence ? `${candidate.resolverEvidence.confidence} / ${candidate.resolverEvidence.resolution_method} / ${candidate.resolverEvidence.evidence_source}` : "未解決"}</p>
      {candidate.resolverEvidence?.confidence === "strong" && <p className="font-bold text-amber-200">strong: myfansリンクは見つかっていますが、人間確認が必要です。</p>}
      <p><span className="font-black text-zinc-500">解決product:</span> {candidate.resolverEvidence?.product_id ? `product_id ${candidate.resolverEvidence.product_id}` : candidate.product?.id ? `product_id ${candidate.product.id}` : "-"}</p>
      <p><span className="font-black text-zinc-500">source specificity:</span> {candidate.sourceSpecificityScore}/100</p>
    </>
  );
}

function CandidateVisualReview({ candidate }: { candidate: ExecutionCandidate }) {
  if (!candidate.visualUnderstanding) return null;
  return (
    <>
      <p><span className="font-black text-zinc-500">Visual analysis status:</span> {candidate.visualUnderstanding.visualAnalysisStatus} / {candidate.visualUnderstanding.analyzerVersion}</p>
      <p><span className="font-black text-zinc-500">raw visual evidence:</span> {candidate.visualUnderstanding.rawVisualEvidence || candidate.visualUnderstanding.concreteVisualCue || "-"} / confidence {candidate.visualUnderstanding.cueConfidence ?? "-"}</p>
      <p><span className="font-black text-zinc-500">human observation:</span> {candidate.visualUnderstanding.humanObservation || "-"}</p>
      <p><span className="font-black text-zinc-500">evidence source:</span> {candidate.visualUnderstanding.evidenceSource || candidate.visualUnderstanding.sourceEvidence || "-"}</p>
      <p><span className="font-black text-zinc-500">visual detail:</span> {candidate.visualUnderstanding.visualMoment} / {candidate.visualUnderstanding.compositionOrStyle || "-"} / {candidate.visualUnderstanding.cameraDistanceOrFraming || "-"}</p>
      <p><span className="font-black text-zinc-500">Naturalness / visual specificity / why pass:</span> {candidate.quality.breakdown.followReason ?? "-"} / {candidate.quality.breakdown.specificity ?? "-"} / {candidate.quality.reasons.join(" / ")}</p>
      <p><span className="font-black text-zinc-500">reaction type:</span> {candidate.reactionType ?? "-"}</p>
      <p><span className="font-black text-zinc-500">why this angle:</span> {candidate.whyThisAngle}</p>
    </>
  );
}

function CandidateNarrativeReview({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <>
      <p><span className="font-black text-zinc-500">hook:</span> {candidate.hookType} / {candidate.hookLabel}</p>
      <p><span className="font-black text-zinc-500">audience intent:</span> {candidate.audienceIntent}</p>
      <p><span className="font-black text-zinc-500">想定読者:</span> {candidate.reader}</p>
      <p><span className="font-black text-zinc-500">読者価値:</span> {candidate.readerValue}</p>
      <p><span className="font-black text-zinc-500">冒頭で止まる理由:</span> {candidate.stopReason}</p>
      <p><span className="font-black text-zinc-500">CTAの役割:</span> {candidate.ctaRole}</p>
      <p><span className="font-black text-zinc-500">なぜ:</span> {candidate.creativeReason}</p>
    </>
  );
}

function CandidateQualityReview({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 p-4">
      <p className="text-xs font-black text-zinc-500">内部判断</p>
      <CandidateQualityScore candidate={candidate} />
      <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-300">
        <CandidateTopicValueReview candidate={candidate} />
        <CandidateIdentityReview candidate={candidate} />
        <CandidateVisualReview candidate={candidate} />
        <CandidateNarrativeReview candidate={candidate} />
      </div>
    </div>
  );
}

function CandidateStrategyDetails({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <>
      {candidate.attention && (
        <div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
          <p className="font-black text-violet-300">Attention {candidate.attention.score}/100</p>
          <p>visual {candidate.attention.visualStrength} / verified {candidate.attention.visualVerified ? "yes" : "no"} / freshness {candidate.attention.freshness} / engagement {candidate.attention.engagementStrength} / data story {candidate.attention.dataStoryScore}</p>
          <p className="mt-1 text-zinc-500">{candidate.attention.reasons.join(" / ")}</p>
        </div>
      )}
      {candidate.opportunity && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">Growth</p><p className="mt-1 text-lg font-black">{candidate.opportunity.growthScore}</p></div>
          <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">Revenue</p><p className="mt-1 text-lg font-black">{candidate.opportunity.revenueScore}</p></div>
          <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[11px] font-black text-zinc-500">LTV</p><p className="mt-1 text-lg font-black">{candidate.opportunity.creatorLtvScore}</p></div>
        </div>
      )}
      {candidate.opportunity && (
        <p className="mt-3 text-xs font-bold text-emerald-300">
          {candidate.opportunity.labels.join(" / ")} / 1000表示あたり推定 ¥{candidate.opportunity.expectedRewardPer1000Impressions.toLocaleString("ja-JP")}
        </p>
      )}
      {candidate.mediaPlan && (
        <div className="mt-4 rounded-lg border border-cyan-800 bg-cyan-950/30 p-4">
          <p className="text-xs font-black text-cyan-300">見せ方: {candidate.mediaPlan.label}</p>
          <p className="mt-1 text-sm font-black text-white">{candidate.mediaPlan.asset}</p>
          <p className="mt-2 text-xs leading-5 text-cyan-50/80">{candidate.mediaPlan.instruction}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">{candidate.mediaPlan.reason}</p>
        </div>
      )}
      {["ranking_card", "comparison_card", "discovery_card", "revenue_data_card"].includes(candidate.creativeStrategy) && <CreativeCardPreview candidate={candidate} />}
    </>
  );
}

function CandidatePostContent({ candidate, body, selfReply, linkRequired, linkReady }: {
  candidate: ExecutionCandidate;
  body: string;
  selfReply: string;
  linkRequired: boolean;
  linkReady: boolean;
}) {
  return (
    <>
      <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/20 p-4">
        <p className="text-xs font-black text-emerald-300">Xに投稿する本文</p>
        <p className="mt-1 text-[11px] font-black text-zinc-500">{candidate.generatorVersion} / {candidate.copyInputHash}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{body || "本文を生成できるeligible sourceがありません。"}</p>
        {body && <p className="mt-2 text-xs font-black text-zinc-500">文字数 {getXWeightedLength(body)}</p>}
      </div>
      <div className="mt-3 rounded-lg bg-zinc-950 p-4">
        <p className="text-xs font-black text-zinc-500">Xに投稿する自己リプ</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{selfReply || "-"}</p>
        {linkRequired && !linkReady && <p className="mt-2 text-xs font-bold leading-5 text-amber-200">リンク未作成/期限切れなので、この自己リプは完成扱いにしません。</p>}
      </div>
    </>
  );
}

function CandidateAffiliateEditor({ candidate, pendingId, onSave }: {
  candidate: ExecutionCandidate;
  pendingId: string | number | null;
  onSave: (candidate: ExecutionCandidate, form: HTMLFormElement) => void;
}) {
  if (!candidate.product) return null;
  const linkStatus = myfansAffiliateLinkStatus(candidate.product);
  const affiliatePendingId = `affiliate-${candidate.product.id}`;
  return (
    <div className="mt-3 rounded-lg border border-amber-700 bg-amber-950/25 p-4">
      <p className="text-xs font-black text-amber-200">アフィリンク状態: {myfansAffiliateLinkStatusLabel(linkStatus)}</p>
      <p className="mt-1 text-xs leading-5 text-amber-100/80">
        URL有効期限: {candidate.product.affiliate_url_expires_at ? new Date(candidate.product.affiliate_url_expires_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }) : "未確認"} / クリック後の成果判定: {MYFANS_CLICK_ATTRIBUTION_WINDOW_HOURS}時間として別管理
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={candidate.product.product_url || "https://www.affiliate.myfans.jp/dashboard"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-black text-black">
          <ExternalLink size={15} /> アフィリンクを作る
        </a>
        <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionまたはコピーで取得</span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSave(candidate, event.currentTarget); }} className="mt-3 grid gap-2">
        <input name="affiliate_url" type="url" required defaultValue={candidate.product.affiliate_url} placeholder="https://mfco.link/r/..." className={inputClass} />
        <input name="affiliate_url_expires_at" type="datetime-local" className={inputClass} />
        <button type="submit" disabled={pendingId === affiliatePendingId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">
          {pendingId === affiliatePendingId ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
          正規リンクを保存
        </button>
      </form>
    </div>
  );
}

function CandidateWorkflowSet({ candidate }: { candidate: ExecutionCandidate }) {
  return (
    <>
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs font-black text-zinc-500">完成投稿セット</p>
        <div className="mt-2 grid gap-1 text-xs leading-5 text-zinc-300">
          <p><span className="font-black text-zinc-500">投稿方法:</span> {postModeLabel(candidate)} / {linkStrategyLabel(candidate)}</p>
          <p><span className="font-black text-zinc-500">引用元X投稿者:</span> {candidate.sourceAuthorLabel}</p>
          <p><span className="font-black text-zinc-500">引用元X:</span> {candidate.quoteXUrl || candidate.sourceXUrl || "-"}</p>
          <p><span className="font-black text-zinc-500">引用画像/動画:</span> {candidate.mediaPermalink || "なし（status URLを使用）"}</p>
          <p><span className="font-black text-zinc-500">引用メディア:</span> {sourceMediaTypeLabel(candidate)} / quote tweetは元Xを引用、再アップロードなし</p>
          <p><span className="font-black text-zinc-500">myfansクリエイター:</span> {candidate.myfansCreator?.name || "myfans未紐付け"}</p>
          <p><span className="font-black text-zinc-500">myfans作品:</span> {candidate.myfansCreator ? candidate.product?.title ?? "なし" : "なし"}</p>
          <p><span className="font-black text-zinc-500">monetizable status:</span> {monetizableStatusLabel(candidate)}</p>
          <p><span className="font-black text-zinc-500">myfans送客先:</span> {candidate.affiliateTargetUrl || "-"}</p>
          <p><span className="font-black text-zinc-500">アフィリエイト:</span> {affiliateStatusLabel(candidate)} {candidate.affiliateUrl ? `/ ${candidate.affiliateUrl}` : ""}</p>
        </div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-zinc-300">
          {postingSteps(candidate).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <summary className="cursor-pointer text-xs font-black text-zinc-500">内部メモを表示</summary>
        <p className="mt-3 text-sm leading-6 text-zinc-500">{candidate.productReason}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{candidate.mediaPolicy}</p>
      </details>
    </>
  );
}

function CandidateActionButtons({ candidate, linkRequired, linkReady, selfReply, pendingId, saved, saveBlockReason, onCopy, onMessage, onSave }: {
  candidate: ExecutionCandidate;
  linkRequired: boolean;
  linkReady: boolean;
  selfReply: string;
  pendingId: string | number | null;
  saved: boolean;
  saveBlockReason: string | null;
  onCopy: CopyHandler;
  onMessage: (message: Message) => void;
  onSave: (candidate: ExecutionCandidate) => void;
}) {
  function saveCardImage() {
    try {
      downloadCardPng(candidate);
      onMessage({ text: "カード画像をPNGで保存しました。", error: false });
    } catch (error) {
      onMessage({ text: error instanceof Error ? error.message : "画像生成に失敗しました。text onlyで投稿してください。", error: true });
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      {["ranking_card", "comparison_card", "discovery_card"].includes(candidate.creativeStrategy) && (
        <button type="button" disabled={!candidate.product} onClick={saveCardImage} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-black disabled:opacity-40"><Download size={15} />画像を保存</button>
      )}
      <button type="button" onClick={() => onCopy(publishBody(candidate), "Xに投稿する本文")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white"><Copy size={15} />X本文をコピー</button>
      <button type="button" disabled={linkRequired && !linkReady} onClick={() => onCopy(selfReply, "Xに投稿する自己リプ")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />X自己リプをコピー</button>
      <button type="button" disabled={!candidate.quoteXUrl} onClick={() => onCopy(candidate.quoteXUrl, "引用元X URL")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />引用URLをコピー</button>
      <button type="button" disabled={!candidate.affiliateUrl || candidate.linkStrategy === "no_link" || candidate.linkStrategy === "profile_cta"} onClick={() => onCopy(candidate.affiliateUrl, "リンク")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Copy size={15} />リンクをコピー</button>
      {candidate.ogpCheckRequired && <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-700 px-3 text-xs font-black text-cyan-200"><ImageIcon size={15} />OGPを確認</span>}
      {(candidate.quoteXUrl || candidate.sourceXUrl)
        ? <a href={quoteIntentUrl(candidate)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-black text-white"><ExternalLink size={15} />X投稿画面を開く</a>
        : <button type="button" disabled className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-xs font-black text-zinc-500"><ExternalLink size={15} />X投稿画面を開く</button>}
      <button type="button" disabled={saved || pendingId === candidate.id || Boolean(saveBlockReason)} onClick={() => onSave(candidate)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50">{saved ? <Check size={15} /> : <Save size={15} />}{saved ? "投稿ログに保存済み" : "この候補を投稿ログへ保存"}</button>
      {saveBlockReason && <p className="mt-2 text-xs font-bold text-amber-200">保存不可: {saveBlockReason}</p>}
    </div>
  );
}

export function MyfansExecutionCandidateCard({ candidate, pendingId, saved, onCopy, onSaveCandidate, onSaveAffiliateLink, onMessage }: {
  candidate: ExecutionCandidate;
  pendingId: string | number | null;
  saved: boolean;
  onCopy: CopyHandler;
  onSaveCandidate: (candidate: ExecutionCandidate) => void;
  onSaveAffiliateLink: (candidate: ExecutionCandidate, form: HTMLFormElement) => void;
  onMessage: (message: Message) => void;
}) {
  const linkRequired = needsFreshAffiliateLink(candidate);
  const linkReady = canUseAffiliateLink(candidate);
  const saveBlockReason = candidateSaveBlockReason(candidate);
  const body = publishBody(candidate);
  const selfReplyPreview = linkRequired && candidate.product && linkReady
    ? `#PR\n詳細はこちら\n${candidate.product.affiliate_url}`.trim()
    : candidate.selfReply;

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-black text-emerald-300">{candidate.approvedMediaName} / {candidate.plannedSlot}</p>
      <h2 className="mt-2 text-lg font-black">{candidate.candidateTitle}</h2>
      <p className="mt-2 text-sm font-black text-white">{candidate.role}</p>
      <p className="mt-2 text-xs text-zinc-500">{candidate.growthStage} / {candidate.candidateType} / {candidate.dailyRole} / {candidate.postType} / {candidate.linkStrategy} / {candidate.objective}</p>
      <CandidateQualityReview candidate={candidate} />
      <CandidateStrategyDetails candidate={candidate} />
      <CandidatePostContent candidate={candidate} body={body} selfReply={selfReplyPreview} linkRequired={linkRequired} linkReady={linkReady} />
      {linkRequired && candidate.product && <CandidateAffiliateEditor candidate={candidate} pendingId={pendingId} onSave={onSaveAffiliateLink} />}
      <CandidateWorkflowSet candidate={candidate} />
      <CandidateActionButtons
        candidate={candidate}
        linkRequired={linkRequired}
        linkReady={linkReady}
        selfReply={selfReplyPreview}
        pendingId={pendingId}
        saved={saved}
        saveBlockReason={saveBlockReason}
        onCopy={onCopy}
        onMessage={onMessage}
        onSave={onSaveCandidate}
      />
    </article>
  );
}
