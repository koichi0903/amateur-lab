import Link from "next/link";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Copy, ExternalLink, Film, MessageCircle, ShieldCheck, Sparkles, Target, TrendingUp, XCircle } from "lucide-react";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { getFanzaXAccountGrowth } from "@/lib/fanzaXAccountGrowth";
import { buildXGrowthOS, getRightsCheckedMediaCount, type XDailyTopPick, type XGrowthIntent, type XGrowthOpportunity } from "@/lib/xGrowthOS";
import { getPersistedTodayTopPicks, type PersistedXDailyPlan } from "@/lib/xGrowthOperations";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";
import { getRightsReviewQueue, isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { buildTopPickSlotsViewModel } from "@/lib/xGrowthTopPicks";
import { visualFactBasis, type XVisualVideoFacts } from "@/lib/xVisualVideoFacts";
import { CandidateSelectAction, DeferredXGrowthSections, MediaPipelineActions, MetricSyncActions, OpportunityActions, RegenerateTopPicksAction, RightsReviewActions, TempFolderStatus, TopPickVideoActions, TrimReviewActions } from "./XGrowthActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const intentStyle: Record<XGrowthIntent, string> = {
  REACH: "border-sky-700 bg-sky-950/40 text-sky-200",
  AUTHORITY: "border-cyan-700 bg-cyan-950/40 text-cyan-200",
  FOLLOW: "border-violet-700 bg-violet-950/40 text-violet-200",
  CONVERSATION: "border-amber-700 bg-amber-950/40 text-amber-200",
  MONEY: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
};

const moneyGateReasonLabel: Record<string, string> = {
  missing_affiliate_url: "affiliate URL不足",
  price_truth_unavailable: "価格根拠不足",
  last_mile_ng: "Last-Mile NG",
  native_x_voice_ng: "Native X Voice NG",
  unsafe_or_too_explicit: "安全/素材基準NG",
  duplicate_or_posted: "重複/投稿済み",
  stale_or_expired: "期限切れ/鮮度不足",
  media_mismatch: "素材不一致",
  other: "その他",
};

