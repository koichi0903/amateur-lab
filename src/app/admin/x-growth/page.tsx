import Link from "next/link";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Copy, ExternalLink, Film, MessageCircle, ShieldCheck, Sparkles, Target, TrendingUp, XCircle } from "lucide-react";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { getFanzaXAccountGrowth } from "@/lib/fanzaXAccountGrowth";
import { buildXGrowthOS, getRightsCheckedMediaCount, type XDailyTopPick, type XGrowthIntent, type XGrowthOpportunity } from "@/lib/xGrowthOS";
import { getPersistedTodayTopPicks, type PersistedXDailyPlan } from "@/lib/xGrowthOperations";
import { getXCreativeLearning, getXPostOutcomes, getRecentXPostLogs } from "@/lib/xPostLogs";
import { ManualPostActions, MediaPipelineActions, MetricSyncActions, OpportunityActions, RegenerateTopPicksAction, RightsReviewActions, TempFolderStatus, TrimReviewActions } from "./XGrowthActions";
import { getRightsReviewQueue } from "@/lib/xMediaAssets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const intentStyle: Record<XGrowthIntent, string> = {
  REACH: "border-sky-700 bg-sky-950/40 text-sky-200",
  AUTHORITY: "border-cyan-700 bg-cyan-950/40 text-cyan-200",
  FOLLOW: "border-violet-700 bg-violet-950/40 text-violet-200",
  CONVERSATION: "border-amber-700 bg-amber-950/40 text-amber-200",
  MONEY: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
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

function editorialVerdict(item: XGrowthOpportunity) {
  const variant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
  const verdict = variant?.quality.lastMile.verdict ?? "do_not_post";
  if (verdict === "post_ok") return { label: "投稿OK", className: "border-emerald-700 bg-emerald-950/40 text-emerald-200" };
  if (verdict === "revise") return { label: "要改善", className: "border-amber-700 bg-amber-950/40 text-amber-200" };
  return { label: "投稿しない", className: "border-rose-700 bg-rose-950/40 text-rose-200" };
}

