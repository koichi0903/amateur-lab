import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { sourceValueForQuote } from "@/lib/myfans/myfansQuotePool";
import { publicCopyFactsFor } from "@/lib/myfans/myfansPublicCopyFacts";
import {
  attentionValueForText,
  compactSourceText,
  hasBrowserVisibleVisual,
  hasVerifiedVisualAnalysis,
  visualUnderstandingFor,
} from "@/lib/myfans/myfansCreativeEvidence";
import { discoveryInsightFromTopic } from "@/lib/myfans/myfansTopicValue";
import type { DailyRole } from "@/lib/myfans/myfansTopicValue";
import { detectPublicCopyLeak, machineLikeCopyIssue, publicCopyHardFail } from "@/lib/myfans/myfansPublicCopyRules";
import { discoveryInsightFor, replyFor } from "@/lib/myfans/myfansCopyHelpers";
import type { HookType, MyfansCreativeStrategy, MyfansLinkStrategy, VisualUnderstanding } from "@/lib/myfansXExecution";
import { reviewPublicCopyReaction } from "@/lib/myfans/myfansPublicCopyReaction";
import { qualityHoldReasonsFor } from "./myfansPublicCopyQualityReasons";
import { qualityGateDiagnosticsFor } from "./myfansPublicCopyQualityDiagnostics";
import { qualityRoleEvidenceFor } from "./myfansPublicCopyQualityRoleEvidence";
import type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes";

export type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes";

export { reviewPublicCopyReaction };
export type { PublicCopyReactionReview } from "@/lib/myfans/myfansPublicCopyReaction";

export const MYFANS_QUALITY_GATE_MINIMUM = 85;

type QualityRoleScoreContext = {
  isDiscovery: boolean;
  isAuthority: boolean;
  isRevenue: boolean;
  discoveryConcrete: boolean;
  authorityValue: boolean;
  revenueValid: boolean;
  naturalness: number;
  genericPhraseCount: number;
  discoveryMethodTalk: boolean;
  discoveryInsight: ReturnType<typeof discoveryInsightFor>;
  topicInsight: ReturnType<typeof discoveryInsightFromTopic>;
};

function discoveryRoleScore(input: MyfansPublicCopyQualityInput, context: QualityRoleScoreContext) {
  const product = input.product;
  return (
    (context.discoveryConcrete ? 42 : 8) +
    (product.popularity_rank ? 14 : 0) +
    (product.is_new ? 12 : 0) +
    (product.likes_count >= 100 || product.saves_count >= 20 || context.topicInsight ? 16 : 0) +
    (context.naturalness >= 20 ? 12 : 7) +
    (context.genericPhraseCount === 0 ? 12 : 2)
  );
}

function authorityRoleScore(input: MyfansPublicCopyQualityInput, context: QualityRoleScoreContext) {
  const product = input.product;
  return (
    (context.authorityValue ? 34 : 8) +
    (product.popularity_rank || product.is_new ? 14 : 8) +
    (product.likes_count > 0 || product.saves_count > 0 ? 12 : 7) +
    (context.naturalness >= 20 ? 18 : 10) +
    (context.genericPhraseCount === 0 ? 12 : 4) +
    10
  );
}

function revenueRoleScore(input: MyfansPublicCopyQualityInput, context: QualityRoleScoreContext) {
  const product = input.product;
  const hasPrDisclosure = /#PR/.test(input.body + "\n" + replyFor(product, input.linkStrategy));
  return (
    (context.revenueValid ? 32 : 0) +
    (product.estimated_reward > 0 || product.reward_rate > 0 ? 18 : 0) +
    (product.popularity_rank || product.likes_count > 0 ? 14 : 8) +
    (hasPrDisclosure ? 12 : 0) +
    (context.naturalness >= 20 ? 14 : 8) +
    (context.genericPhraseCount <= 1 ? 10 : 2)
  );
}

