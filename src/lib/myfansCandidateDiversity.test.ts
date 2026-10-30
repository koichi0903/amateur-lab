import assert from "node:assert/strict";
import { evaluateMyfansCandidateDiversity, recordAcceptedMyfansCandidate } from "@/lib/myfansCandidateDiversity";
import type { MyfansCandidateDiversityContext, MyfansCandidateForDiversity } from "@/lib/myfansXExecution";

const passingReason = "公開可能な具体性と根拠があります";

function makeCandidate(overrides: Partial<MyfansCandidateForDiversity> = {}): MyfansCandidateForDiversity {
  return {
    id: "candidate-1",
    body: "週末にゆっくり見たい内容がまとまっています",
    selfReply: "",
    quality: { verdict: "PASS", total: 92, reasons: [passingReason] } as MyfansCandidateForDiversity["quality"],
    product: null,
    quoteCandidateId: null,
    quoteXUrl: "",
    sourceXUrl: "https://x.com/creator/status/10",
    topicIdentity: "product:1:discovery",
    topicSemanticKey: "product:1:discovery",
    dailyRole: "DISCOVERY",
    creativeStrategy: "discovery",
    sourceSpecificityScore: 0,
    reactionType: null,
    reasonToCare: null,
    ...overrides,
  } as MyfansCandidateForDiversity;
}

function makeContext(overrides: Partial<MyfansCandidateDiversityContext> = {}): MyfansCandidateDiversityContext {
  return {
    acceptedBodies: [],
    acceptedCreatorCounts: new Map(),
    acceptedQuoteCreators: new Set(),
    acceptedReactionTypes: new Set(),
    acceptedReasonCounts: new Map(),
    acceptedTopicIdentities: new Set(),
    acceptedTopicSemanticKeys: [],
    analytics: { quoteCandidates: [] } as unknown as MyfansCandidateDiversityContext["analytics"],
    creatorKeyForCandidateSource: () => "creator:1",
    pastUsage: {
      latestSource: () => null,
      latestCreator: () => null,
      latestTopic: () => null,
      latestBody: () => null,
    } as unknown as MyfansCandidateDiversityContext["pastUsage"],
    permanentExclusionSets: { productIds: new Set(), sourceKeys: new Set(), quoteCandidateIds: new Set() } as MyfansCandidateDiversityContext["permanentExclusionSets"],
    planDate: "2026-10-29",
    publishableCandidates: [],
    minimumSelectedCount: 1,
    minimumDailyAverageQuality: 90,
    ...overrides,
  };
}

const sourceCooldownCandidate = makeCandidate({ quoteXUrl: "https://x.com/creator/status/10" });
const sourceCooldownContext = makeContext({
  pastUsage: {
    latestSource: () => ({ date: "2026-10-28", actualPosted: true }),
    latestCreator: () => null,
    latestTopic: () => null,
    latestBody: () => null,
  } as unknown as MyfansCandidateDiversityContext["pastUsage"],
});
const sourceCooldown = evaluateMyfansCandidateDiversity(sourceCooldownCandidate, sourceCooldownContext);
assert.equal(sourceCooldown.quality.verdict, "HOLD");
assert.deepEqual(sourceCooldown.quality.reasons, [
  "実投稿済みsourceは7日cooldown: last 2026-10-28",
  "前日までに選択済みsourceはsoft cooldown: last 2026-10-28",
]);

const averageGuard = evaluateMyfansCandidateDiversity(makeCandidate({ quality: { verdict: "PASS", total: 80, reasons: [passingReason] } as MyfansCandidateForDiversity["quality"] }), makeContext({
  publishableCandidates: [{ dailyRole: "ATTENTION", quality: { total: 90 } as MyfansCandidateForDiversity["quality"] } as MyfansCandidateForDiversity],
}));
assert.equal(averageGuard.quality.verdict, "HOLD");
assert.deepEqual(averageGuard.quality.reasons, ["日次平均Quality 90未満になるためHOLD"]);

const product = { id: 1 } as NonNullable<MyfansCandidateForDiversity["product"]>;
const productScopedCandidate = makeCandidate({ product });
const duplicateProductResult = evaluateMyfansCandidateDiversity(productScopedCandidate, makeContext({
  publishableCandidates: [makeCandidate({ product })],
}));
assert.ok(duplicateProductResult.quality.reasons.includes("同じproductは日次planで1回までです"));

const quoteCandidate = makeCandidate({
  product,
  creativeStrategy: "quote_post",
  quoteXUrl: "https://x.com/creator/status/20",
  topicIdentity: "quote:post-20",
  sourceSpecificityScore: 60,
});
const quoteProductException = evaluateMyfansCandidateDiversity(quoteCandidate, makeContext({
  publishableCandidates: [makeCandidate({ product, dailyRole: "REVENUE" })],
}));
assert.equal(quoteProductException.quality.verdict, "PASS");

