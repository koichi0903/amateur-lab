import { isMyfansDailyOptionDiverseEnough } from "./myfansCandidateDiversity";
import { fallbackMyfansPostTypes } from "./myfansCandidateBuilder";
import { roleFor } from "@/lib/myfansCopyHelpers";
import { myfansOptionMetadata } from "@/lib/myfansOptionMetadata";
import type { MyfansReasonToCare } from "@/lib/myfansQuotePool";
import type { DailyRole } from "@/lib/myfansTopicValue";
import type { RotationItem } from "./myfansGrowthStrategy";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { MyfansCandidateForDiversity, MyfansDailyOptionCandidate, CopySearchAngle } from "./myfansXExecution";
import type { evaluateMyfansCandidateDiversity } from "./myfansCandidateDiversity";
import type { evaluateMyfansCandidateNovelty } from "./myfansCandidateNovelty";
import type { qualityScoreFor } from "./myfansPublicCopyQuality";

type MyfansRecoveryHistoryEntry = {
  slot: string;
  attempt: number;
  candidateId: string;
  productId: number | null;
  quoteCandidateId: number | null;
  initialRole: DailyRole;
  recoveryRole: DailyRole;
  role: string;
  hook: string;
  creative: string;
  score: number;
  verdict: string;
  holdReason: string;
  copyAngle: CopySearchAngle;
  reasonToCare: MyfansReasonToCare | null;
  topicIdentity: string;
  topicSemanticKey: string;
  qualityReasons: string[];
  recoveryAction: string;
};

export function classifyMyfansHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  return topicOrVisualHoldReason(quality)
    ?? hookOrSpecificityHoldReason(quality)
    ?? scoreHoldReason(quality)
    ?? patternHoldReason(quality)
    ?? discoveryHoldReason(quality)
    ?? quality.reasons[0]
    ?? "Quality Gate未達";
}

function hasHoldReason(quality: ReturnType<typeof qualityScoreFor>, pattern: RegExp) {
  return quality.reasons.some((reason) => pattern.test(reason));
}

function topicOrVisualHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  if (hasHoldReason(quality, /LOW_TOPIC_VALUE/)) return "LOW_TOPIC_VALUE";
  if (hasHoldReason(quality, /concrete visual|具体visual|抽象リアクション/)) return "visual cue不足";
  return null;
}

function hookOrSpecificityHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  if (hasHoldReason(quality, /First-line|curiosity|85未満/) && quality.breakdown.firstLineStop < 25) return "hook弱い";
  if (!hasHoldReason(quality, /DISCOVERY|AUTHORITY|REVENUE/) && quality.breakdown.specificity < 20) return "specificity弱い";
  return null;
}

function scoreHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  if (quality.breakdown.visual < 12) return "visual弱い";
  if (quality.breakdown.audience < 15) return "audience不明";
  return null;
}

function patternHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  if (hasHoldReason(quality, /同じ|テンプレ|語尾|構文/)) return "sameness高い";
  if (quality.verdict === "HOLD" && hasHoldReason(quality, /公開可能/)) return "sameness高い";
  return null;
}

function discoveryHoldReason(quality: ReturnType<typeof qualityScoreFor>) {
  if (hasHoldReason(quality, /discovery差なし/)) return "discovery差なし";
  if (hasHoldReason(quality, /Revenue|mfco/)) return "profile CTA弱い";
  return null;
}

function describeMyfansRecoveryAction(reason: string, postType: string, nextPostType: string, nextAttempt: number) {
  if (reason === "LOW_TOPIC_VALUE") return postType !== nextPostType ? "LOW_TOPIC_VALUE → 別role/別candidateへ移動" : "LOW_TOPIC_VALUE → 文面retryせず別candidateへ移動";
  if (reason === "visual cue不足") return "boring cueを救済せず、別verified cue/quote/creatorへ移動";
  if (reason === "hook弱い") return "1行目だけでなくangleごと変更して再生成";
  if (reason === "specificity弱い") return "別候補/別データ差へ切替";
  if (reason === "visual弱い") return "別quote/画像へ切替";
  if (reason === "sameness高い") return "別構文/別roleへ切替";
  if (reason === "audience不明") return "audienceを内部再設定してpublic copy再生成";
  if (reason === "discovery差なし") return "DISCOVERY差なし → AUTHORITYへrole swap";
  if (postType !== nextPostType) return `${postType} → ${nextPostType}へrole swap`;
  return `候補${nextAttempt + 1}へ再探索`;
}