function applyQualityRoleScoreFloor(score: number, context: QualityRoleScoreContext) {
  if (
    context.isDiscovery &&
    (context.discoveryInsight || context.topicInsight) &&
    !context.discoveryMethodTalk
  ) {
    return Math.max(score, 90);
  }
  if (context.isAuthority && context.authorityValue) return Math.max(score, 90);
  return score;
}

function roleQualityScoreFor(input: MyfansPublicCopyQualityInput, context: QualityRoleScoreContext) {
  const roleScoreRaw = context.isDiscovery
    ? discoveryRoleScore(input, context)
    : context.isAuthority
      ? authorityRoleScore(input, context)
      : context.isRevenue
        ? revenueRoleScore(input, context)
        : 0;
  return applyQualityRoleScoreFloor(roleScoreRaw, context);
}
type QualityTotalContext = {
  leak: ReturnType<typeof detectPublicCopyLeak>;
  hardFail: string[];
  sourceTextGrounded: boolean;
  isQuote: boolean;
  v8QuoteScore: number;
  cueEarly: boolean;
  understanding: VisualUnderstanding;
  concreteVisualSpecificity: number;
  emotionalStopPower: number;
  naturalnessV8: number;
  curiosityV8: number;
  originality: number;
  legacyScore: number;
  role: DailyRole;
  roleScore: number;
};

function verifiedVisualQuoteScoreFor(context: QualityTotalContext) {
  const verifiedOpeningBonus = context.cueEarly && context.understanding.visualAnalysisStatus === "verified" ? 30 : 0;
  const visualSpecificityBonus = context.concreteVisualSpecificity >= 22 ? 15 : 6;
  return verifiedOpeningBonus
    + context.emotionalStopPower
    + visualSpecificityBonus
    + context.naturalnessV8
    + context.curiosityV8
    + context.originality;
}

function ungatedQualityScoreFor(input: MyfansPublicCopyQualityInput, context: QualityTotalContext) {
  if (context.sourceTextGrounded) return Math.max(88, context.v8QuoteScore);
  if (context.isQuote && hasVerifiedVisualAnalysis(input.quote)) return verifiedVisualQuoteScoreFor(context);
  if (context.isQuote) return context.v8QuoteScore;
  if (context.role === "ATTENTION") return context.legacyScore;
  return context.roleScore;
}

function qualityTotalFor(input: MyfansPublicCopyQualityInput, context: QualityTotalContext) {
  if (context.leak.hasLeak || context.hardFail.length) return 0;
  return Math.max(0, Math.min(100, ungatedQualityScoreFor(input, context)));
}

function cueAppearsInBody(groundingText: string, allCueTokens: string[], body: string) {
  const bodyCompact = body.replace(/[^\p{L}\p{N}]+/gu, "");
  return Boolean(groundingText && allCueTokens.some((token) => bodyCompact.includes(token.replace(/\s+/g, ""))));
}

function sourceQuoteGrounded(input: MyfansPublicCopyQualityInput, bodyCompact: string, isQuote: boolean) {
  const sourceTextSnippet = compactSourceText(input.quote?.text_excerpt ?? "", 28).replace(/[^\p{L}\p{N}]+/gu, "");
  return Boolean(
    sourceTextSnippet.length >= 6
      && bodyCompact.includes(sourceTextSnippet.slice(0, Math.min(12, sourceTextSnippet.length)))
      && (isQuote || (input.quote && sourceValueForQuote(input.quote).verdict === "PASS")),
  );
}

function cueAppearsEarly(input: MyfansPublicCopyQualityInput, allCueTokens: string[], cueInBody: boolean) {
  const firstTwoLines = input.body.split(/\n+/).slice(0, 2).join(" ");
  return cueInBody && allCueTokens.some((token) => firstTwoLines.replace(/[^\p{L}\p{N}]+/gu, "").includes(token.replace(/\s+/g, "")));
}

