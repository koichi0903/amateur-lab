import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { MyfansSourceValue } from "@/lib/myfansSourceValue";
import { buildMyfansSupplyAudit } from "./myfansSupplyAudit";

function quote(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    x_post_url: `https://x.com/creator/status/${id}`,
    media_permalink: `https://x.com/creator/status/${id}/photo/1`,
    source_x_handle: "creator",
    product_id: 23,
    posted_at: "2026-10-26T00:00:00.000Z",
    collected_at: "2026-10-26T00:00:00.000Z",
    is_repost: false,
    last_used_at: null,
    cooldown_until: null,
    score: 90,
    views: 10,
    ...overrides,
  } as unknown as MyfansQuoteCandidate;
}

const sourceValue: MyfansSourceValue = {
  score: 82,
  verdict: "PASS",
  sourceSpecificity: 80,
  reactionAngles: ["curiosity"],
  reasons: ["fresh source"],
  breakdown: {
    concreteSubjectEvent: 16,
    reactionAffordance: 16,
    selfContainedContext: 14,
    noveltyFreshness: 16,
    evidenceRichness: 12,
    downstreamFit: 12,
    spamPromoPenalty: 0,
    ambiguityPenalty: 0,
  },
};

test("supply audit preserves stage outcomes and groups recovery/selection by slot", () => {
  const audit = buildMyfansSupplyAudit({
    sourceRows: [quote(1), quote(2, { is_repost: true })],
    topicRows: [{
      productId: 23,
      quoteCandidateId: 1,
      role: "DISCOVERY",
      sourceCandidate: "https://x.com/creator/status/1",
      topicValue: { verdict: "LOW_TOPIC_VALUE", score: 62, reasonToCare: null, whyRejected: ["差分が弱い"] },
    }],
    recoveryHistory: [{
      candidateId: "candidate-held",
      quoteCandidateId: 1,
      slot: "slot-1",
      verdict: "HOLD",
      score: 80,
      holdReason: "duplicate similarity",
      qualityReasons: ["same topic"],
      recoveryAction: "別topicへ切替",
      productId: 23,
      recoveryRole: "DISCOVERY",
    }],
    finalPublishableCandidates: [{
      id: "candidate-selected",
      quoteXUrl: "https://x.com/creator/status/1",
      sourceXUrl: "https://x.com/creator/status/1",
      plannedSlot: "slot-1",
      quality: { total: 92 },
      sourceAuthorHandle: "creator",
      product: null,
      dailyRole: "DISCOVERY",
    }],
    rotation: [{ slot: "slot-1" }, { slot: "slot-2" }],
    planDate: "2026-10-27",
    pastUsage: { latestSource: () => null },
    helpers: {
      sourceValueForQuote: () => sourceValue,
      daysSinceIsoAtPlanDate: () => 1,
      quoteUrlFromCandidate: (candidate) => candidate.media_permalink ?? "",
      visualPriority: () => 1,
      topicThresholdFor: () => 75,
      dailyFreshDays: 14,
      postedSourceCooldownDays: 7,
      quoteMinScore: 50,
      qualityGateMinimum: 85,
    },
  });

  assert.deepEqual(audit.stages.find((row) => row.stage === "freshness_cooldown"), {
    stage: "freshness_cooldown",
    input: 2,
    passed: 1,
    rejected: 1,
    unique_candidates: 2,
    unique_passed: 1,
    top_reasons: [
      { reason_code: "FRESH_COOLDOWN_PASS", count: 1 },
      { reason_code: "REPOST_SOURCE", count: 1 },
    ],
  });
  assert.equal(audit.rows.find((row) => row.stage === "duplicate_similarity")?.status, "rejected");
  assert.equal(audit.rows.find((row) => row.stage === "topic_value")?.reason_code, "LOW_TOPIC_VALUE");
  assert.equal(audit.by_slot[0]?.counts.find((row) => row.stage === "selected")?.passed, 1);
  assert.equal(audit.by_slot[1]?.counts.find((row) => row.stage === "selected")?.input, 0);
});