function TopPickCard({ item }: { item: XDailyTopPick }) {
  const mediaOk = item.mediaUsage === "allowed";
  const hasImagePreview = mediaOk && (item.mediaType === "data_card" || Boolean(item.recommendedMediaUrl && item.mediaType === "existing_link_image"));
  const hasVideoPreview = mediaOk && item.recommendedMediaUrl && item.mediaType === "sample_movie" && item.canNativeVideo;
  const previewUrl = item.mediaType === "data_card"
    ? `/api/admin/x-growth/media/download?workId=${encodeURIComponent(String(item.workId))}&mediaType=data_card`
    : item.recommendedMediaUrl ?? "";
  const linkStrategy = item.intent === "MONEY" ? "作品リンクあり" : "リンクなし戦略: 認知/フォロー優先";
  const verdict = editorialVerdict(item);
  const selectedVariant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
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
          <p className={`rounded-lg border px-3 py-2 ${item.intent === "MONEY" ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-sky-800 bg-sky-950/30 text-sky-200"}`}>リンク戦略: {linkStrategy}</p>
          {hookReason && <p className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-cyan-100">動画Hook根拠: {hookReason}</p>}
          {item.mediaType === "sample_movie" && trimStartSeconds > 0 && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100">冒頭トリム: {trimStartSeconds.toFixed(1)}秒</p>}
        </div>
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
          <p className="text-[11px] font-black text-emerald-300">伸びる可能性</p>
          <p className="mt-1 text-sm leading-6 text-emerald-50">{item.whyBuzz}</p>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-black text-zinc-300">この完成文を投稿</h3>
      <textarea suppressHydrationWarning readOnly value={item.postText} className="mt-2 h-44 w-full resize-none rounded-lg border border-emerald-800 bg-black p-3 text-sm leading-6 text-zinc-100 outline-none" />
      {item.replyText && <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-5 text-zinc-400">必要な時だけ補足リプ: {item.replyText}</p>}

      {(hasImagePreview || hasVideoPreview) && (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          {hasImagePreview && (
            <div className="relative h-48 w-full bg-black">
              <Image src={previewUrl} alt={item.title} fill sizes="(max-width: 1280px) 90vw, 390px" unoptimized className="object-contain" />
            </div>
          )}
          {hasVideoPreview && <video src={item.recommendedMediaUrl ?? ""} controls preload="metadata" className="h-48 w-full bg-black" />}
        </div>
      )}

      <ManualPostActions
        postText={item.postText}
        mediaUrl={item.recommendedMediaUrl}
        mediaType={item.mediaType}
        quoteUrl={item.mediaType === "quote" ? item.recommendedMediaUrl : null}
        workId={item.workId}
        mediaAssetId={item.mediaAsset?.id ?? null}
        intent={item.intent}
        pickOrder={item.pickOrder}
        trimStartSeconds={trimStartSeconds}
        canModify={item.mediaAsset?.can_modify === true || item.mediaAsset?.trim_modify_confirmed === true}
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
  const trimStartSeconds = Number(item.mediaAsset?.trim_start_seconds ?? 0);
  return (
    <article className="rounded-lg border border-emerald-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-lg font-black text-black">{item.pickOrder}</span>
        <div>
          <p className="text-[11px] font-black text-zinc-500">投稿順 / 推奨時刻</p>
          <p className="text-sm font-black text-white">{item.pickOrder}件目・{item.recommendedTimeLabel}</p>
        </div>
        <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-black ${intentStyle[item.role]}`}>{item.role}</span>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-black text-zinc-300">{item.sourceType}</span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${verdictClass}`}>{verdict === "post_ok" ? "投稿OK" : verdict === "revise" ? "要改善" : "投稿しない"}</span>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] font-black sm:grid-cols-2">
        <p className={`rounded-lg border px-3 py-2 ${mediaOk ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-rose-800 bg-rose-950/30 text-rose-200"}`}>使用素材: {mediaName({ mediaType: item.mediaType })} / {mediaOk ? "使用可" : "不可"}</p>
        <p className={`rounded-lg border px-3 py-2 ${item.role === "MONEY" ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-sky-800 bg-sky-950/30 text-sky-200"}`}>リンク戦略: {item.role === "MONEY" ? "作品リンクあり" : "リンクなし戦略: 認知/フォロー優先"}</p>
        {hookReason && <p className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-cyan-100">動画Hook根拠: {hookReason}</p>}
        {item.mediaType === "sample_movie" && trimStartSeconds > 0 && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100">冒頭トリム: {trimStartSeconds.toFixed(1)}秒</p>}
      </div>
      <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
        <p className="text-[11px] font-black text-emerald-300">伸びる可能性</p>
        <p className="mt-1 text-sm leading-6 text-emerald-50">{item.whyBuzz}</p>
      </div>
      <h3 className="mt-4 text-sm font-black text-zinc-300">この完成文を投稿</h3>
      <textarea suppressHydrationWarning readOnly value={item.postText} className="mt-2 h-44 w-full resize-none rounded-lg border border-emerald-800 bg-black p-3 text-sm leading-6 text-zinc-100 outline-none" />
      {item.replyText && <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-5 text-zinc-400">必要な時だけ補足リプ: {item.replyText}</p>}
      {item.mediaType === "sample_movie" && item.recommendedMediaUrl && item.canNativeVideo && (
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <video src={item.recommendedMediaUrl} controls preload="metadata" className="h-48 w-full bg-black" />
        </div>
      )}
      <ManualPostActions
        postText={item.postText}
        mediaUrl={item.recommendedMediaUrl}
        mediaType={item.mediaType}
        quoteUrl={item.mediaType === "quote" ? item.recommendedMediaUrl : null}
        workId={item.workId}
        mediaAssetId={item.mediaAsset?.id ?? null}
        intent={item.role}
        pickOrder={item.pickOrder}
        trimStartSeconds={trimStartSeconds}
        canModify={item.mediaAsset?.can_modify === true || item.mediaAsset?.trim_modify_confirmed === true}
      />
      <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <summary className="cursor-pointer text-xs font-black text-zinc-300">詳細</summary>
        <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
          <p>作品: <span className="font-bold text-zinc-300">{item.title}</span></p>
          <p>素材判定: {item.mediaDecision}</p>
          <p>Creative angle: {item.creativeAngle} / evidence {item.sourceEvidence.join(" / ")}</p>
          <p>当日セット重複チェック: {item.setDiversity.status} / {item.setDiversity.reasons.length ? item.setDiversity.reasons.join(" / ") : "opening/judgment/構造の同日重複なし"}</p>
          <p>Native X Voice: {item.selectedVariant?.quality.lastMile.nativeXVoice.passed ? "OK" : "NG"} / {item.selectedVariant?.quality.lastMile.nativeXVoice.reasons.length ? item.selectedVariant.quality.lastMile.nativeXVoice.reasons.join(" / ") : "Xに自然な短文としてOK"}</p>
          <p>Buzz Potential {item.selectedVariant?.buzzPotential.total ?? "-"} / Scroll Stop {item.selectedVariant?.buzzPotential.scrollStop ?? "-"} / Media Fit {item.selectedVariant?.buzzPotential.mediaFit ?? "-"}</p>
          {item.alternativeReason && <p>{item.alternativeReason}</p>}
        </div>
      </details>
    </article>
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
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
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
      nativeVoiceNgBySource?: Record<string, number>;
      crossPostDiversityRejected?: number;
    };
    const native = plan.native_x_learning as { overusedPatterns?: string[]; winningPatterns?: string[]; avoidConstructions?: string[] };
    const mediaReview = await getRightsReviewQueue(12);
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
                {supply.target ?? `${plan.top_picks.length}件`} / Gate OK {plan.top_picks.length}件
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-100/70 md:grid-cols-2">
              <p>供給方針: REACH 1件 / AUTHORITY or FOLLOW 1件 / MONEY 0〜1件。</p>
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
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {plan.top_picks.map((item) => <PersistedTopPickCard key={`${item.key}-${item.role}`} item={item} />)}
            </div>
          </Panel>

          <Panel className="mt-6">
            <div className="flex items-center gap-2"><ClipboardList className="text-violet-300" size={20} /><h2 className="text-lg font-black">後読み詳細</h2></div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Rights Review、Conversation Radar、Learning Lab、Opportunity一覧は初期表示では待ちません。必要な時だけ「今日のTop Picksを再生成」または各操作パネルから更新します。
            </p>
          </Panel>

          <Panel className="mt-6">
            <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-300" size={20} /><h2 className="text-lg font-black">Media Rights Review</h2></div>
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
                    <a href={asset.source_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-700 px-2 text-[11px] font-black text-cyan-100">動画を開く</a>
                    <a href={`/works/${asset.work_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-2 text-[11px] font-black text-zinc-100">作品</a>
                  </div>
                  <TrimReviewActions
                    assetId={asset.id}
                    sourceUrl={asset.source_url}
                    initialTrimStartSeconds={asset.trim_start_seconds}
                    initialTrimNote={asset.trim_note}
                    canModify={asset.can_modify}
                    trimModifyConfirmed={asset.trim_modify_confirmed}
                  />
                  <RightsReviewActions assetId={asset.id} />
                </div>
              ))}
              {!mediaReview.rows.length && <p className="text-sm text-zinc-500">レビュー対象の動画候補はまだ同期されていません。</p>}
              {mediaReview.error && <p className="text-sm font-bold text-rose-200">{mediaReview.error}</p>}
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  const [growth, salesAnalytics, logs, outcomes, creativeLearning, rightsMedia, mediaReview] = await Promise.all([
    getFanzaXAccountGrowth(),
    getAffiliateSalesAnalytics(),
    getRecentXPostLogs(),
    getXPostOutcomes(),
    getXCreativeLearning(30),
    getRightsCheckedMediaCount(),
    getRightsReviewQueue(12),
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
          <p className="mt-1 text-xs leading-5 text-cyan-100/60">sample_movie_url は候補です。根拠つきでallowedにした素材だけ、Top Picksと手動動画投稿に出します。</p>
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
                基本は最低2件、通常3件。弱い投稿で埋めず、Gate OKの供給元だけで本数を決めます。
              </p>
              <RegenerateTopPicksAction />
            </div>
            <div className="rounded-lg border border-emerald-800 bg-zinc-950 px-4 py-3 text-sm font-black text-emerald-200">
              {os.dailyTopPicks.length ? `${os.supplyDiagnostics.target} / Gate OK ${os.dailyTopPicks.length}件` : "本日0件 / 今日は投稿しない"}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-100/70 md:grid-cols-2">
            <p>供給方針: REACH 1件 / AUTHORITY or FOLLOW 1件 / MONEY 0〜1件。MONEYが弱い日は認知・信頼系で補完。</p>
            <p>REACH供給: 生成 {os.supplyDiagnostics.reachGenerated}件 / Gate OK {os.supplyDiagnostics.reachGateOk}件</p>
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
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
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
                <p>REACH/FOLLOW/AUTHORITYは、権利OK動画、作品画像、データカード、テキストのみを投稿意図ごとに選びます。ジャケ写固定にはしません。</p>
                <p>sample_movie_url は技術可否と利用許諾を分離。権利未確認は投稿不可。</p>
                <p>画像はコピー優先。動画は許可済みmp4だけ開く/保存して手動添付します。</p>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-300" size={20} /><h2 className="text-lg font-black">Media Rights Review</h2></div>
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
                      <a href={asset.source_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-700 px-2 text-[11px] font-black text-cyan-100">動画を開く</a>
                      <a href={`/works/${asset.work_id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-2 text-[11px] font-black text-zinc-100">作品</a>
                    </div>
                    <TrimReviewActions
                      assetId={asset.id}
                      sourceUrl={asset.source_url}
                      initialTrimStartSeconds={asset.trim_start_seconds}
                      initialTrimNote={asset.trim_note}
                      canModify={asset.can_modify}
                      trimModifyConfirmed={asset.trim_modify_confirmed}
                    />
                    <RightsReviewActions assetId={asset.id} />
                  </div>
                ))}
                {!mediaReview.rows.length && <p className="text-sm text-zinc-500">レビュー対象の動画候補はまだ同期されていません。</p>}
                {mediaReview.error && <p className="text-sm font-bold text-rose-200">{mediaReview.error}</p>}
              </div>
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
