import type { XDailyTopPick, XGrowthIntent, XGrowthOpportunity } from "../xGrowthOS";
import type { XCreativeVariant } from "../xCreativeEngine";
import type { XPostLog } from "../xPostLogs";
import { endingPhrase, judgmentPhrase, judgmentShape, numberPlacement, openingPattern, reactionType, sentenceStructure, subjectStructure, textSimilarity } from "./xGrowthCopyShape";
import { officialSampleVideoAllowed } from "./xGrowthEligibility";
import { assignSemanticHook } from "../xGrowthSemantic";
import { DAY_MS } from "./xGrowthTime";
import { primaryUsableVisualFact } from "../xVisualVideoFacts";

const SAME_DAY_LIMITED_PHRASES = [
  "タイトルだけなら流してました",
  "タイトルだけなら普通に流してました",
  "サンプルまで見ると、印象が変わるタイプ",
  "見落とすには惜しい",
  "確認していい",
  "サンプルまで見る",
  "今日見ていい",
];

function diversitySignature(item: XGrowthOpportunity, role: XGrowthIntent, variant: XCreativeVariant) {
  const semantic = assignSemanticHook(item, variant);
  const primaryFact = semantic.fact ?? primaryUsableVisualFact(item.visualFacts);
  return {
    openingPattern: openingPattern(variant.bodyText),
    sentenceStructure: sentenceStructure(variant.bodyText),
    judgmentPhrase: judgmentPhrase(variant.bodyText),
    subjectStructure: subjectStructure(item, variant.bodyText),
    intent: role,
    sourceType: item.sourceType,
    hookType: variant.hookType,
    emotionalAngle: variant.hookDirection,
    mediaType: variant.mediaType === "sample_movie" && !officialSampleVideoAllowed(item) ? item.imageUrl ? "data_card" as const : "text" as const : variant.mediaType,
    ctaStrategy: variant.ctaStrategy,
    linkStrategy: variant.linkPlan,
    endingPhrase: endingPhrase(variant.bodyText),
    numberPlacement: numberPlacement(variant.bodyText),
    semanticHookCategory: semantic.category,
    reactionType: reactionType(variant),
    judgmentShape: judgmentShape(variant.bodyText, variant.hookDirection),
    primaryFactKind: primaryFact?.kind ?? "none",
    abstractFallback: !primaryFact && /雰囲気|空気|印象|入り方/.test(variant.bodyText),
    semanticMappingReason: semantic.reason,
  };
}

export function diversityConflicts(
  item: XGrowthOpportunity,
  role: XGrowthIntent,
  variant: XCreativeVariant,
  picked: XDailyTopPick[],
  logs: XPostLog[],
) {
  const signature = diversitySignature(item, role, variant);
  const reasons: string[] = [];
  appendSourcePolicyConflicts(item, signature, reasons);
  appendSameDayPhraseConflicts(variant, picked, reasons);
  appendPickedConflicts(signature, variant, picked, reasons);
  const recentPhraseReuse = countRecentPhraseReuse(signature, logs);
  if (recentPhraseReuse >= 2) reasons.push(`直近7日Novelty減点: opening/judgment同型 ${recentPhraseReuse}件`);
  return { ok: reasons.length === 0, signature, reasons };
}

function appendSourcePolicyConflicts(
  item: XGrowthOpportunity,
  signature: ReturnType<typeof diversitySignature>,
  reasons: string[],
) {
  if (item.sourceType === "PRICE_EVENT" && signature.openingPattern === "title_missed") {
    reasons.push("PRICE_EVENTは作品紹介テンプレではなく価格判断のHookを使う");
  }
  if ((item.sourceType === "MARKET" || item.sourceType === "COMPARISON" || item.sourceType === "JUDGMENT") && signature.openingPattern === "title_missed") {
    reasons.push(`${item.sourceType}は作品単体紹介テンプレではなく外向きHookを使う`);
  }
  if (item.sourceType === "ACTRESS_TREND" && signature.openingPattern === "title_missed") {
    reasons.push("ACTRESS_TRENDは作品紹介テンプレではなく女優の見方のHookを使う");
  }
}

function appendSameDayPhraseConflicts(variant: XCreativeVariant, picked: XDailyTopPick[], reasons: string[]) {
  for (const phrase of SAME_DAY_LIMITED_PHRASES) {
    if (variant.bodyText.includes(phrase) && picked.some((pick) => pick.postText.includes(phrase))) {
      reasons.push(`同日judgment phrase重複: ${phrase}`);
    }
  }
}

function appendPickedConflicts(
  signature: ReturnType<typeof diversitySignature>,
  variant: XCreativeVariant,
  picked: XDailyTopPick[],
  reasons: string[],
) {
  for (const pick of picked) {
    const other = pick.setDiversity.signature;
    appendSetLimitConflicts(signature, picked, reasons);
    appendCandidatePairConflicts(signature, variant, pick, other, reasons);
  }
}

function appendSetLimitConflicts(
  signature: ReturnType<typeof diversitySignature>,
  picked: XDailyTopPick[],
  reasons: string[],
) {
  if (picked.filter((entry) => entry.setDiversity.signature.semanticHookCategory === signature.semanticHookCategory).length >= 2) {
    reasons.push(`semantic_hook_category上限: ${signature.semanticHookCategory}`);
  }
  if (signature.semanticHookCategory === "generic_reaction" && picked.some((entry) => entry.setDiversity.signature.semanticHookCategory === "generic_reaction")) {
    reasons.push("generic_reactionは1件まで");
  }
  if (signature.abstractFallback && picked.some((entry) => entry.setDiversity.signature.abstractFallback)) {
    reasons.push("abstract fallbackは1件まで");
  }
  if (picked.filter((entry) => entry.setDiversity.signature.reactionType === signature.reactionType).length >= 2) {
    reasons.push(`reaction_type上限: ${signature.reactionType}`);
  }
  if (picked.filter((entry) => entry.setDiversity.signature.judgmentShape === signature.judgmentShape).length >= 2) {
    reasons.push(`judgment_shape上限: ${signature.judgmentShape}`);
  }
}

function appendCandidatePairConflicts(
  signature: ReturnType<typeof diversitySignature>,
  variant: XCreativeVariant,
  pick: XDailyTopPick,
  other: XDailyTopPick["setDiversity"]["signature"],
  reasons: string[],
) {
  const sameShape = [
    signature.openingPattern === other.openingPattern,
    signature.sentenceStructure === other.sentenceStructure,
    signature.judgmentPhrase === other.judgmentPhrase,
    signature.subjectStructure === other.subjectStructure,
    signature.intent === other.intent,
    signature.sourceType === other.sourceType,
    signature.emotionalAngle === other.emotionalAngle,
    signature.mediaType === other.mediaType,
    signature.linkStrategy === other.linkStrategy,
    signature.endingPhrase === other.endingPhrase,
    signature.numberPlacement === other.numberPlacement,
  ].filter(Boolean).length;
  if (sameShape >= 5) reasons.push(`当日セット類似: ${pick.pickOrder}件目と構造が近い`);
  if (textSimilarity(variant.bodyText, pick.postText) >= 0.58) reasons.push(`当日セット本文類似: ${pick.pickOrder}件目と近い`);
}

function countRecentPhraseReuse(signature: ReturnType<typeof diversitySignature>, logs: XPostLog[]) {
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  return logs.filter((log) => new Date(log.posted_at).getTime() >= thirtyDaysAgo)
    .filter((log) => openingPattern(log.post_text) === signature.openingPattern || judgmentPhrase(log.post_text) === signature.judgmentPhrase)
    .length;
}