type MyfansCandidateRecoveryInput = {
  rotation: RotationItem[];
  buildCandidate: (item: RotationItem, index: number, attempt: number, excludedProducts: Set<number>, forcedQuote?: MyfansQuoteCandidate | null) => MyfansCandidateForDiversity;
  evaluateDiversity: (candidate: MyfansCandidateForDiversity) => ReturnType<typeof evaluateMyfansCandidateDiversity>;
  noveltyFor: (candidate: ReturnType<typeof evaluateMyfansCandidateDiversity>) => ReturnType<typeof evaluateMyfansCandidateNovelty>;
  recordAcceptedCandidate: (candidate: ReturnType<typeof evaluateMyfansCandidateDiversity>) => void;
  publishableCandidates: MyfansCandidateForDiversity[];
  usedProductIds: Set<number>;
  allowSameProductAcrossDistinctRoles: boolean;
  slotRecoveryMaxAttempts: number;
  multiAngleAttemptsPerTopic: number;
  qualityGateMinimum: number;
};

type MyfansEvaluatedCandidate = ReturnType<MyfansCandidateRecoveryInput["evaluateDiversity"]>;
type MyfansCandidateNovelty = ReturnType<MyfansCandidateRecoveryInput["noveltyFor"]>;
type MyfansSlotCandidate = MyfansEvaluatedCandidate & { novelty: MyfansCandidateNovelty };

type MyfansRecoveryState = {
  recoveryHistory: MyfansRecoveryHistoryEntry[];
  initialAttempts: Array<{ slot: string; postType: string; score: number; verdict: string; holdReason: string }>;
  heldCandidates: MyfansCandidateForDiversity[];
  slotOptions: Array<{
    slot: string;
    postOrder: number;
    recommendedOption: "A" | "B" | "C";
    candidates: MyfansDailyOptionCandidate[];
  }>;
};

function createRecoveryHistoryEntry(
  candidate: MyfansEvaluatedCandidate,
  slot: string,
  attempt: number,
  initialRole: DailyRole,
  holdReason: string,
  recoveryAction: string,
): MyfansRecoveryHistoryEntry {
  return {
    slot,
    attempt,
    candidateId: candidate.id,
    productId: candidate.product?.id ?? null,
    quoteCandidateId: candidate.quoteCandidateId ?? null,
    initialRole,
    recoveryRole: candidate.dailyRole,
    role: candidate.postType,
    hook: candidate.hookLabel,
    creative: candidate.creativeStrategy,
    score: candidate.quality.total,
    verdict: candidate.quality.verdict,
    holdReason,
    copyAngle: candidate.copyAngle,
    reasonToCare: candidate.topicValue?.reasonToCare ?? null,
    topicIdentity: candidate.topicIdentity,
    topicSemanticKey: candidate.topicSemanticKey,
    qualityReasons: candidate.quality.reasons,
    recoveryAction,
  };
}

function recoveryActionForAttempt(
  candidate: MyfansEvaluatedCandidate,
  item: RotationItem,
  holdReason: string,
  attempt: number,
  previousHold: string,
) {
  if (candidate.quality.verdict === "PASS") {
    return previousHold ? previousHold + "から回復" : "初回PASS";
  }
  const fallbackPostTypes = fallbackMyfansPostTypes(item.postType);
  const nextPostType = fallbackPostTypes[(attempt + 1) % fallbackPostTypes.length];
  return describeMyfansRecoveryAction(holdReason, item.postType, nextPostType, attempt);
}

function processSlotAttempt(input: {
  recoveryInput: MyfansCandidateRecoveryInput;
  state: MyfansRecoveryState;
  item: RotationItem;
  index: number;
  attempt: number;
  previousHold: string;
  excludedProducts: Set<number>;
  optionsForSlot: MyfansSlotCandidate[];
}) {
  const { recoveryInput, state, item, index, attempt, previousHold, excludedProducts, optionsForSlot } = input;
  const candidate = recoveryInput.evaluateDiversity(
    recoveryInput.buildCandidate(item, index, attempt, excludedProducts),
  );
  const holdReason = candidate.quality.verdict === "PASS" ? "" : classifyMyfansHoldReason(candidate.quality);
  if (attempt === 0) {
    state.initialAttempts.push({
      slot: item.slot,
      postType: candidate.postType,
      score: candidate.quality.total,
      verdict: candidate.quality.verdict,
      holdReason,
    });
  }
  state.recoveryHistory.push(createRecoveryHistoryEntry(
    candidate,
    item.slot,
    attempt + 1,
    roleFor(item.postType, item.linkStrategy, "text_only"),
    holdReason,
    recoveryActionForAttempt(candidate, item, holdReason, attempt, previousHold),
  ));

  let selected: MyfansEvaluatedCandidate | null = null;
  if (candidate.quality.verdict === "PASS" && candidate.quality.total >= recoveryInput.qualityGateMinimum) {
    const novelty = recoveryInput.noveltyFor(candidate);
    if (novelty.verdict !== "blocked" && isMyfansDailyOptionDiverseEnough(candidate, optionsForSlot)) {
      optionsForSlot.push({ ...candidate, novelty });
      selected = candidate;
    }
  }
  if (candidate.product?.id && !recoveryInput.allowSameProductAcrossDistinctRoles && (attempt + 1) % recoveryInput.multiAngleAttemptsPerTopic === 0) {
    excludedProducts.add(candidate.product.id);
  }
  return { holdReason, selected };
}

