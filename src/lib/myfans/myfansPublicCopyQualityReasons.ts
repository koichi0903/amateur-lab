import type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes";
import { isValidRevenueProduct } from "./myfansCopyHelpers";
import { weakAttentionCue } from "./myfansCreativeEvidence";
import type { PublicCopyReactionReview } from "./myfansPublicCopyReaction";
import { MYFANS_ATTENTION_VALUE_MINIMUM } from "./myfansTopicValue";
import type { DailyRole } from "./myfansTopicValue";

export type QualityHoldReasonContext = {
  leak: { hasLeak: boolean; matches: string[] };
  hardFail: string[];
  total: number;
  isQuote: boolean;
  concreteVisualSpecificity: number;
  verifiedVisualNotGrounded: boolean;
  unverifiableVisualDetail: boolean;
  firstLineGateFailed: boolean;
  discoveryFactMissing: boolean;
  isDiscovery: boolean;
  discoveryConcrete: boolean;
  discoveryMethodTalk: boolean;
  isAuthority: boolean;
  authorityValue: boolean;
  isRevenue: boolean;
  revenueValid: boolean;
  genericPhraseCount: number;
  quoteVisualMissing: boolean;
  vagueReactionOnly: boolean;
  reportTone: boolean;
  reactionReview: Pick<PublicCopyReactionReview, "analystCommentaryRisk" | "naturalUserReaction">;
  analystCommentary: boolean;
  unnaturalReaction: boolean;
  sourceSimilarity: number;
  sourceTextGrounded: boolean;
  repeatedLine: boolean;
  quoteAttentionMissing: boolean;
  abstractFallbackQuote: boolean;
  abstractTextOnly: boolean;
  role: DailyRole;
  visualTextFit: number;
};

function qualityBoundaryReasons(context: QualityHoldReasonContext, minimum: number) {
  return [
    context.leak.hasLeak ? `Public Copy leak: ${context.leak.matches.join(" / ")}` : "",
    ...context.hardFail.map((reason) => `Public Copy hard fail: ${reason}`),
    context.total < minimum ? `Quality Gate ${minimum}未満` : "",
  ];
}

function qualityVisualReasons(context: QualityHoldReasonContext) {
  return [
    context.isQuote && context.concreteVisualSpecificity < 20 ? "concrete visual specificity 20/30未満" : "",
    context.verifiedVisualNotGrounded ? "verified visualなのに本文がvisual cueを反映していません" : "",
    context.unverifiableVisualDetail ? "未確認visual detailが本文に入っています" : "",
  ];
}

function qualityDiscoveryRoleReasons(context: QualityHoldReasonContext) {
  return [
    context.firstLineGateFailed ? "First-line curiosity gate未達" : "",
    context.discoveryFactMissing ? "discovery差なし" : "",
    context.isDiscovery && !context.discoveryConcrete ? "DISCOVERYに実データ由来の一発見がありません" : "",
    context.discoveryMethodTalk ? "DISCOVERYが分析行為の説明になっています" : "",
  ];
}

function qualityCommercialRoleReasons(context: QualityHoldReasonContext) {
  return [
    context.isAuthority && !context.authorityValue ? "AUTHORITYに編集者として何を選別したかがありません" : "",
    context.isRevenue && !context.revenueValid ? "Revenue枠の正規mfco.linkまたは報酬根拠がありません" : "",
  ];
}

function qualityRoleReasons(context: QualityHoldReasonContext) {
  return [
    ...qualityDiscoveryRoleReasons(context),
    ...qualityCommercialRoleReasons(context),
  ];
}

function qualityCopyStyleReasons(context: QualityHoldReasonContext) {
  return [
    context.genericPhraseCount >= 2 ? "汎用句が多く機械的です" : "",
    context.quoteVisualMissing ? "quote本文に照合可能な具体visual cueがありません" : "",
    context.vagueReactionOnly ? "抽象リアクションだけで終わっています" : "",
    context.reportTone ? "quote本文が数字レポート口調です" : "",
  ];
}

function qualityCopySourceReasons(context: QualityHoldReasonContext) {
  return [
    context.analystCommentary ? `Natural reaction判定NG: analyst risk ${context.reactionReview.analystCommentaryRisk}/100` : "",
    context.unnaturalReaction ? `Natural reaction ${context.reactionReview.naturalUserReaction}/100: 普通のXユーザーの一言として弱い` : "",
    context.sourceSimilarity >= 0.72 && !context.sourceTextGrounded ? "元投稿本文に近すぎます" : "",
    context.repeatedLine ? "本文内で同じ内容を繰り返しています" : "",
  ];
}

function qualityCopySafetyReasons(context: QualityHoldReasonContext) {
  return [
    ...qualityCopyStyleReasons(context),
    ...qualityCopySourceReasons(context),
  ];
}

function qualityAttentionReasons(input: MyfansPublicCopyQualityInput, context: QualityHoldReasonContext) {
  return [
    context.quoteAttentionMissing ? `Attention Value ${MYFANS_ATTENTION_VALUE_MINIMUM}未満` : "",
    context.isQuote && weakAttentionCue(input.body) ? "事実でもhookとして弱いvisual cueです" : "",
  ];
}

function qualityFallbackReasons(context: QualityHoldReasonContext) {
  return [
    context.abstractFallbackQuote ? "verified visualなしの抽象fallback quoteは最終投稿に採用しません" : "",
    context.abstractTextOnly ? "抽象text onlyを4本埋めのために採用しません" : "",
  ];
}

function qualityChannelReasons(input: MyfansPublicCopyQualityInput, context: QualityHoldReasonContext) {
  return [
    context.role === "ATTENTION" && input.creativeStrategy === "quote_post" && context.visualTextFit === 0 ? "引用visualがブラウザ表示確認済みではありません" : "",
    input.linkStrategy === "reply_link" && !isValidRevenueProduct(input.product) ? "Revenue枠の正規mfco.linkまたは報酬根拠がありません" : "",
  ];
}

export function qualityHoldReasonsFor(
  input: MyfansPublicCopyQualityInput,
  context: QualityHoldReasonContext,
  qualityGateMinimum: number,
) {
  return [
    ...qualityBoundaryReasons(context, qualityGateMinimum),
    ...qualityVisualReasons(context),
    ...qualityRoleReasons(context),
    ...qualityCopySafetyReasons(context),
    ...qualityAttentionReasons(input, context),
    ...qualityFallbackReasons(context),
    ...qualityChannelReasons(input, context),
  ].filter(Boolean);
}