function quoteVisualSpecificity(
  isQuote: boolean,
  sourceTextGrounded: boolean,
  cueEarly: boolean,
  cueInBody: boolean,
  firstTwoLines: string,
  visualWords: RegExp,
  understanding: VisualUnderstanding,
) {
  if (!isQuote) return 0;
  if (sourceTextGrounded) return 24;
  if (cueEarly) return 30;
  if (cueInBody) return 22;
  return visualWords.test(firstTwoLines) && understanding.concreteVisualCue ? 18 : 6;
}

function qualityVisualEvidenceFor(
  input: MyfansPublicCopyQualityInput,
  isQuote: boolean,
  understanding: VisualUnderstanding,
  visualWords: RegExp,
) {
  const groundingText = understanding.attentionMoment || understanding.humanObservation || understanding.concreteVisualCue;
  const cueTokens = groundingText
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const visualKeywordTokens = Array.from(new Set((groundingText.match(/制服|階段|赤|黒|砂浜|海辺|ベッド|距離|近|くま|踊|引き|近め|全身|表情|目線|衣装|服装|色|ポーズ|切り替わ|途中|変わる/g) ?? [])));
  const allCueTokens = [...cueTokens, ...visualKeywordTokens];
  const bodyCompact = input.body.replace(/[^\p{L}\p{N}]+/gu, "");
  const cueInBody = cueAppearsInBody(groundingText, allCueTokens, input.body);
  const sourceTextGrounded = sourceQuoteGrounded(input, bodyCompact, isQuote);
  const cueEarly = cueAppearsEarly(input, allCueTokens, cueInBody);
  const firstTwoLines = input.body.split(/\n+/).slice(0, 2).join(" ");
  const concreteVisualSpecificity = quoteVisualSpecificity(
    isQuote,
    sourceTextGrounded,
    cueEarly,
    cueInBody,
    firstTwoLines,
    visualWords,
    understanding,
  );
  return { cueInBody, sourceTextGrounded, cueEarly, concreteVisualSpecificity };
}

type QualityCopyScoreContext = {
  isQuote: boolean;
  firstLine: string;
  understanding: VisualUnderstanding;
  reactionWords: RegExp;
  visualWords: RegExp;
  cueInBody: boolean;
  hardFail: string[];
};

function qualityReactionScoresFor(input: MyfansPublicCopyQualityInput, context: QualityCopyScoreContext) {
  const readerCuriosity = readerCuriosityScoreFor(context);
  const naturalness = naturalnessScoreFor(input.body, context.reactionWords);
  const curiosity = curiosityScoreFor(input.body, context.reactionWords);
  const originality = originalityScoreFor(input.body);
  return {
    readerCuriosity,
    naturalness,
    curiosity,
    originality,
    emotionalStopPower: Math.min(20, Math.round(readerCuriosity * 0.67)),
    naturalnessV8: Math.min(15, Math.round(naturalness * 0.75)),
    curiosityV8: Math.min(10, Math.round(curiosity * 0.67)),
    originalityV8: Math.min(5, Math.round(originality * 0.5)),
  };
}

function readerCuriosityScoreFor(context: QualityCopyScoreContext) {
  const { isQuote, firstLine, understanding, reactionWords } = context;
  const observationFirstLine = isQuote && understanding.humanObservation && firstLine.includes(understanding.humanObservation);
  const hasCuriosityEnding = /[。？?]$/.test(firstLine) && !/です。$|ます。$/.test(firstLine);
  const hasCuriosityCue = reactionWords.test(firstLine) || observationFirstLine;
  if (firstLine.length >= 10 && firstLine.length <= 46 && hasCuriosityEnding && hasCuriosityCue) return 30;
  return firstLine.length >= 10 ? 18 : 8;
}

function naturalnessScoreFor(body: string, reactionWords: RegExp) {
  if (machineLikeCopyIssue(body)) return 4;
  return reactionWords.test(body) ? 20 : 10;
}

function curiosityScoreFor(body: string, reactionWords: RegExp) {
  if (/気になる|見たくなる|開いて|戻りたく|先を|続き/.test(body)) return 15;
  return reactionWords.test(body) ? 11 : 5;
}