function recoverRotationItem(
  recoveryInput: MyfansCandidateRecoveryInput,
  state: MyfansRecoveryState,
  item: RotationItem,
  index: number,
) {
  const excludedProducts = new Set(recoveryInput.usedProductIds);
  let selected: MyfansEvaluatedCandidate | null = null;
  const optionsForSlot: MyfansSlotCandidate[] = [];
  let previousHold = "";
  for (let attempt = 0; attempt < recoveryInput.slotRecoveryMaxAttempts; attempt += 1) {
    const result = processSlotAttempt({
      recoveryInput,
      state,
      item,
      index,
      attempt,
      previousHold,
      excludedProducts,
      optionsForSlot,
    });
    selected ??= result.selected;
    previousHold = result.holdReason;
    if (optionsForSlot.length >= 3) break;
  }

  if (selected) {
    recoveryInput.recordAcceptedCandidate(selected);
    recoveryInput.publishableCandidates.push(selected);
    state.slotOptions.push({
      slot: selected.plannedSlot,
      postOrder: index + 1,
      recommendedOption: "A",
      candidates: optionsForSlot.slice(0, 3).map((candidate, optionIndex) => ({
        ...candidate,
        ...myfansOptionMetadata(optionIndex),
      })),
    });
    return;
  }

  const last = state.recoveryHistory.filter((history) => history.slot === item.slot).at(-1);
  state.heldCandidates.push({
    ...recoveryInput.buildCandidate(item, index, recoveryInput.slotRecoveryMaxAttempts - 1, excludedProducts),
    quality: {
      total: last?.score ?? 0,
      verdict: "HOLD",
      breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: 0, naturalUserReaction: 0, analystCommentaryRisk: 100, sourceSpecificity: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
      reasons: [recoveryInput.slotRecoveryMaxAttempts + "回再探索してもQuality Gateを通過しませんでした", last?.holdReason ?? ""].filter(Boolean),
    },
  });
}

function recoverAttentionBackfill(recoveryInput: MyfansCandidateRecoveryInput, state: MyfansRecoveryState) {
  if (recoveryInput.publishableCandidates.length >= recoveryInput.rotation.length) return;
  const attentionBackfill: RotationItem = {
    postType: "discovery_interest",
    linkStrategy: "no_link",
    objective: "impression",
    cta: "保存用の発見メモ",
    slot: "attention-backfill",
    role: "露出を作る / verified quote backfill",
  };
  for (
    let attempt = 0;
    attempt < recoveryInput.slotRecoveryMaxAttempts * 2 &&
      recoveryInput.publishableCandidates.length < recoveryInput.rotation.length;
    attempt += 1
  ) {
    const index = recoveryInput.publishableCandidates.length + attempt;
    const candidate = recoveryInput.evaluateDiversity(
      recoveryInput.buildCandidate(attentionBackfill, index, attempt, recoveryInput.usedProductIds),
    );
    const holdReason = candidate.quality.verdict === "PASS" ? "" : classifyMyfansHoldReason(candidate.quality);
    const slot = recoveryInput.rotation[recoveryInput.publishableCandidates.length]?.slot ?? attentionBackfill.slot;
    const action = candidate.quality.verdict === "PASS"
      ? "Attention verified quote backfillで回復"
      : describeMyfansRecoveryAction(holdReason, attentionBackfill.postType, attentionBackfill.postType, attempt);
    state.recoveryHistory.push(createRecoveryHistoryEntry(
      candidate,
      slot,
      attempt + 1,
      "ATTENTION",
      holdReason,
      action,
    ));
    if (candidate.quality.verdict !== "PASS" || candidate.quality.total < recoveryInput.qualityGateMinimum) continue;
    recoveryInput.recordAcceptedCandidate(candidate);
    recoveryInput.publishableCandidates.push({
      ...candidate,
      plannedSlot: recoveryInput.rotation[recoveryInput.publishableCandidates.length]?.slot ?? candidate.plannedSlot,
    });
  }
}

export function buildMyfansCandidateRecovery(input: MyfansCandidateRecoveryInput) {
  const state: MyfansRecoveryState = {
    initialAttempts: [],
    recoveryHistory: [],
    heldCandidates: [],
    slotOptions: [],
  };
  for (const [index, item] of input.rotation.entries()) {
    recoverRotationItem(input, state, item, index);
  }
  recoverAttentionBackfill(input, state);
  return state;
}