const cappedReason = "clear_comparison" as const;
const cappedCandidate = makeCandidate({ product, reasonToCare: cappedReason });
const cappedResult = evaluateMyfansCandidateDiversity(cappedCandidate, makeContext({
  acceptedCreatorCounts: new Map([["creator:1", 4]]),
  acceptedReasonCounts: new Map([[cappedReason, 3]]),
}));
assert.deepEqual(cappedResult.quality.reasons, [
  "同じcreatorは日次planで最大4本までです",
  "同じreason_to_care clear_comparison は最大3本までです",
]);

const authorityHold = evaluateMyfansCandidateDiversity(makeCandidate({
  dailyRole: "AUTHORITY",
  topicIdentity: "product:1:authority",
}), makeContext());
assert.deepEqual(authorityHold.quality.reasons, [
  "AUTHORITYは単一source/topicの言い換えでは採用しません",
]);

const authorityAggregate = evaluateMyfansCandidateDiversity(makeCandidate({
  dailyRole: "AUTHORITY",
  topicIdentity: "aggregate:comparison",
}), makeContext());
assert.equal(authorityAggregate.quality.verdict, "PASS");

const weakQuote = evaluateMyfansCandidateDiversity(makeCandidate({
  creativeStrategy: "quote_post",
  sourceSpecificityScore: 34,
  sourceXUrl: "",
}), makeContext());
assert.deepEqual(weakQuote.quality.reasons, [
  "source_specificity_score 34/100: 元投稿固有要素が不足しています",
  "sourceXUrlがないquote candidateはHard failです",
]);

const quoteUrl = "https://x.com/creator/status/20";
const matchedQuote = {
  id: 20,
  creator_id: 9,
  creator_x_url: "https://x.com/other_creator",
  x_post_url: quoteUrl,
} as MyfansCandidateDiversityContext["analytics"]["quoteCandidates"][number];
const usedQuote = evaluateMyfansCandidateDiversity(makeCandidate({
  creativeStrategy: "quote_post",
  product: { id: 1, creator_id: 7 } as NonNullable<MyfansCandidateForDiversity["product"]>,
  quoteXUrl: quoteUrl,
  topicIdentity: "quote:20",
  sourceSpecificityScore: 60,
  reactionType: "agreement",
}), makeContext({
  analytics: { quoteCandidates: [matchedQuote] } as unknown as MyfansCandidateDiversityContext["analytics"],
  acceptedQuoteCreators: new Set(["creator:9"]),
  acceptedReactionTypes: new Set(["agreement"]),
}));
assert.deepEqual(usedQuote.quality.reasons, [
  "同日の公開planでは同一creator quoteを1件までに制限しています",
  "同日のquote reaction typeが重複しています",
]);

const roleCap = evaluateMyfansCandidateDiversity(makeCandidate(), makeContext({
  publishableCandidates: Array.from({ length: 4 }, () => makeCandidate({
    quality: { verdict: "PASS", total: 90, reasons: [passingReason] } as MyfansCandidateForDiversity["quality"],
  })),
}));
assert.deepEqual(roleCap.quality.reasons, ["同じrole DISCOVERY は1日4本までです"]);

const recordedCandidate = evaluateMyfansCandidateDiversity(makeCandidate({
  id: "recorded-candidate",
  body: "記録する本文です",
  product: { id: 31, creator_id: 7 } as NonNullable<MyfansCandidateForDiversity["product"]>,
  topicIdentity: "quote:20",
  topicSemanticKey: "quote:event:20",
  reasonToCare: cappedReason,
  creativeStrategy: "quote_post",
  quoteXUrl: quoteUrl,
  sourceSpecificityScore: 60,
  reactionType: "agreement",
}), makeContext());
const acceptedRecordContext = makeContext({
  analytics: { quoteCandidates: [matchedQuote] } as unknown as MyfansCandidateDiversityContext["analytics"],
  creatorKeyForCandidateSource: () => "creator:accepted",
});
const usedProductIds = new Set<number>();
recordAcceptedMyfansCandidate(recordedCandidate, acceptedRecordContext, usedProductIds, false);
assert.deepEqual([...usedProductIds], [31]);
assert.deepEqual(acceptedRecordContext.acceptedBodies, ["記録する本文です"]);
assert.deepEqual([...acceptedRecordContext.acceptedTopicIdentities], ["quote:20"]);
assert.deepEqual(acceptedRecordContext.acceptedTopicSemanticKeys, ["quote:event:20"]);
assert.deepEqual([...acceptedRecordContext.acceptedReasonCounts], [[cappedReason, 1]]);
assert.deepEqual([...acceptedRecordContext.acceptedCreatorCounts], [["creator:accepted", 1]]);
assert.deepEqual([...acceptedRecordContext.acceptedQuoteCreators], ["creator:9"]);
assert.deepEqual([...acceptedRecordContext.acceptedReactionTypes], ["agreement"]);

const crossRoleProductIds = new Set<number>();
recordAcceptedMyfansCandidate(recordedCandidate, makeContext(), crossRoleProductIds, true);
assert.deepEqual([...crossRoleProductIds], []);

console.log("myfansCandidateDiversity tests passed");