function originalityScoreFor(body: string) {
  return /(そりゃ|ずるい|普通に|一回|残る|持っていかれる|盛らなくても|知らなくても)/.test(body) ? 10 : 6;
}

function qualityVisualScoresFor(input: MyfansPublicCopyQualityInput, context: QualityCopyScoreContext) {
  const { isQuote, cueInBody, visualWords } = context;
  const visualFit = visualWords.test(input.body) || (isQuote && hasBrowserVisibleVisual(input.quote) && context.reactionWords.test(input.body)) ? 25 : isQuote ? 6 : 14;
  return {
    visualFit,
    visualTextFitV8: isQuote ? (hasBrowserVisibleVisual(input.quote) && cueInBody ? 20 : cueInBody ? 14 : 4) : 0,
  };
}

function qualityLegacyScoresFor(
  input: MyfansPublicCopyQualityInput,
  context: QualityCopyScoreContext,
  scores: { visualFit: number; originality: number; naturalness: number },
) {
  const { hardFail } = context;
  const visualTextFit = input.creativeStrategy === "quote_post"
    ? (hasBrowserVisibleVisual(input.quote) ? 25 : 0)
    : ["ranking_card", "comparison_card", "discovery_card"].includes(input.creativeStrategy)
      ? 12
      : 10;
  const roleDifferentiation = input.linkStrategy === "reply_link"
    ? (/^https:\/\/mfco\.link\/r\//.test(input.product.affiliate_url) && /#PR/.test(input.body + "\n" + replyFor(input.product, input.linkStrategy)) ? 10 : 0)
    : 0;
  return {
    concreteFact: scores.visualFit,
    visualTextFit,
    readerRelevance: context.reactionWords.test(input.body) ? 15 : 8,
    originalAngle: scores.originality,
    naturalLanguage: scores.naturalness,
    salesAdminSmell: hardFail.length ? 0 : 5,
    roleDifferentiation,
  };
}

function qualityCopyScoresFor(input: MyfansPublicCopyQualityInput, context: QualityCopyScoreContext) {
  const reactionScores = qualityReactionScoresFor(input, context);
  const visualScores = qualityVisualScoresFor(input, context);
  const legacyScores = qualityLegacyScoresFor(input, context, {
    visualFit: visualScores.visualFit,
    originality: reactionScores.originality,
    naturalness: reactionScores.naturalness,
  });
  return {
    readerCuriosity: reactionScores.readerCuriosity,
    naturalness: reactionScores.naturalness,
    originality: reactionScores.originality,
    emotionalStopPower: reactionScores.emotionalStopPower,
    visualTextFitV8: visualScores.visualTextFitV8,
    naturalnessV8: reactionScores.naturalnessV8,
    curiosityV8: reactionScores.curiosityV8,
    originalityV8: reactionScores.originalityV8,
    ...legacyScores,
  };
}

type QualityBreakdownContext = {
  isQuote: boolean;
  emotionalStopPower: number;
  readerCuriosity: number;
  verifiedVisualNotGrounded: boolean;
  visualTextFitV8: number;
  visualTextFit: number;
  concreteVisualSpecificity: number;
  concreteFact: number;
  curiosityV8: number;
  originalAngle: number;
  naturalnessV8: number;
  readerRelevance: number;
  naturalness: number;
  attentionValue: ReturnType<typeof attentionValueForText>;
  reactionReview: ReturnType<typeof reviewPublicCopyReaction>;
  roleDifferentiation: number;
  salesAdminSmell: number;
  naturalLanguage: number;
  hardFail: string[];
};

function qualityOpeningBreakdownFor(context: QualityBreakdownContext) {
  return {
    stopPower: context.isQuote ? context.emotionalStopPower : context.readerCuriosity,
    firstLineStop: context.readerCuriosity,
  };
}

function qualityVisualBreakdownFor(input: MyfansPublicCopyQualityInput, context: QualityBreakdownContext) {
  const hasVerifiedQuoteVisual = context.isQuote && hasVerifiedVisualAnalysis(input.quote);
  return {
    visualLeverage: hasVerifiedQuoteVisual ? (context.verifiedVisualNotGrounded ? 0 : 30) : context.isQuote ? context.visualTextFitV8 : context.visualTextFit,
    visual: context.isQuote ? context.visualTextFitV8 : context.visualTextFit,
    specificity: context.isQuote ? context.concreteVisualSpecificity : context.concreteFact,
    proof: context.concreteFact,
  };
}

function qualityReactionBreakdownFor(context: QualityBreakdownContext) {
  return {
    broadCuriosity: context.isQuote ? context.curiosityV8 : context.originalAngle,
    audience: context.isQuote ? context.naturalnessV8 : context.readerRelevance,
    followReason: context.isQuote ? context.naturalness : context.readerRelevance,
  };
}

function qualityBreakdownFor(input: MyfansPublicCopyQualityInput, context: QualityBreakdownContext) {
  return {
    ...qualityOpeningBreakdownFor(context),
    ...qualityVisualBreakdownFor(input, context),
    ...qualityReactionBreakdownFor(context),
    attentionValue: context.attentionValue.score,
    naturalUserReaction: context.reactionReview.naturalUserReaction,
    analystCommentaryRisk: context.reactionReview.analystCommentaryRisk,
    sourceSpecificity: context.reactionReview.sourceSpecificity,
    roleDifferentiation: context.roleDifferentiation,
    spamSalesSmell: context.salesAdminSmell + context.naturalLanguage,
    repetitionPenalty: context.hardFail.length ? 100 : 0,
  };
}

export function qualityScoreFor(input: MyfansPublicCopyQualityInput) {
  const firstLine = input.body.split(/\n+/)[0] ?? "";
  const facts = publicCopyFactsFor(input.product, input.quote);
  const understanding = visualUnderstandingFor(facts);
  const reactionReview = reviewPublicCopyReaction(input.body, input.quote, understanding);
  const attentionValue = attentionValueForText(input.body, understanding.attentionMoment || understanding.humanObservation);
  const leak = detectPublicCopyLeak(input.body);
  const hardFail = publicCopyHardFail(input.body);
  const isQuote = input.creativeStrategy === "quote_post";
  const reactionWords = /え、|そりゃ|分かる|気になる|見たくなる|持って|止まる|ずるい|刺さる|残る|開いて|伝わる|強い|納得/;
  const visualWords = /動画|画像|1枚|一枚|数秒|冒頭|最初|途中|見た瞬間|雰囲気|空気|切り取り|近さ|見せ方|ぱっと見|これだけ|この1枚|見たら|見たく|開いて|顔|表情|衣装|制服|距離|アップ|引き|体型|タイトル|設定|生活感|自撮り|主観|テロップ|字幕/;
  const vagueReactionOnly = isQuote && /^(これ|この投稿|この1枚)?(流れてきたら一回止まる|強い|刺さる|見返したくなる|そりゃ伸びる|見せ方が分かりやすい|入口がある|入口がはっきり|好みが分かれる)[。！？!?]?/m.test(input.body.replace(/\s+/g, ""));
  const { cueInBody, sourceTextGrounded, cueEarly, concreteVisualSpecificity } =
    qualityVisualEvidenceFor(input, isQuote, understanding, visualWords);
  const {
    readerCuriosity,
    naturalness,
    originality,
    emotionalStopPower,
    visualTextFitV8,
    naturalnessV8,
    curiosityV8,
    originalityV8,
    concreteFact,
    visualTextFit,
    readerRelevance,
    originalAngle,
    naturalLanguage,
    salesAdminSmell,
    roleDifferentiation,
  } = qualityCopyScoresFor(input, { isQuote, firstLine, understanding, reactionWords, visualWords, cueInBody, hardFail });
  const roleEvidence = qualityRoleEvidenceFor(input, { readerCuriosity, sourceTextGrounded });
  const {
    role,
    isDiscovery,
    isAuthority,
    isRevenue,
    firstLineGateFailed,
    discoveryFactMissing,
    discoveryConcrete,
    discoveryMethodTalk,
    authorityValue,
    revenueValid,
    genericPhraseCount,
    discoveryInsight,
    topicInsight,
  } = roleEvidence;
  const roleScore = roleQualityScoreFor(input, {
    isDiscovery,
    isAuthority,
    isRevenue,
    discoveryConcrete,
    authorityValue,
    revenueValid,
    naturalness,
    genericPhraseCount,
    discoveryMethodTalk,
    discoveryInsight,
    topicInsight,
  });
  const v8QuoteScore = concreteVisualSpecificity + emotionalStopPower + visualTextFitV8 + naturalnessV8 + curiosityV8 + originalityV8;
  const legacyScore = readerCuriosity + concreteFact + visualTextFit + readerRelevance + originalAngle + naturalLanguage + salesAdminSmell + roleDifferentiation;
  const total = qualityTotalFor(input, {
    leak,
    hardFail,
    sourceTextGrounded,
    isQuote,
    v8QuoteScore,
    cueEarly,
    understanding,
    concreteVisualSpecificity,
    emotionalStopPower,
    naturalnessV8,
    curiosityV8,
    originality,
    legacyScore,
    role,
    roleScore,
  });
  const {
    quoteVisualMissing,
    quoteAttentionMissing,
    abstractFallbackQuote,
    verifiedVisualNotGrounded,
    unverifiableVisualDetail,
    reportTone,
    analystCommentary,
    unnaturalReaction,
    abstractTextOnly,
    sourceSimilarity,
    repeatedLine,
  } = qualityGateDiagnosticsFor(input, { isQuote, understanding, cueInBody, cueEarly, attentionValue, reactionReview, reactionWords });
  const holdReasons = qualityHoldReasonsFor(input, {
    leak,
    hardFail,
    total,
    isQuote,
    concreteVisualSpecificity,
    verifiedVisualNotGrounded,
    unverifiableVisualDetail,
    firstLineGateFailed,
    discoveryFactMissing,
    isDiscovery,
    discoveryConcrete,
    discoveryMethodTalk,
    isAuthority,
    authorityValue,
    isRevenue,
    revenueValid,
    genericPhraseCount,
    quoteVisualMissing,
    vagueReactionOnly,
    reportTone,
    reactionReview,
    analystCommentary,
    unnaturalReaction,
    sourceSimilarity,
    sourceTextGrounded,
    repeatedLine,
    quoteAttentionMissing,
    abstractFallbackQuote,
    abstractTextOnly,
    role,
    visualTextFit,
  }, MYFANS_QUALITY_GATE_MINIMUM);
  return {
    total: discoveryFactMissing ? Math.min(total, 84) : total,
    verdict: holdReasons.length ? "HOLD" : "PASS",
    breakdown: qualityBreakdownFor(input, {
      isQuote,
      emotionalStopPower,
      readerCuriosity,
      verifiedVisualNotGrounded,
      visualTextFitV8,
      visualTextFit,
      concreteVisualSpecificity,
      concreteFact,
      curiosityV8,
      originalAngle,
      naturalnessV8,
      readerRelevance,
      naturalness,
      attentionValue,
      reactionReview,
      roleDifferentiation,
      salesAdminSmell,
      naturalLanguage,
      hardFail,
    }),
    reasons: holdReasons.length ? holdReasons : [`${role} role別Quality Gateで公開可能です`],
  };
}

export function evaluateMyfansPublicCopyQuality(input: {
  body: string;
  product: MyfansProduct;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creativeStrategy: MyfansCreativeStrategy;
  quote: MyfansQuoteCandidate | null;
  hook?: HookType;
  attentionScore?: number;
}) {
  return qualityScoreFor({
    body: input.body,
    product: input.product,
    postType: input.postType,
    linkStrategy: input.linkStrategy,
    creativeStrategy: input.creativeStrategy,
    quote: input.quote,
  });
}