function yen(value: number | null) {
  return value ? `¥${value.toLocaleString("ja-JP")}` : "-";
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-zinc-800 bg-zinc-900 p-5 ${className}`}>{children}</section>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${ok ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-amber-700 bg-amber-950/40 text-amber-200"}`}>
      {label}: {ok ? "OK" : "待ち"}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
        <span>{label}</span><span>{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-zinc-800">
        <div className="h-full rounded bg-emerald-400" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function mediaName(item: Pick<XGrowthOpportunity, "mediaType">) {
  if (item.mediaType === "sample_movie") return "動画使用可";
  if (item.mediaType === "existing_link_image") return "既存リンク画像";
  if (item.mediaType === "data_card") return "データカード";
  if (item.mediaType === "quote") return "引用候補";
  return "テキストのみ";
}

function sampleMoviePreviewUrl(workId: number | null | undefined, assetId?: number | null) {
  if (!workId) return "";
  return `/api/admin/x-growth/media/download?workId=${encodeURIComponent(String(workId))}&mediaType=sample_movie${assetId ? `&assetId=${encodeURIComponent(String(assetId))}` : ""}&preview=1`;
}

function videoHookReason(item: Pick<XGrowthOpportunity, "mediaType" | "mediaAsset">) {
  if (item.mediaType !== "sample_movie") return null;
  const tags = item.mediaAsset?.manual_tags ?? [];
  if (tags.includes("first_seconds_strong")) return "冒頭が強い";
  if (tags.includes("visual_mismatch")) return "ジャケとの印象差あり";
  if (tags.includes("scene_surprise")) return "入り方に意外性";
  if (tags.includes("actress_fit")) return "女優×作品相性";
  if (tags.includes("safe_preview")) return "安全に見せられる試聴";
  return "内容断定なし";
}

function factBasisLabel(facts: XVisualVideoFacts | null | undefined) {
  const basis = visualFactBasis(facts);
  return basis.label;
}

function editorialVerdict(item: XGrowthOpportunity) {
  const variant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
  const verdict = variant?.quality.lastMile.verdict ?? "do_not_post";
  if (verdict === "post_ok") return { label: "投稿OK", className: "border-emerald-700 bg-emerald-950/40 text-emerald-200" };
  if (verdict === "revise") return { label: "要改善", className: "border-amber-700 bg-amber-950/40 text-amber-200" };
  return { label: "投稿しない", className: "border-rose-700 bg-rose-950/40 text-rose-200" };
}

type LinkStrategyView = {
  plan: "none" | "body" | "self_reply";
  label: "投稿戦略: リンクなし" | "投稿戦略: リンク本文内" | "投稿戦略: 自己リプリンク";
  affiliateUrl: string | null;
  reason: string;
  cta: string;
  instruction: string;
};

function ctaLabel(value?: string | null) {
  if (value === "price_cta") return "価格・サンプル確認へ送る";
  if (value === "reason_cta") return "見る理由だけを残す";
  return "投稿意図に合わせて控えめに誘導";
}

function linkStrategyFor(item: {
  role: XGrowthIntent;
  intent?: XGrowthIntent;
  url?: string;
  postText: string;
  replyText: string | null;
  ctaStrategy?: string | null;
  selectedVariant?: PersistedTopPick["selectedVariant"] | XDailyTopPick["creativeVariants"][number] | null;
  creativeVariants?: XDailyTopPick["creativeVariants"];
  creativeVariantId?: string;
}) {
  const role = item.role ?? item.intent;
  const selected = "selectedVariant" in item
    ? item.selectedVariant
    : item.creativeVariants?.find((variant) => variant.id === item.creativeVariantId) ?? item.creativeVariants?.[0] ?? null;
  const explicitPlan = selected?.linkPlan;
  const affiliateUrl = item.url ?? selected?.url ?? null;
  if (role !== "MONEY") {
    return {
      plan: "none",
      label: "投稿戦略: リンクなし",
      affiliateUrl,
      reason: "REACH / FOLLOW / AUTHORITY / CONVERSATIONは、リンクを貼らず認知・保存・フォロー導線を優先します。",
      cta: ctaLabel(item.ctaStrategy ?? selected?.ctaStrategy),
      instruction: "完成文にはリンクを入れない。必要なら後から手動追加できます。",
    } satisfies LinkStrategyView;
  }
  if (explicitPlan === "reply_link") {
    return {
      plan: "self_reply",
      label: "投稿戦略: 自己リプリンク",
      affiliateUrl,
      reason: "A/Bテストで自己リプvariantが明示されたため、本投稿からリンクを外して投稿後の自己リプに入れます。",
      cta: ctaLabel(item.ctaStrategy ?? selected?.ctaStrategy),
      instruction: "投稿後、この自己リプを付ける",
    } satisfies LinkStrategyView;
  }
  return {
    plan: "body",
    label: "投稿戦略: リンク本文内",
    affiliateUrl,
    reason: "MONEY投稿のデフォルトです。本文末にリンクを入れ、クリック導線を投稿内で完結させます。",
    cta: ctaLabel(item.ctaStrategy ?? selected?.ctaStrategy),
    instruction: "この投稿の本文にリンクを入れる",
  } satisfies LinkStrategyView;
}

function LinkStrategyPanel({ strategy, replyText }: { strategy: LinkStrategyView; replyText: string | null }) {
  const isMoney = strategy.plan !== "none";
  return (
    <div className={`mt-3 rounded-lg border p-3 ${strategy.plan === "none" ? "border-sky-800 bg-sky-950/20" : "border-emerald-700 bg-emerald-950/25"}`}>
      <p className={`text-2xl font-black ${strategy.plan === "none" ? "text-sky-100" : "text-emerald-100"}`}>{strategy.label}</p>
      <p className="mt-1 text-sm font-black text-white">{strategy.instruction}</p>
      <div className={`mt-3 space-y-2 text-xs leading-5 ${isMoney ? "text-emerald-50/80" : "text-sky-50/80"}`}>
        <p>{isMoney ? "affiliate URL" : "後付け用リンク"}: <span className="break-all font-bold text-white">{strategy.affiliateUrl ?? "未取得"}</span></p>
        {!isMoney && <p>このURLは完成文には含まれていません。必要なら本文または自己リプへ手動追加できます。</p>}
        <p>link strategy理由: {strategy.reason}</p>
        <p>CTA strategy: {strategy.cta}</p>
        {strategy.plan === "self_reply" && <p>自己リプ文: <span className="text-emerald-100">{replyText ?? "未生成"}</span></p>}
      </div>
    </div>
  );
}

function stripPostUrls(text: string) {
  return text.split("\n").filter((line) => !/^https?:\/\//.test(line.trim())).join("\n").trim();
}

function postTextForLinkStrategy(postText: string, strategy: LinkStrategyView) {
  const clean = stripPostUrls(postText);
  if (strategy.plan !== "body" || !strategy.affiliateUrl) return clean;
  return clean.includes(strategy.affiliateUrl) ? clean : `${clean}\n${strategy.affiliateUrl}`;
}

function replyTextForLinkStrategy(replyText: string | null, strategy: LinkStrategyView) {
  if (strategy.plan !== "self_reply") return null;
  if (replyText?.includes(strategy.affiliateUrl ?? "")) return replyText;
  return strategy.affiliateUrl ? `#PR\n必要な時だけ確認用です。\n${strategy.affiliateUrl}` : replyText;
}

function TopPickCard({ item }: { item: XDailyTopPick }) {
  const mediaOk = item.mediaUsage === "allowed";
  const hasImagePreview = mediaOk && (item.mediaType === "data_card" || Boolean(item.recommendedMediaUrl && item.mediaType === "existing_link_image"));
  const previewUrl = item.mediaType === "data_card"
    ? `/api/admin/x-growth/media/download?workId=${encodeURIComponent(String(item.workId))}&mediaType=data_card`
    : item.recommendedMediaUrl ?? "";
  const verdict = editorialVerdict(item);
  const selectedVariant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
  const linkStrategy = linkStrategyFor({ ...item, selectedVariant });
  const displayPostText = postTextForLinkStrategy(item.postText, linkStrategy);
  const displayReplyText = replyTextForLinkStrategy(item.replyText, linkStrategy);
  const hookReason = videoHookReason(item);
  const trimStartSeconds = Number(item.mediaAsset?.trim_start_seconds ?? 0);
  return (
    <article className="rounded-lg border border-emerald-800 bg-zinc-950 p-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-lg font-black text-black">{item.pickOrder}</span>
          <div>
            <p className="text-[11px] font-black text-zinc-500">投稿順 / 推奨時刻</p>
            <p className="text-sm font-black text-white">{item.pickOrder}件目・{item.recommendedTimeLabel}</p>
          </div>
          <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-black ${intentStyle[item.intent]}`}>{item.intent}</span>
          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-black text-zinc-300">{item.sourceType}</span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${verdict.className}`}>{verdict.label}</span>
        </div>
        <div className="grid gap-2 text-[11px] font-black sm:grid-cols-2">
          <p className={`rounded-lg border px-3 py-2 ${mediaOk ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-rose-800 bg-rose-950/30 text-rose-200"}`}>使用素材: {mediaName(item)} / {mediaOk ? "使用可" : "不可"}</p>
          <p className={`rounded-lg border px-3 py-2 ${item.intent === "MONEY" ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-sky-800 bg-sky-950/30 text-sky-200"}`}>{linkStrategy.label}</p>
          {hookReason && <p className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-cyan-100">動画Hook根拠: {hookReason}</p>}
          <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300">文面根拠: {factBasisLabel(item.visualFacts)}</p>
          <p className="rounded-lg border border-violet-800 bg-violet-950/20 px-3 py-2 text-violet-100">Fact→semantic: {item.setDiversity.signature.primaryFactKind} → {item.setDiversity.signature.semanticHookCategory}{item.setDiversity.signature.semanticMappingReason ? ` / ${item.setDiversity.signature.semanticMappingReason}` : ""}</p>
          {item.mediaType === "sample_movie" && trimStartSeconds > 0 && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100">冒頭トリム: {trimStartSeconds.toFixed(1)}秒</p>}
        </div>
        <LinkStrategyPanel strategy={linkStrategy} replyText={displayReplyText} />
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
          <p className="text-[11px] font-black text-emerald-300">伸びる可能性</p>
          <p className="mt-1 text-sm leading-6 text-emerald-50">{item.whyBuzz}</p>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-black text-zinc-300">この完成文を投稿</h3>
      <textarea suppressHydrationWarning readOnly value={displayPostText} className="mt-2 h-44 w-full resize-none rounded-lg border border-emerald-800 bg-black p-3 text-sm leading-6 text-zinc-100 outline-none" />
      {displayReplyText && <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-5 text-zinc-400">投稿後、この自己リプを付ける: {displayReplyText}</p>}

      {hasImagePreview && (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="relative h-48 w-full bg-black">
            <Image src={previewUrl} alt={item.title} fill sizes="(max-width: 1280px) 90vw, 390px" unoptimized className="object-contain" />
          </div>
        </div>
      )}

      <TopPickVideoActions
        postText={displayPostText}
        mediaUrl={item.recommendedMediaUrl}
        mediaType={item.mediaType}
        quoteUrl={item.mediaType === "quote" ? item.recommendedMediaUrl : null}
        workId={item.workId}
        trimAllowed={isOfficialFanzaDmmSampleUrl(item.mediaAsset?.source_url ?? item.recommendedMediaUrl)}
        mediaAsset={item.mediaAsset?.id ? {
          id: item.mediaAsset.id,
          can_modify: item.mediaAsset.can_modify,
          trim_modify_confirmed: item.mediaAsset.trim_modify_confirmed,
          trim_start_seconds: item.mediaAsset.trim_start_seconds,
          trim_note: item.mediaAsset.trim_note,
        } : null}
        intent={item.intent}
        pickOrder={item.pickOrder}
        linkPlan={linkStrategy.plan}
        affiliateUrl={linkStrategy.affiliateUrl}
        replyText={displayReplyText}
      />

      <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <summary className="cursor-pointer text-xs font-black text-zinc-300">詳細</summary>
        <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-400">
          <div>
            <p className="font-black text-zinc-200">選定理由</p>
            <ul className="mt-2 space-y-1">
              {item.whyToday.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            {item.alternativeReason && <p className="mt-2 text-zinc-500">{item.alternativeReason}</p>}
          </div>
          <p className="font-black text-zinc-200">作品: <span className="font-bold text-zinc-400">{item.title}</span></p>
          <p>ランキング履歴: {item.rankingHistory.status === "ready" ? `${item.rankingHistory.previousRanking ?? "-"}位→${item.ranking ?? "-"}位` : `履歴蓄積中（${item.rankingHistory.observations}日分）。時系列コピーは未解禁`}</p>
          <p>素材判定: {item.mediaDecision}</p>
          <p>Creative angle: {item.creativeAngle} / evidence {item.sourceEvidence.join(" / ")}</p>
          {hookReason && <p>動画Hook根拠: {hookReason} / tags {(item.mediaAsset?.manual_tags ?? []).join(", ") || "なし"}</p>}
          <p>Visual/Video Facts: {item.visualFacts?.usableFacts.length ?? 0}件使用可 / {item.visualFacts?.facts.length ?? 0}件候補 / {item.visualFacts?.diagnostics.join(" / ") || "Truth Guard OK"}</p>
          <p>狙い: {item.setDiversity.roleLabel}</p>
          <p>当日セット重複チェック: {item.setDiversity.status} / {item.setDiversity.reasons.length ? item.setDiversity.reasons.join(" / ") : "opening/judgment/構造の同日重複なし"}</p>
          <p>Creative構造: {item.setDiversity.signature.openingPattern} / {item.setDiversity.signature.subjectStructure} / {item.setDiversity.signature.emotionalAngle} / {item.setDiversity.signature.mediaType} / {item.setDiversity.signature.linkStrategy}</p>
          <p>Human Voice Gate: {selectedVariant?.quality.lastMile.humanVoice.passed ? "OK" : "NG"} / {selectedVariant?.quality.lastMile.humanVoice.reasons.length ? selectedVariant.quality.lastMile.humanVoice.reasons.join(" / ") : "内部語なし・外向き文としてOK"}</p>
          <p>Native X Voice: {selectedVariant?.quality.lastMile.nativeXVoice.passed ? "OK" : "NG"} / {selectedVariant?.quality.lastMile.nativeXVoice.reasons.length ? selectedVariant.quality.lastMile.nativeXVoice.reasons.join(" / ") : "Xに自然な短文としてOK"}</p>
          <p>Last-Mile Gate: {selectedVariant?.quality.lastMile.verdict === "post_ok" ? "投稿OK" : selectedVariant?.quality.lastMile.verdict === "revise" ? "要改善" : "投稿しない"} / 校正 {selectedVariant?.quality.lastMile.rewriteCount ?? 0}回 / {selectedVariant?.quality.lastMile.reasons.length ? selectedVariant.quality.lastMile.reasons.join(" / ") : "NG理由なし"}</p>
          <p>Buzz Potential {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.total ?? "-"} / Scroll Stop {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.scrollStop ?? "-"} / Curiosity {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.curiosity ?? "-"} / Share {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.shareability ?? "-"} / Reply {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.replyability ?? "-"} / Media Fit {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.mediaFit ?? "-"} / Novelty {item.creativeVariants.find((variant) => variant.id === item.creativeVariantId)?.buzzPotential.novelty ?? "-"}</p>
          <p>Freshness {item.freshness.total} / 価格 {item.freshness.priceChangeScore} / セール {item.freshness.saleScore} / ランキング {item.freshness.rankingVelocityScore}</p>
          <p>Daily Score {item.dailyScore}</p>
        </div>
      </details>
    </article>
  );
}

type PersistedTopPick = PersistedXDailyPlan["top_picks"][number];

function PersistedTopPickCard({ item }: { item: PersistedTopPick }) {
  const mediaOk = item.mediaUsage === "allowed";
  const hookReason = videoHookReason({ mediaType: item.mediaType, mediaAsset: item.mediaAsset });
  const verdict = item.selectedVariant?.quality.lastMile.verdict ?? "post_ok";
  const verdictClass = verdict === "post_ok" ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : verdict === "revise" ? "border-amber-700 bg-amber-950/40 text-amber-200" : "border-rose-700 bg-rose-950/40 text-rose-200";
  const linkStrategy = linkStrategyFor(item);
  const displayPostText = postTextForLinkStrategy(item.postText, linkStrategy);
  const displayReplyText = replyTextForLinkStrategy(item.replyText, linkStrategy);
  const trimStartSeconds = Number(item.mediaAsset?.trim_start_seconds ?? 0);
  return (
    <article className={`rounded-lg border bg-zinc-950 p-4 ${item.isSelected === false ? "border-zinc-800 opacity-80" : "border-emerald-800"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg font-black ${item.isSelected === false ? "bg-zinc-700 text-zinc-100" : "bg-emerald-400 text-black"}`}>{item.candidateRank ?? item.pickOrder}</span>
        <div>
          <p className="text-[11px] font-black text-zinc-500">候補順位 / 推奨時刻</p>
          <p className="text-sm font-black text-white">{item.candidateRank ? `候補${item.candidateRank}` : `${item.pickOrder}件目`}・{item.recommendedTimeLabel}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${item.isSelected === false ? "border-zinc-700 text-zinc-400" : "border-emerald-700 bg-emerald-950/40 text-emerald-200"}`}>{item.isSelected === false ? "比較候補" : "選択中"}</span>
        <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-black ${intentStyle[item.role]}`}>{item.role}</span>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-black text-zinc-300">{item.sourceType}</span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${verdictClass}`}>{verdict === "post_ok" ? "投稿OK" : verdict === "revise" ? "要改善" : "投稿しない"}</span>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] font-black sm:grid-cols-2">
        <p className={`rounded-lg border px-3 py-2 ${mediaOk ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-rose-800 bg-rose-950/30 text-rose-200"}`}>使用素材: {mediaName({ mediaType: item.mediaType })} / {mediaOk ? "使用可" : "不可"}</p>
        <p className={`rounded-lg border px-3 py-2 ${item.role === "MONEY" ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-sky-800 bg-sky-950/30 text-sky-200"}`}>{linkStrategy.label}</p>
        {hookReason && <p className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-cyan-100">動画Hook根拠: {hookReason}</p>}
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300">文面根拠: {factBasisLabel(item.visualFacts)}</p>
        <p className="rounded-lg border border-violet-800 bg-violet-950/20 px-3 py-2 text-violet-100">Fact→semantic: {item.setDiversity.signature.primaryFactKind} → {item.setDiversity.signature.semanticHookCategory}{item.setDiversity.signature.semanticMappingReason ? ` / ${item.setDiversity.signature.semanticMappingReason}` : ""}</p>
        {item.mediaType === "sample_movie" && trimStartSeconds > 0 && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100">冒頭トリム: {trimStartSeconds.toFixed(1)}秒</p>}
      </div>
      <LinkStrategyPanel strategy={linkStrategy} replyText={displayReplyText} />
      <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
        <p className="text-[11px] font-black text-emerald-300">{item.candidateRank === "A" ? "推奨理由" : "残す理由 / 注意点"}</p>
        <p className="mt-1 text-sm leading-6 text-emerald-50">{item.whyBuzz}</p>
        {item.alternativeReason && <p className="mt-2 text-xs leading-5 text-emerald-100/70">{item.alternativeReason}</p>}
      </div>
      <CandidateSelectAction slotId={item.slotId} candidateId={item.candidateId} selected={item.isSelected !== false} />
      <h3 className="mt-4 text-sm font-black text-zinc-300">この完成文を投稿</h3>
      <textarea suppressHydrationWarning readOnly value={displayPostText} className="mt-2 h-44 w-full resize-none rounded-lg border border-emerald-800 bg-black p-3 text-sm leading-6 text-zinc-100 outline-none" />
      {displayReplyText && <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-5 text-zinc-400">投稿後、この自己リプを付ける: {displayReplyText}</p>}
      {item.isSelected === false && (
        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs font-bold text-zinc-400">この候補を投稿に使う場合は先に選択してください。動画の確認と冒頭カット位置の保存はこのまま使えます。</p>
      )}
      <TopPickVideoActions
        postText={displayPostText}
        mediaUrl={item.recommendedMediaUrl}
        mediaType={item.mediaType}
        quoteUrl={item.mediaType === "quote" ? item.recommendedMediaUrl : null}
        workId={item.workId}
        trimAllowed={isOfficialFanzaDmmSampleUrl(item.mediaAsset?.source_url ?? item.recommendedMediaUrl)}
        mediaAsset={item.mediaAsset?.id ? {
          id: item.mediaAsset.id,
          can_modify: item.mediaAsset.can_modify,
          trim_modify_confirmed: item.mediaAsset.trim_modify_confirmed,
          trim_start_seconds: item.mediaAsset.trim_start_seconds,
          trim_note: item.mediaAsset.trim_note,
        } : null}
        candidateId={item.candidateId}
        slotId={item.slotId}
        candidateRank={item.candidateRank}
        slotRole={item.slotRole}
        title={item.title}
        intent={item.role}
        pickOrder={item.pickOrder}
        linkPlan={linkStrategy.plan}
        affiliateUrl={linkStrategy.affiliateUrl}
        replyText={displayReplyText}
      />
      <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <summary className="cursor-pointer text-xs font-black text-zinc-300">詳細</summary>
        <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
          <p>作品: <span className="font-bold text-zinc-300">{item.title}</span></p>
          <p>素材判定: {item.mediaDecision}</p>
          <p>Creative angle: {item.creativeAngle} / evidence {item.sourceEvidence.join(" / ")}</p>
          <p>Visual/Video Facts: {item.visualFacts?.usableFacts.length ?? 0}件使用可 / {item.visualFacts?.facts.length ?? 0}件候補 / {item.visualFacts?.diagnostics.join(" / ") || "Truth Guard OK"}</p>
          <p>当日セット重複チェック: {item.setDiversity.status} / {item.setDiversity.reasons.length ? item.setDiversity.reasons.join(" / ") : "opening/judgment/構造の同日重複なし"}</p>
          <p>Native X Voice: {item.selectedVariant?.quality.lastMile.nativeXVoice.passed ? "OK" : "NG"} / {item.selectedVariant?.quality.lastMile.nativeXVoice.reasons.length ? item.selectedVariant.quality.lastMile.nativeXVoice.reasons.join(" / ") : "Xに自然な短文としてOK"}</p>
          <p>Buzz Potential {item.selectedVariant?.buzzPotential.total ?? "-"} / Scroll Stop {item.selectedVariant?.buzzPotential.scrollStop ?? "-"} / Media Fit {item.selectedVariant?.buzzPotential.mediaFit ?? "-"}</p>
          {item.alternativeReason && <p>{item.alternativeReason}</p>}
        </div>
      </details>
    </article>
  );
}

function PersistedSlotGroup({ label, items }: { label: string; items: PersistedTopPick[] }) {
  const selected = items.find((item) => item.isSelected !== false) ?? items[0];
  return (
    <section className="rounded-lg border border-emerald-800/70 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-white">{label}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">候補 {items.length}/3 / 選択中 {selected?.candidateRank ?? "A"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${intentStyle[selected?.role ?? "REACH"]}`}>{selected?.role ?? "候補なし"}</span>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {items.map((item) => <PersistedTopPickCard key={`${item.slotId}-${item.candidateId}-${item.key}`} item={item} />)}
      </div>
    </section>
  );
}

function OpportunityCard({ item, persistedId }: { item: XGrowthOpportunity; persistedId: number | null }) {
  const recommended = item.creativeVariants.find((variant) => variant.id === item.creativeVariantId) ?? item.creativeVariants[0];
  const verdict = editorialVerdict(item);
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${intentStyle[item.intent]}`}>{item.intent}</span>
          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400">{item.sourceType}</span>
          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400">{item.eventType}</span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${item.mediaUsage === "allowed" ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : "border-amber-800 bg-amber-950/40 text-amber-300"}`}>
          {item.mediaType === "existing_link_image" ? "既存リンク画像" : item.mediaType === "sample_movie" ? "mp4候補" : "データ素材"} / {item.mediaUsage === "allowed" ? "投稿可" : "権利確認待ち"}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-black text-zinc-100">{item.topic}</h3>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{item.title}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ScoreBar label="Reach" value={item.reachScore} />
        <ScoreBar label="Follow" value={item.followScore} />
        <ScoreBar label="Authority" value={item.authorityScore} />
        <ScoreBar label="Revenue" value={item.revenueScore} />
      </div>

      <div className="mt-4 rounded-lg bg-zinc-900 p-3">
        <p className="text-xs font-black text-zinc-300">根拠</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-zinc-500">
          {item.evidence.slice(0, 4).map((evidence) => <li key={evidence}>{evidence}</li>)}
        </ul>
      </div>

      <div className="mt-4 rounded-lg border border-sky-900 bg-sky-950/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black text-sky-200">Creative Studio 推奨案</p>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black ${recommended?.quality.passed ? "border-emerald-700 text-emerald-200" : "border-rose-700 text-rose-200"}`}>
            {recommended?.quality.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {recommended?.quality.passed ? "投稿候補" : "今日投稿する価値なし"} / {recommended?.quality.total ?? 0}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black ${verdict.className}`}>{verdict.label}</span>
        </div>
        <textarea suppressHydrationWarning readOnly value={item.postText} className="mt-3 h-36 w-full resize-none rounded-lg border border-zinc-800 bg-black p-3 text-xs leading-5 text-zinc-300 outline-none" />
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400"><Copy size={12} />この完成文を手動コピーしてX投稿に使用</p>
        {recommended?.quality.weaknesses.length ? (
          <div className="mt-3 text-[11px] leading-5 text-amber-100/80">
            <p className="font-black text-amber-200">弱点</p>
            {recommended.quality.improvements.slice(0, 3).map((item) => <p key={item}>{item}</p>)}
          </div>
        ) : null}
      </div>
      {item.replyText && <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-5 text-zinc-500">補足リプ: {item.replyText}</p>}

      <div className="mt-4 grid gap-3">
        {item.creativeVariants.map((variant) => (
          <div key={variant.id} className={`rounded-lg border p-3 ${variant.id === item.creativeVariantId ? "border-sky-700 bg-sky-950/20" : "border-zinc-800 bg-zinc-900"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${intentStyle[variant.intent]}`}>{variant.intent}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{variant.structure}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{variant.hookDirection}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{variant.mediaType} / {variant.linkPlan}</span>
              <span className={`ml-auto rounded-full border px-2 py-1 text-[10px] font-black ${variant.quality.passed ? "border-emerald-700 text-emerald-200" : "border-rose-700 text-rose-200"}`}>
                {variant.quality.passed ? "Gate OK" : "Gate NG"} {variant.quality.total}
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${variant.quality.lastMile.passed ? "border-emerald-700 text-emerald-200" : "border-amber-700 text-amber-200"}`}>
                {variant.quality.lastMile.verdict === "post_ok" ? "投稿OK" : variant.quality.lastMile.verdict === "revise" ? "要改善" : "投稿しない"}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-zinc-300">{variant.bodyText}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ScoreBar label="Scroll Stop" value={variant.quality.dimensions.scrollStop} />
              <ScoreBar label="Curiosity" value={variant.quality.dimensions.curiosity} />
              <ScoreBar label="Proof" value={variant.quality.dimensions.proof} />
              <ScoreBar label="Judgment" value={variant.quality.dimensions.judgment} />
              <ScoreBar label="Follow Value" value={variant.quality.dimensions.followValue} />
              <ScoreBar label="Specificity" value={variant.quality.dimensions.specificity} />
              <ScoreBar label="Novelty" value={variant.quality.dimensions.novelty} />
              <ScoreBar label="Shareability" value={variant.quality.dimensions.shareability} />
              <ScoreBar label="Replyability" value={variant.quality.dimensions.replyability} />
              <ScoreBar label="Ad Smell低さ" value={100 - variant.quality.dimensions.adSmell} />
              <ScoreBar label="CTA Fit" value={variant.quality.dimensions.ctaFit} />
              <ScoreBar label="Media Fit" value={variant.quality.dimensions.mediaFit} />
            </div>
            <div className="mt-3 rounded-lg bg-black/40 p-2 text-[10px] leading-5 text-zinc-500">
              <p>{variant.quality.reasons.scrollStop}</p>
              <p>{variant.quality.reasons.proof}</p>
              <p>{variant.quality.reasons.novelty}</p>
              <p>{variant.quality.reasons.adSmell}</p>
              <p>Last-Mile: {variant.quality.lastMile.reasons.length ? variant.quality.lastMile.reasons.join(" / ") : "NG理由なし"}</p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">{variant.rationale}</p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-300">Buzz Potential {variant.buzzPotential.total}: {variant.buzzPotential.reason}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-[11px] leading-5 text-zinc-500 sm:grid-cols-2">
        <p>Genome: {item.creativeGenome.hook} / {item.creativeGenome.proof} / {item.creativeGenome.structure} / {item.creativeGenome.media} / {item.creativeGenome.linkStrategy}</p>
        <p>Angle: {item.creativeAngle} / {item.sourceEvidence.slice(0, 4).join(" / ")}</p>
        <p>価格 {yen(item.currentPrice)} / ランキング {item.ranking ?? "-"} / X PV {item.xPageViews}</p>
      </div>
      <Link href={`/works/${item.workId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-cyan-300 underline">
        作品ページ <ExternalLink size={12} />
      </Link>
      <OpportunityActions id={persistedId} canNativeVideo={item.canNativeVideo} />
    </article>
  );
}

function TopPicksSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> 管理画面へ戻る
        </Link>
        <div className="mt-7">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-300">HAKKUTSU X GROWTH OS</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">@hakkutsu_lab 司令塔</h1>
        </div>
        <Panel className="mt-8 border-emerald-700 bg-emerald-950/10">
          <div className="flex items-center gap-2"><Sparkles className="text-emerald-300" size={20} /><h2 className="text-2xl font-black">今日の投稿</h2></div>
          <p className="mt-2 text-sm leading-6 text-emerald-100/80">Top Picksを先に読み込んでいます。重い管理情報は後追いで表示します。</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-lg border border-emerald-900 bg-zinc-950" />
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

async function XGrowthPageContent() {
  const persisted = await getPersistedTodayTopPicks();
  if (persisted.plan && persisted.plan.top_picks.length > 0) {
    const plan = persisted.plan;
    const supply = plan.supply_diagnostics as {
      target?: string;
      reachGenerated?: number;
      reachGateOk?: number;
      shortages?: string[];
      generatedByRole?: Record<string, number>;
      gateOkByRole?: Record<string, number>;
      shortagesByRole?: Record<string, number>;
      eligibleByIntent?: Record<string, number>;
      moneyGenerated?: number;
      moneyHardGatePassed?: number;
      moneyAllocationEligible?: number;
      moneyPlaced?: number;
      moneyTopFailureReason?: string | null;
      semanticSupply?: Record<string, number>;
      semanticSelected?: Record<string, number>;
      semanticQuotaOverflowReasons?: string[];
      semanticMappingReasons?: Record<string, number>;
      nativeVoiceNgBySource?: Record<string, number>;
      crossPostDiversityRejected?: number;
      mediaMix?: { eligibleStrongVideos?: number; eligibleOfficialVideos?: number; selectedVideos?: number; fallbackOfficialSelected?: number; selectedVideosBySlot?: Record<string, number>; targetVideos?: number; unmetReason?: string | null };
    };
    const native = plan.native_x_learning as { overusedPatterns?: string[]; winningPatterns?: string[]; avoidConstructions?: string[] };
    const mediaReview = await getRightsReviewQueue(12);
    const slotGroups = buildTopPickSlotsViewModel(plan.top_picks).map((slot, index) => ({
      id: slot.slotId,
      label: ["投稿枠1: REACH中心", "投稿枠2: FOLLOW / AUTHORITY中心", "投稿枠3: MONEY または別REACH中心"][index],
      items: slot.candidates,
    }));
    const legacyTopPicks = plan.top_picks.some((item) => !item.slotId) ? plan.top_picks : [];
    const postableSlots = slotGroups.filter((slot) => slot.items.length > 0).length;
    const moneyCandidateCount = supply.eligibleByIntent?.MONEY ?? plan.top_picks.filter((item) => item.role === "MONEY").length;
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> 管理画面へ戻る
          </Link>
          <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-emerald-300">HAKKUTSU X GROWTH OS</p>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">@hakkutsu_lab 司令塔</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                保存済みの今日のTop Picksを先に表示しています。再生成した時だけ重いCreative判定を走らせます。
              </p>
            </div>
            <Link href="/admin/revenue" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-black hover:border-emerald-500">
              <BarChart3 size={16} /> 収益分析へ
            </Link>
          </div>
          <TempFolderStatus />

          <Panel className="mt-6 border-emerald-800 bg-emerald-950/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2"><Target className="text-emerald-300" size={20} /><h2 className="text-xl font-black">Today Mission</h2></div>
                <p className="mt-2 text-2xl font-black">{plan.mission_title}</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/80">{plan.mission_reason}</p>
                <p className="mt-2 text-xs font-bold text-emerald-200">生成: {plan.generated_at ? new Date(plan.generated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "未記録"}</p>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {(Object.entries(plan.target_mix) as Array<[XGrowthIntent, number]>).map(([intent, count]) => (
                  <div key={intent} className={`rounded-lg border p-3 ${intentStyle[intent]}`}>
                    <p className="text-[10px] font-black">{intent}</p>
                    <p className="mt-1 text-2xl font-black">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="mt-6 border-emerald-700 bg-emerald-950/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2"><Sparkles className="text-emerald-300" size={20} /><h2 className="text-2xl font-black">今日の投稿</h2></div>
              <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                保存済みTop Picksを即表示。完成文、素材、理由、手動投稿操作までこの枠で完結します。
              </p>
              <RegenerateTopPicksAction />
            </div>
              <div className="rounded-lg border border-emerald-800 bg-zinc-950 px-4 py-3 text-sm font-black text-emerald-200">
                本日の投稿可能枠: {postableSlots}/3 / 候補総数: {plan.top_picks.length}
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-100/70 md:grid-cols-2">
              <p>供給方針: 3投稿枠 × 各最大3候補。Hard Gate通過候補だけをA/B/Cに残します。</p>
              <p className={moneyCandidateCount > 0 ? "text-emerald-200" : "text-amber-200"}>
                {moneyCandidateCount > 0 ? `本日の収益候補: ${moneyCandidateCount}件 / Slot3にMONEYを最低1件配置` : "本日の収益候補: 0件 / 本日はリンク投稿なし"}
              </p>
              <p>MONEY診断: generated {supply.moneyGenerated ?? "-"} / Hard Gate passed {supply.moneyHardGatePassed ?? "-"} / allocation eligible {supply.moneyAllocationEligible ?? "-"} / Slot3 placed {supply.moneyPlaced ?? "-"} / 主な落ち理由: {moneyGateReasonLabel[supply.moneyTopFailureReason ?? ""] ?? "なし"}</p>
              <p>Semantic: supply {Object.entries(supply.semanticSupply ?? {}).map(([category, count]) => `${category} ${count}`).join(" / ") || "未記録"} / selected {Object.entries(supply.semanticSelected ?? {}).filter(([, count]) => count > 0).map(([category, count]) => `${category} ${count}`).join(" / ") || "未記録"}</p>
              <p>Quota超過: {supply.semanticQuotaOverflowReasons?.length ? supply.semanticQuotaOverflowReasons.join(" / ") : "なし"}</p>
              <p>Fact→semantic: {Object.entries(supply.semanticMappingReasons ?? {}).map(([reason, count]) => `${reason} ${count}`).join(" / ") || "未記録"}</p>
              <p>Media Mix: strong/safe動画供給 {supply.mediaMix?.eligibleStrongVideos ?? "-"} / selected {supply.mediaMix?.selectedVideos ?? "-"} / slot別 {Object.entries(supply.mediaMix?.selectedVideosBySlot ?? {}).map(([slot, count]) => `${slot} ${count}`).join(" / ") || "なし"} / 目標 {supply.mediaMix?.targetVideos ?? "-"} / {supply.mediaMix?.unmetReason ?? "達成"}</p>
              <p>REACH供給: 生成 {supply.reachGenerated ?? "-"}件 / Gate OK {supply.reachGateOk ?? "-"}件</p>
              <p>{supply.shortages?.length ? `不足: ${supply.shortages.join(" / ")}` : "供給不足ログ: 主要レーンにGate OK候補あり"}</p>
              <p>保存済み読込: OK / stale {plan.stale_reason ?? "なし"}</p>
            </div>
            <details className="mt-3 rounded-lg border border-emerald-900 bg-zinc-950 p-3">
              <summary className="cursor-pointer text-xs font-black text-emerald-200">Supply / Native X / Performance 詳細</summary>
              <div className="mt-3 grid gap-3 text-[11px] leading-5 text-zinc-400 md:grid-cols-3">
                <div>
                  <p className="font-black text-zinc-200">role別供給</p>
                  {Object.entries(supply.generatedByRole ?? {}).map(([role, count]) => (
                    <p key={role}>{role}: 生成 {count} / Gate OK {supply.gateOkByRole?.[role] ?? 0} / 不足 {supply.shortagesByRole?.[role] ?? 0}</p>
                  ))}
                  <p>Native X NG: {Object.entries(supply.nativeVoiceNgBySource ?? {}).length ? Object.entries(supply.nativeVoiceNgBySource ?? {}).map(([source, count]) => `${source} ${count}`).join(" / ") : "なし"}</p>
                  <p>Cross-Post Diversity除外推定: {supply.crossPostDiversityRejected ?? 0}</p>
                </div>
                <div>
                  <p className="font-black text-zinc-200">Native X Learning</p>
                  <p>使いすぎ: {native.overusedPatterns?.length ? native.overusedPatterns.join(" / ") : "検出なし"}</p>
                  <p>最近強かったHook: {native.winningPatterns?.length ? native.winningPatterns.join(" / ") : "実績不足"}</p>
                  <p>避ける構文: {native.avoidConstructions?.length ? native.avoidConstructions.join(" / ") : "検出なし"}</p>
                </div>
                <div>
                  <p className="font-black text-zinc-200">Performance</p>
                  {Object.entries(plan.performance_timings ?? {}).map(([label, value]) => <p key={label}>{label}: {value}ms</p>)}
                </div>
              </div>
            </details>
            {slotGroups.length ? (
              <div className="mt-5 space-y-5">
                {slotGroups.map((slot) => <PersistedSlotGroup key={slot.id} label={slot.label} items={slot.items} />)}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {legacyTopPicks.map((item) => <PersistedTopPickCard key={`${item.key}-${item.role}`} item={item} />)}
              </div>
            )}
          </Panel>

          <Panel className="mt-6">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="flex items-center gap-2"><ShieldCheck className="text-emerald-300" size={20} /><span className="text-lg font-black">素材管理 / Media Rights Review</span></span>
                  <span className="mt-1 block text-sm leading-6 text-zinc-400">通常運用では閉じています。必要な時だけ動画素材の権利確認とtrim編集を開きます。</span>
                </span>
                <span className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-200">素材管理を開く</span>
              </summary>
              <div className="mt-4 space-y-3">
              {mediaReview.rows.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-700 px-2 py-1 text-[10px] font-black text-amber-200">{asset.rights_status}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.fetch_status ?? "fetch未確認"}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.source_kind ?? "unknown"}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-black text-zinc-200">{String(asset.works?.title ?? `work ${asset.work_id}`)}</p>
                  <p className="mt-1 break-all text-[11px] leading-5 text-zinc-500">{asset.source_domain} / {asset.source_url}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={sampleMoviePreviewUrl(asset.work_id, asset.id)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-700 px-2 text-[11px] font-black text-cyan-100">動画を開く</a>
                    <a href={`/works/${asset.work_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-2 text-[11px] font-black text-zinc-100">作品</a>
                  </div>
                  <TrimReviewActions
                    assetId={asset.id}
                    sourceUrl={sampleMoviePreviewUrl(asset.work_id, asset.id)}
                    initialTrimStartSeconds={asset.trim_start_seconds}
                    initialTrimNote={asset.trim_note}
                    canModify={asset.can_modify}
                    trimModifyConfirmed={asset.trim_modify_confirmed}
                    trimAllowed={isOfficialFanzaDmmSampleUrl(asset.source_url)}
                  />
                  <RightsReviewActions assetId={asset.id} />
                </div>
              ))}
              {!mediaReview.rows.length && <p className="text-sm text-zinc-500">レビュー対象の動画候補はまだ同期されていません。</p>}
              {mediaReview.error && <p className="text-sm font-bold text-rose-200">{mediaReview.error}</p>}
              </div>
            </details>
          </Panel>

          <DeferredXGrowthSections />
        </div>
      </main>
    );
  }

  const [growth, salesAnalytics, logs, outcomes, creativeLearning, rightsMedia] = await Promise.all([
    getFanzaXAccountGrowth(),
    getAffiliateSalesAnalytics(),
    getRecentXPostLogs(),
    getXPostOutcomes(),
    getXCreativeLearning(30),
    getRightsCheckedMediaCount(),
  ]);
  const os = await buildXGrowthOS({
    growth,
    performance: salesAnalytics.performance,
    logs: logs.logs,
    outcomes: outcomes.outcomes,
    creativeLearning: creativeLearning.rows,
    includeDeferred: false,
  });
  const persistedIds = new Map(os.persistedOpportunities.map((row) => [String(row.opportunity_key), Number(row.id)]));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> 管理画面へ戻る
        </Link>
        <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-emerald-300">HAKKUTSU X GROWTH OS</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">@hakkutsu_lab 司令塔</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              FANZA市場をデータで監視するメディアとして、認知、プロフィール、フォロー、再訪、サイト送客、affiliate clickを分けて運用します。
            </p>
          </div>
          <Link href="/admin/revenue" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-black hover:border-emerald-500">
            <BarChart3 size={16} /> 収益分析へ
          </Link>
        </div>
        <TempFolderStatus />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="ボトルネック" value={os.mission.bottleneck} note={os.mission.reason} />
          <Metric label="30日表示" value={growth.impressions30d.toLocaleString("ja-JP")} note={`平均 ${growth.avgImpressionsPerPost?.toLocaleString("ja-JP") ?? "-"} / 投稿`} />
          <Metric label="プロフィール/フォロー" value={`${growth.profileVisits30d}/${growth.newFollows30d}`} note="取得できる範囲は週次入力から反映" />
          <Metric label="動画供給" value={`mp4 ${os.mediaSupply.mp4Candidates.toLocaleString("ja-JP")} / 使用可 ${os.mediaSupply.allowed.toLocaleString("ja-JP")}`} note={`同期 ${os.mediaSupply.synced.toLocaleString("ja-JP")} / rights待ち ${(os.mediaSupply.unknown + os.mediaSupply.review).toLocaleString("ja-JP")} / URL失効 ${os.mediaSupply.dead.toLocaleString("ja-JP")}`} />
        </div>

        <Panel className="mt-6 border-cyan-800 bg-cyan-950/20">
          <div className="flex items-center gap-2"><Film className="text-cyan-300" size={20} /><h2 className="text-lg font-black">動画供給ステータス</h2></div>
          <p className="mt-2 text-sm leading-6 text-cyan-100/80">
            mp4候補 {os.mediaSupply.mp4Candidates.toLocaleString("ja-JP")} / synced {os.mediaSupply.synced.toLocaleString("ja-JP")} / rights確認待ち {(os.mediaSupply.unknown + os.mediaSupply.review).toLocaleString("ja-JP")} / 使用可 {os.mediaSupply.allowed.toLocaleString("ja-JP")} / blocked {os.mediaSupply.blocked.toLocaleString("ja-JP")} / URL失効 {os.mediaSupply.dead.toLocaleString("ja-JP")}
          </p>
          <p className="mt-1 text-xs leading-5 text-cyan-100/60">FANZA/DMM公式 sample_movie_url は、無加工投稿と冒頭トリムの両方に使用できます。残るのはURL・取得・品質・公開安全性の確認だけです。</p>
          {os.mediaSupply.error && <p className="mt-2 text-xs font-bold text-rose-200">{os.mediaSupply.error}</p>}
          <MediaPipelineActions />
        </Panel>

        <Panel className="mt-6 border-sky-800 bg-sky-950/20">
          <div className="flex items-center gap-2"><ClipboardList className="text-sky-300" size={20} /><h2 className="text-lg font-black">今日の投稿フロー</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["1", "完成文をコピー", "カードの本文だけをそのまま使います。"],
              ["2", "画像をコピー", "コピーできない場合だけ画像を開く/保存します。動画は開く/保存します。"],
              ["3", "Xで貼り付け・投稿", "X投稿画面を開き、画像は貼り付け、動画は手動で添付します。"],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-lg border border-sky-800 bg-zinc-950 p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400 text-sm font-black text-black">{step}</span>
                <p className="mt-3 text-sm font-black text-sky-100">{title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="mt-6 border-amber-800 bg-amber-950/20">
          <h2 className="text-lg font-black text-amber-200">運用前チェック</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill label="Supabase migration" ok={os.systemStatus.migrationApplied} />
            <StatusPill label="X無料アカウント前提" ok={os.systemStatus.accountSubscription === "free"} />
            <StatusPill label="X read-only" ok={os.systemStatus.xReadOnlyConnection.ok} />
            <StatusPill label="X投稿" ok={os.systemStatus.xPostingConfigured} />
            <StatusPill label="Media upload" ok={os.systemStatus.xMediaUploadConfigured} />
            <StatusPill label="Metric取得" ok={os.systemStatus.xMetricsConfigured} />
            <StatusPill label="Ranking History" ok={os.systemStatus.rankingSnapshotsReady} />
            <StatusPill label="Conversation Radar外部検索" ok={false} />
          </div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-amber-100/80 md:grid-cols-2">
            {!os.systemStatus.migrationApplied && <p>Migration未適用の可能性があります: {os.systemStatus.migrationError}</p>}
            <p>X Premiumは前提にしていません。必要なのはX Developer/API側の利用権限と、@hakkutsu_lab のUser Access Tokenです。</p>
            <p>Bearer token: {os.systemStatus.xBearerConfigured ? "設定あり" : "未設定"} / User Access Token: {os.systemStatus.xUserAccessTokenConfigured ? "設定あり" : "未設定"}</p>
            {os.systemStatus.xReadOnlyConnection.checked && <p>read-only疎通: {os.systemStatus.xReadOnlyConnection.ok ? `@${os.systemStatus.xReadOnlyConnection.username}` : os.systemStatus.xReadOnlyConnection.error}</p>}
            {os.systemStatus.rankingSnapshotsError && <p>ランキング履歴: {os.systemStatus.rankingSnapshotsError}</p>}
            {!os.systemStatus.xPostingConfigured && <p>自動投稿と自動添付は User Access Token が必要です。手動動画投稿は、完成文コピー、mp4一時保存、X投稿画面起動で運用できます。</p>}
            {rightsMedia.error && <p>x_media_assetsを読めません。権利未確認mp4はAPIでも拒否されます。</p>}
          </div>
          <div className="mt-3 text-xs leading-5 text-amber-100/70">
            {os.systemStatus.requiredForPosting.map((item) => <p key={item}>{item}</p>)}
          </div>
        </Panel>

        <Panel className="mt-6 border-emerald-800 bg-emerald-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><Target className="text-emerald-300" size={20} /><h2 className="text-xl font-black">Today Mission</h2></div>
              <p className="mt-2 text-2xl font-black">{os.mission.title}</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/80">{os.mission.reason}</p>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {(Object.entries(os.mission.mix) as Array<[XGrowthIntent, number]>).map(([intent, count]) => (
                <div key={intent} className={`rounded-lg border p-3 ${intentStyle[intent]}`}>
                  <p className="text-[10px] font-black">{intent}</p>
                  <p className="mt-1 text-2xl font-black">{count}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {os.mission.actions.map((action) => (
              <div key={`${action.intent}-${action.label}`} className="rounded-lg border border-emerald-800/70 bg-zinc-950 p-4">
                <p className="text-xs font-black text-emerald-300">{action.intent}</p>
                <p className="mt-1 font-black">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{action.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="mt-6 border-emerald-700 bg-emerald-950/10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><Sparkles className="text-emerald-300" size={20} /><h2 className="text-2xl font-black">今日の投稿</h2></div>
              <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                3投稿枠 × 各A/B/Cの最大9候補。弱い投稿や同じ作品の水増しはせず、Hard Gate通過候補だけを残します。
              </p>
              <RegenerateTopPicksAction />
            </div>
            <div className="rounded-lg border border-emerald-800 bg-zinc-950 px-4 py-3 text-sm font-black text-emerald-200">
              {os.dailyTopPicks.length ? `${os.supplyDiagnostics.target} / Gate OK ${os.dailyTopPicks.length}件` : "本日0件 / 今日は投稿しない"}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-100/70 md:grid-cols-2">
            <p>供給方針: Slot1 REACH / Slot2 FOLLOW・AUTHORITY / Slot3 MONEY・REACH。各slotは別work・別素材を優先します。</p>
            <p className={os.supplyDiagnostics.eligibleByIntent.MONEY > 0 ? "text-emerald-200" : "text-amber-200"}>
              {os.supplyDiagnostics.eligibleByIntent.MONEY > 0
                ? `本日の収益候補: ${os.supplyDiagnostics.eligibleByIntent.MONEY}件 / Slot3にMONEYを最低1件配置`
                : "本日の収益候補: 0件 / 本日はリンク投稿なし"}
            </p>
            <p>MONEY診断: generated {os.supplyDiagnostics.moneyGenerated} / Hard Gate passed {os.supplyDiagnostics.moneyHardGatePassed} / allocation eligible {os.supplyDiagnostics.moneyAllocationEligible} / Slot3 placed {os.supplyDiagnostics.moneyPlaced} / 主な落ち理由: {moneyGateReasonLabel[os.supplyDiagnostics.moneyTopFailureReason ?? ""] ?? "なし"}</p>
            <p>Semantic: supply {Object.entries(os.supplyDiagnostics.semanticSupply).map(([category, count]) => `${category} ${count}`).join(" / ")} / selected {Object.entries(os.supplyDiagnostics.semanticSelected).filter(([, count]) => count > 0).map(([category, count]) => `${category} ${count}`).join(" / ") || "なし"}</p>
                <p>Media Mix: video candidates {os.supplyDiagnostics.mediaMix.totalVideoCandidates} / strong・safe {os.supplyDiagnostics.mediaMix.eligibleStrongVideos} / official eligible {os.supplyDiagnostics.mediaMix.eligibleOfficialVideos} / fallback selected {os.supplyDiagnostics.mediaMix.fallbackOfficialSelected} / selected {os.supplyDiagnostics.mediaMix.selectedVideos} / slot別 {Object.entries(os.supplyDiagnostics.mediaMix.selectedVideosBySlot).map(([slot, count]) => `${slot} ${count}`).join(" / ") || "なし"} / 目標 {os.supplyDiagnostics.mediaMix.targetVideos} / {os.supplyDiagnostics.mediaMix.unmetReason ?? "達成"}</p>
                <p>供給段階: raw {os.supplyDiagnostics.pipeline.rawCandidates} → posted後 {os.supplyDiagnostics.pipeline.afterPosted} → stale後 {os.supplyDiagnostics.pipeline.afterStale} → real-media {os.supplyDiagnostics.pipeline.realMediaEligible}（video {os.supplyDiagnostics.pipeline.videoEligible} / image {os.supplyDiagnostics.pipeline.imageEligible}）→ hard {os.supplyDiagnostics.pipeline.hardGatePassed} / soft eligible {os.supplyDiagnostics.pipeline.softQualityEligible} → selected {os.supplyDiagnostics.pipeline.finalSelected}</p>
            <p>Video rejection: {Object.entries(os.supplyDiagnostics.mediaMix.rejectionReasons).map(([reason, count]) => `${reason} ${count}`).join(" / ") || "なし"} / Unique Audit: work {os.supplyDiagnostics.mediaMix.uniqueAudit.workDuplicateCount} / media {os.supplyDiagnostics.mediaMix.uniqueAudit.mediaDuplicateCount} / url {os.supplyDiagnostics.mediaMix.uniqueAudit.urlDuplicateCount} / posted {os.supplyDiagnostics.mediaMix.uniqueAudit.postedOverlap}</p>
            <p>Quota超過: {os.supplyDiagnostics.semanticQuotaOverflowReasons.length ? os.supplyDiagnostics.semanticQuotaOverflowReasons.join(" / ") : "なし"}</p>
            <p>Fact→semantic: {Object.entries(os.supplyDiagnostics.semanticMappingReasons ?? {}).map(([reason, count]) => `${reason} ${count}`).join(" / ") || "未記録"}</p>
            <p>再生成絞り込み: source pool {os.supplyDiagnostics.sourcePoolAfterPosted} → prefilter {os.supplyDiagnostics.prefilterCount} → Human Voice {os.supplyDiagnostics.humanVoiceTargetCount} → diversity {os.supplyDiagnostics.diversityTargetCount}</p>
            <p>Decision Facts段階: {Object.entries(os.supplyDiagnostics.decisionPipeline.byType).map(([type, stage]) => `${type} fetched ${stage.dbFetchedWorks} → raw ${stage.dbRawWorks} → cooldown ${stage.postedCooldown} → chart/evidence ${stage.chartEligible} → work ${stage.uniqueWorks} → variants ${stage.creativeVariants} → quality ${stage.qualityEligible} → selected ${stage.selected} / drop ${Object.entries(stage.firstDropReasonCounts ?? {}).map(([reason, count]) => `${reason} ${count}`).join(", ") || "なし"}`).join(" / ")}</p>
            <p>REACH供給: 生成 {os.supplyDiagnostics.reachGenerated}件 / Gate OK {os.supplyDiagnostics.reachGateOk}件</p>
            <p>source pool {os.supplyDiagnostics.sourcePoolTotal}件 → posted除外後の別work {os.supplyDiagnostics.sourcePoolAfterPosted}件（除外 {os.supplyDiagnostics.postedExcluded}件） / URL・素材あり {os.supplyDiagnostics.urlOrMediaAvailable}件 / Hard Gate通過 {os.supplyDiagnostics.hardGatePassed}件 / posted overlap {os.supplyDiagnostics.postedOverlap}件</p>
            <p>slot allocation: {Object.entries(os.supplyDiagnostics.slotAllocation).map(([slot, count]) => `${slot} ${count}`).join(" / ") || "なし"}</p>
            <p>{os.supplyDiagnostics.shortages.length ? `不足: ${os.supplyDiagnostics.shortages.join(" / ")}` : "供給不足ログ: 主要レーンにGate OK候補あり"}</p>
            <p>Human Voice NG: {Object.entries(os.supplyDiagnostics.humanVoiceNgBySource).length ? Object.entries(os.supplyDiagnostics.humanVoiceNgBySource).map(([source, count]) => `${source} ${count}件`).join(" / ") : "なし"}</p>
          </div>
          <details className="mt-3 rounded-lg border border-emerald-900 bg-zinc-950 p-3">
            <summary className="cursor-pointer text-xs font-black text-emerald-200">Supply / Native X / Performance 詳細</summary>
            <div className="mt-3 grid gap-3 text-[11px] leading-5 text-zinc-400 md:grid-cols-3">
              <div>
                <p className="font-black text-zinc-200">role別供給</p>
                {(Object.entries(os.supplyDiagnostics.generatedByRole) as Array<[XGrowthIntent, number]>).map(([role, count]) => (
                  <p key={role}>{role}: 生成 {count} / Gate OK {os.supplyDiagnostics.gateOkByRole[role] ?? 0} / 不足 {os.supplyDiagnostics.shortagesByRole[role] ?? 0}</p>
                ))}
                <p>Native X NG: {Object.entries(os.supplyDiagnostics.nativeVoiceNgBySource).length ? Object.entries(os.supplyDiagnostics.nativeVoiceNgBySource).map(([source, count]) => `${source} ${count}`).join(" / ") : "なし"}</p>
                <p>Cross-Post Diversity除外推定: {os.supplyDiagnostics.crossPostDiversityRejected}</p>
                <p>media: {Object.entries(os.supplyDiagnostics.mediaTypeCounts).map(([type, count]) => `${type} ${count}`).join(" / ") || "なし"}</p>
                <p>source: {Object.entries(os.supplyDiagnostics.sourceTypeCounts).map(([type, count]) => `${type} ${count}`).join(" / ") || "なし"}</p>
                <p>angle: {Object.entries(os.supplyDiagnostics.creativeAngleCounts).map(([type, count]) => `${type} ${count}`).join(" / ") || "なし"}</p>
              </div>
              <div>
                <p className="font-black text-zinc-200">Native X Learning</p>
                <p>使いすぎ: {os.nativeXLearning.overusedPatterns.length ? os.nativeXLearning.overusedPatterns.join(" / ") : "検出なし"}</p>
                <p>最近強かったHook: {os.nativeXLearning.winningPatterns.length ? os.nativeXLearning.winningPatterns.join(" / ") : "実績不足"}</p>
                <p>避ける構文: {os.nativeXLearning.avoidConstructions.length ? os.nativeXLearning.avoidConstructions.join(" / ") : "検出なし"}</p>
              </div>
              <div>
                <p className="font-black text-zinc-200">Performance</p>
                {Object.entries(os.performanceTimings).map(([label, value]) => <p key={label}>{label}: {value}ms</p>)}
              </div>
            </div>
          </details>
          {os.dailyTopPicks.length ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {os.dailyTopPicks.map((item) => <TopPickCard key={`${item.key}-${item.role}`} item={item} />)}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-800 bg-amber-950/20 p-4">
              <div className="flex items-center gap-2 text-amber-200"><AlertTriangle size={18} /><p className="font-black">今日は投稿しない</p></div>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">{os.dailyNoPostReason ?? "基準を満たす候補がありません。"}</p>
            </div>
          )}
        </Panel>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Panel>
            <details>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-2"><Sparkles className="text-sky-300" size={20} /><h2 className="inline text-xl font-black">その他候補</h2></div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">通常は上の「今日の投稿」だけ見れば十分です。比較したい時だけ開きます。</p>
              </summary>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {os.opportunities.slice(0, 8).map((item) => <OpportunityCard key={item.key} item={item} persistedId={persistedIds.get(item.key) ?? null} />)}
                {!os.opportunities.length && <p className="text-sm text-zinc-500">今日の実データ候補はまだありません。</p>}
              </div>
            </details>
          </Panel>

          <div className="space-y-6">
            <Panel>
              <div className="flex items-center gap-2"><Film className="text-amber-300" size={20} /><h2 className="text-lg font-black">Media Intelligence</h2></div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                <p><ShieldCheck className="mr-1 inline text-emerald-300" size={15} />既存リンク画像はMONEYレーンで継続使用。</p>
                <p>REACH/FOLLOW/AUTHORITYは、公式サンプル動画、作品画像、データカード、テキストのみを投稿意図ごとに選びます。ジャケ写固定にはしません。</p>
                <p>FANZA/DMM公式 sample_movie_url は、保存した開始位置からの冒頭トリムにも使用できます。外部動画の権限制限は別途維持します。</p>
                <p>画像はコピー優先。動画はFANZA/DMM公式mp4だけ開く/保存して手動添付します。</p>
              </div>
            </Panel>

            <Panel>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="flex items-center gap-2"><ShieldCheck className="text-emerald-300" size={20} /><span className="text-lg font-black">素材管理 / Media Rights Review</span></span>
                    <span className="mt-1 block text-sm leading-6 text-zinc-400">通常運用では閉じています。必要な時だけ動画素材の権利確認とtrim編集を開きます。</span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-200">素材管理を開く</span>
                </summary>
                <div className="mt-4 space-y-3">
                {os.rightsReviewQueue.map((asset) => (
                  <div key={asset.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-700 px-2 py-1 text-[10px] font-black text-amber-200">{asset.rights_status}</span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.fetch_status ?? "fetch未確認"}</span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-400">{asset.source_kind ?? "unknown"}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-black text-zinc-200">{String(asset.works?.title ?? `work ${asset.work_id}`)}</p>
                    <p className="mt-1 break-all text-[11px] leading-5 text-zinc-500">{asset.source_domain} / {asset.source_url}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={sampleMoviePreviewUrl(asset.work_id, asset.id)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-700 px-2 text-[11px] font-black text-cyan-100">動画を開く</a>
                      <a href={`/works/${asset.work_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-2 text-[11px] font-black text-zinc-100">作品</a>
                    </div>
                    <TrimReviewActions
                      assetId={asset.id}
                      sourceUrl={sampleMoviePreviewUrl(asset.work_id, asset.id)}
                      initialTrimStartSeconds={asset.trim_start_seconds}
                      initialTrimNote={asset.trim_note}
                      canModify={asset.can_modify}
                      trimModifyConfirmed={asset.trim_modify_confirmed}
                      trimAllowed={isOfficialFanzaDmmSampleUrl(asset.source_url)}
                    />
                    <RightsReviewActions assetId={asset.id} />
                  </div>
                ))}
                {!os.rightsReviewQueue.length && <p className="text-sm text-zinc-500">rights確認待ちの動画候補はまだ同期されていません。</p>}
                </div>
              </details>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2"><MessageCircle className="text-amber-300" size={20} /><h2 className="text-lg font-black">Conversation Radar</h2></div>
              <div className="mt-4 space-y-3">
                {os.conversationRadar.map((item) => (
                  <div key={item.key} className="rounded-lg bg-zinc-950 p-3">
                    <p className="text-xs font-black text-zinc-200">{item.target}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">検索: {item.query}</p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-200">{item.suggestedAction}</p>
                  </div>
                ))}
                {!os.conversationRadar.length && <p className="text-sm text-zinc-500">内部データから会話候補を作れませんでした。外部X検索は unavailable として扱います。</p>}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2"><TrendingUp className="text-cyan-300" size={20} /><h2 className="text-lg font-black">継続企画</h2></div>
              <div className="mt-4 space-y-3">
                {os.seriesIdeas.map((item) => (
                  <div key={item.key} className="rounded-lg bg-zinc-950 p-3">
                    <p className="text-xs font-black text-zinc-200">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-500">{item.detail}</p>
                  </div>
                ))}
                {!os.seriesIdeas.length && <p className="text-sm text-zinc-500">継続企画に使える異常値はまだありません。</p>}
              </div>
            </Panel>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <div className="flex items-center gap-2"><ClipboardList className="text-violet-300" size={20} /><h2 className="text-lg font-black">Learning Lab</h2></div>
            <div className="mt-4 space-y-3">
              {os.learning.map((item) => (
                <div key={item.key} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <p className={`text-xs font-black ${item.strength === "strong" ? "text-emerald-300" : item.strength === "weak" ? "text-rose-300" : "text-zinc-300"}`}>{item.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">{item.finding}</p>
                </div>
              ))}
              {!os.learning.length && <p className="text-sm text-zinc-500">まだ学習に足る投稿ログがありません。</p>}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2"><CheckCircle2 className="text-emerald-300" size={20} /><h2 className="text-lg font-black">移行整理</h2></div>
            <div className="mt-4 grid gap-3 text-xs leading-5 text-zinc-500 sm:grid-cols-3">
              <div><p className="font-black text-emerald-300">再利用</p>{os.audit.reuse.map((item) => <p key={item} className="mt-2">{item}</p>)}</div>
              <div><p className="font-black text-amber-300">置換</p>{os.audit.replace.map((item) => <p key={item} className="mt-2">{item}</p>)}</div>
              <div><p className="font-black text-rose-300">廃止</p>{os.audit.retire.map((item) => <p key={item} className="mt-2">{item}</p>)}</div>
            </div>
            <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-500">
              1h/6h/24h/72h の Metric Snapshots は取得できる数値だけ自動連携し、bookmarks/profile_visits/follows などAPI権限がない値は手入力前提です。
            </p>
            <MetricSyncActions />
          </Panel>
        </div>
      </div>
    </main>
  );
}

export default function XGrowthPage() {
  return (
    <Suspense fallback={<TopPicksSkeleton />}>
      <XGrowthPageContent />
    </Suspense>
  );
}
