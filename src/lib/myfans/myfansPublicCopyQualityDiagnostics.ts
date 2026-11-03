import { attentionValueForText, hasVerifiedVisualAnalysis } from "@/lib/myfans/myfansCreativeEvidence";
import { sourceCopySimilarity } from "@/lib/myfans/myfansPublicCopyRules";
import { MYFANS_ATTENTION_VALUE_MINIMUM } from "@/lib/myfans/myfansTopicValue";
import { reviewPublicCopyReaction } from "@/lib/myfans/myfansPublicCopyReaction";
import type { VisualUnderstanding } from "@/lib/myfansXExecution";
import type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes";

export type QualityGateDiagnosticContext = {
  isQuote: boolean;
  understanding: VisualUnderstanding;
  cueInBody: boolean;
  cueEarly: boolean;
  attentionValue: ReturnType<typeof attentionValueForText>;
  reactionReview: ReturnType<typeof reviewPublicCopyReaction>;
  reactionWords: RegExp;
};

function quoteVisualMissingFor(
  isQuote: boolean,
  hasVerifiedVisual: boolean,
  understanding: VisualUnderstanding,
  cueInBody: boolean,
  cueEarly: boolean,
) {
  return isQuote && hasVerifiedVisual && (!understanding.humanObservation || !cueInBody || !cueEarly);
}

function quoteAttentionMissingFor(
  isQuote: boolean,
  hasVerifiedVisual: boolean,
  understanding: VisualUnderstanding,
  attentionValue: ReturnType<typeof attentionValueForText>,
) {
  return isQuote && hasVerifiedVisual && (!understanding.attentionMoment || attentionValue.score < MYFANS_ATTENTION_VALUE_MINIMUM || attentionValue.weakCue);
}

function unverifiableVisualDetailFor(input: MyfansPublicCopyQualityInput, isQuote: boolean, hasVerifiedVisual: boolean) {
  return isQuote && !hasVerifiedVisual && /(表情|ポーズ|構図|テロップ|字幕|アップ|引きの画|途中で|後半|冒頭と|距離が近くなる|1枚目|2枚目)/.test(input.body);
}

function qualityVisualGateDiagnosticsFor(input: MyfansPublicCopyQualityInput, context: QualityGateDiagnosticContext) {
  const { isQuote, understanding, cueInBody, cueEarly, attentionValue } = context;
  const hasVerifiedVisual = hasVerifiedVisualAnalysis(input.quote);
  return {
    quoteVisualMissing: quoteVisualMissingFor(isQuote, hasVerifiedVisual, understanding, cueInBody, cueEarly),
    quoteAttentionMissing: quoteAttentionMissingFor(isQuote, hasVerifiedVisual, understanding, attentionValue),
    abstractFallbackQuote: isQuote && understanding.visualAnalysisStatus !== "verified" && !input.quote?.text_excerpt,
    verifiedVisualNotGrounded: isQuote && hasVerifiedVisual && (!cueInBody || understanding.visualAnalysisStatus !== "verified"),
    unverifiableVisualDetail: unverifiableVisualDetailFor(input, isQuote, hasVerifiedVisual),
  };
}

function repeatedLineFor(body: string) {
  const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.length >= 2 && lines[0].replace(/[。！？!?]/g, "") === lines[1].replace(/[。！？!?]/g, "");
}

function reportToneFor(input: MyfansPublicCopyQualityInput, isQuote: boolean, reactionWords: RegExp) {
  const reportWords = /表示|いいね|RP|保存|人気|価格|¥|数字|反応の強さ|同価格帯|条件|比較|判断材料|分析/;
  return isQuote && reportWords.test(input.body) && !reactionWords.test(input.body);
}

function abstractTextOnlyFor(input: MyfansPublicCopyQualityInput) {
  const abstractPhrases = /この投稿|この切り取り|こういう|一回開いて|強い|気になる|刺さる/;
  const concretePhrases = /(人気|保存|新着|¥|価格|ランキング|プロフィール|万表示|千表示|いいね|反応が残っている|見た人の温度|元投稿の空気)/;
  return input.creativeStrategy === "text_only" && abstractPhrases.test(input.body) && !concretePhrases.test(input.body);
}

function qualityTextGateDiagnosticsFor(input: MyfansPublicCopyQualityInput, context: QualityGateDiagnosticContext) {
  const { isQuote, reactionReview, reactionWords } = context;
  return {
    reportTone: reportToneFor(input, isQuote, reactionWords),
    analystCommentary: isQuote && reactionReview.verdict === "analyst_commentary",
    unnaturalReaction: isQuote && reactionReview.naturalUserReaction < 55,
    abstractTextOnly: abstractTextOnlyFor(input),
    sourceSimilarity: sourceCopySimilarity(input.body, input.quote?.text_excerpt ?? ""),
    repeatedLine: repeatedLineFor(input.body),
  };
}

export function qualityGateDiagnosticsFor(input: MyfansPublicCopyQualityInput, context: QualityGateDiagnosticContext) {
  return {
    ...qualityVisualGateDiagnosticsFor(input, context),
    ...qualityTextGateDiagnosticsFor(input, context),
  };
}
