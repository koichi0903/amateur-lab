import assert from "node:assert/strict";
import test from "node:test";
import { qualityHoldReasonsFor, type QualityHoldReasonContext } from "./myfansPublicCopyQualityReasons.ts";
import type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes.ts";

const input = {
  body: "copy",
  product: {} as MyfansPublicCopyQualityInput["product"],
  postType: "",
  linkStrategy: "no_link",
  creativeStrategy: "text_only",
  quote: null,
} satisfies MyfansPublicCopyQualityInput;

const context: QualityHoldReasonContext = {
  leak: { hasLeak: false, matches: [] },
  hardFail: [],
  total: 100,
  isQuote: false,
  concreteVisualSpecificity: 30,
  verifiedVisualNotGrounded: false,
  unverifiableVisualDetail: false,
  firstLineGateFailed: true,
  discoveryFactMissing: true,
  isDiscovery: true,
  discoveryConcrete: false,
  discoveryMethodTalk: true,
  isAuthority: true,
  authorityValue: false,
  isRevenue: true,
  revenueValid: false,
  genericPhraseCount: 2,
  quoteVisualMissing: true,
  vagueReactionOnly: true,
  reportTone: true,
  reactionReview: { analystCommentaryRisk: 67, naturalUserReaction: 31 },
  analystCommentary: true,
  unnaturalReaction: true,
  sourceSimilarity: 0.8,
  sourceTextGrounded: false,
  repeatedLine: true,
  quoteAttentionMissing: false,
  abstractFallbackQuote: false,
  abstractTextOnly: false,
  role: "DISCOVERY",
  visualTextFit: 1,
};

test("quality hold reasons retain role and copy-safety message order", () => {
  assert.deepEqual(qualityHoldReasonsFor(input, context, 85), [
    "First-line curiosity gate未達",
    "discovery差なし",
    "DISCOVERYに実データ由来の一発見がありません",
    "DISCOVERYが分析行為の説明になっています",
    "AUTHORITYに編集者として何を選別したかがありません",
    "Revenue枠の正規mfco.linkまたは報酬根拠がありません",
    "汎用句が多く機械的です",
    "quote本文に照合可能な具体visual cueがありません",
    "抽象リアクションだけで終わっています",
    "quote本文が数字レポート口調です",
    "Natural reaction判定NG: analyst risk 67/100",
    "Natural reaction 31/100: 普通のXユーザーの一言として弱い",
    "元投稿本文に近すぎます",
    "本文内で同じ内容を繰り返しています",
  ]);
});
