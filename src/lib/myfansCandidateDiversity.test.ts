import assert from "node:assert/strict";
import { evaluateMyfansCandidateDiversity } from "@/lib/myfansCandidateDiversity";
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

console.log("myfansCandidateDiversity tests passed");
