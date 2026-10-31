import assert from "node:assert/strict";
import test from "node:test";
import { dailyPlanPostRecord, dailySnapshotRpcArgs, snapshotEvidence, summarizeCandidateOptions } from "../myfansDailySnapshot";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    body: "main copy",
    selfReply: "reply copy",
    generatorVersion: "copy-v1",
    copyInputHash: "hash-1",
    publicCopyFacts: { source: "fixture" },
    id: 25,
    optionLabel: "A",
    optionName: "おすすめ",
    optionRank: 1,
    novelty: {
      label: "new source",
      sameSourceLabel: "unused",
      lastSameSourceDate: null,
      lastSameCreatorDate: null,
      pastBodySimilarityLabel: "unique",
    },
    visualUnderstanding: {
      visualAnalysisStatus: "verified",
      analyzerVersion: "visual-v2",
      concreteVisualCue: "umbrella in the foreground",
      rawVisualEvidence: "raw evidence",
      humanObservation: "human observation",
      cueConfidence: "high",
      evidenceSource: "author reply",
      sourceEvidence: "fallback evidence",
    },
    reactionType: "curiosity",
    reactionReview: {
      naturalUserReaction: "natural reaction",
      analystCommentaryRisk: "low risk",
      sourceSpecificity: 88,
    },
    sourceSpecificityScore: 72,
    whyThisAngle: "visible scene detail",
    topicValue: { score: 84, reasonToCare: "creator-specific evidence" },
    reason: "selected for source evidence",
    quality: { total: 86, verdict: "PASS", reasons: ["visual verified"] },
    hookEvidence: { basis: "opening scene" },
    mediaPolicy: { status: "approved" },
    opportunity: {
      expectedRewardPer1000Impressions: 120,
      revenueScore: 34,
      growthScore: 75,
      creatorLtvScore: 41,
    },
    product: { id: 12 },
    rankingContextProduct: { id: 34 },
    quoteXUrl: "https://x.com/creator/status/1",
    mediaPermalink: "https://x.com/creator/status/1/photo/1",
    affiliateUrl: "https://myfans.jp/affiliate/12",
    sourceXUrl: "https://x.com/creator/status/1",
    sourceAuthorHandle: "creator",
    sourceCreator: "source creator",
    myfansCreator: "MyFans creator",
    productCreator: "product creator",
    sourceProductMatch: { matched: true },
    resolverEvidence: { confidence: "exact" },
    candidateType: "Monetizable Growth",
    monetizableStatus: "linked_affiliate_ready",
    monetizable: true,
    candidateTitle: "product title",
    plannedSlot: "slot-a",
    objective: "revenue",
    linkStrategy: "reply_link",
    postMode: "quote",
    affiliateTargetType: "product",
    affiliateTargetUrl: "https://myfans.jp/posts/example",
    affiliateConnectionStatus: "linked_affiliate_ready",
    creatorMyfansUrl: "https://myfans.jp/creator/1",
    productMyfansUrl: "https://myfans.jp/posts/example",
    sourceXStatusId: "1",
    sourceMediaType: "image",
    affiliateUrlGeneratedAt: "2026-01-01T00:00:00.000Z",
    affiliateUrlExpiresAt: "2026-02-01T00:00:00.000Z",
    affiliateUrlSource: "manual",
    creativeReason: "source-backed",
    hookLabel: "scene hook",
    attention: { score: 90 },
    recoveryHistory: [],
    productReason: "exact match",
    readerValue: "specific detail",
    stopReason: null,
    ctaRole: "reply",
    assetRole: "source_media",
    cardPayload: { version: 1 },
    dailyRole: "DISCOVERY",
    postType: "quote",
    topicIdentity: "visible-scene",
    ...overrides,
  } as unknown as Parameters<typeof snapshotEvidence>[0];
}

function board(
  history: Array<Record<string, unknown>> = [],
  quotes: Array<Record<string, unknown>> = [],
  selectedOptions: Record<string, string> = {},
  candidateOptions: Array<Record<string, unknown>> = [],
  overrides: Record<string, unknown> = {},
) {
  const quotePool = { global: quotes, funnel: {} as Record<string, unknown>, ...(overrides.quotePool as Record<string, unknown> | undefined) };
  return {
    recovery: { history },
    quotePool,
    selectedOptions,
    candidateOptions,
    ...overrides,
  } as unknown as Parameters<typeof snapshotEvidence>[1];
}

test("snapshot evidence preserves public-copy fields and matching-slot recovery history", () => {
  const recovery = [{ slot: "slot-a", id: "selected" }, { slot: "slot-b", id: "other" }];
  const result = snapshotEvidence(candidate(), board(recovery));

  assert.equal(result.public_copy.body, "main copy");
  assert.equal(result.public_copy.visual_analysis_status, "verified");
  assert.equal(result.public_copy.source_evidence, "author reply");
  assert.equal(result.public_copy.source_specificity, 88);
  assert.equal(result.public_copy.reason_to_care, "creator-specific evidence");
  assert.equal(result.internal_reasoning.why_selected, "selected for source evidence");
  assert.equal(result.internal_reasoning.estimated_reward_per_1000_impressions, 120);
  assert.equal(result.product_id, 12);
  assert.deepEqual(result.recovery_history, [recovery[0]]);
  assert.equal(result.affiliate_target_url, "https://myfans.jp/posts/example");
});

test("snapshot evidence retains the existing fallbacks for missing optional evidence", () => {
  const result = snapshotEvidence(candidate({ visualUnderstanding: null, reactionReview: null, topicValue: null, opportunity: null }), board());

  assert.equal(result.public_copy.visual_analysis_status, "unavailable");
  assert.equal(result.public_copy.analyzer_version, null);
  assert.equal(result.public_copy.extracted_visual_cue, "");
  assert.equal(result.public_copy.confidence, "low");
  assert.equal(result.public_copy.source_evidence, "");
  assert.equal(result.public_copy.natural_user_reaction, null);
  assert.equal(result.public_copy.source_specificity, 72);
  assert.equal(result.public_copy.reason_to_care, null);
  assert.equal(result.internal_reasoning.estimated_reward_per_1000_impressions, null);
});

test("daily post record retains exact-source linkage and selected option metadata", () => {
  const row = { candidate: { id: 77, x_post_url: "https://x.com/creator/status/1", media_permalink: "" } };
  const post = candidate({
    role: "DISCOVERY",
    audienceIntent: "new readers",
    hookType: "curiosity",
    creativeStrategy: "quote_post",
    quality: { total: 86, verdict: "PASS", reasons: ["verified source"] },
    optionLabel: "B",
    optionName: "別案",
    optionRank: 2,
    novelty: { label: "new source" },
  });
  const record = dailyPlanPostRecord(5, board([], [row], { "2": "B" }), post, 1, post);

  assert.equal(record.daily_plan_id, 5);
  assert.equal(record.product_id, 12);
  assert.equal(record.quote_candidate_id, 77);
  assert.equal(record.post_order, 2);
  assert.equal(record.post_role, "DISCOVERY");
  assert.equal(record.quality_score, 86);
  assert.equal(record.quality_verdict, "PASS");
  assert.equal(record.option_label, "B");
  assert.equal(record.option_name, "別案");
  assert.equal(record.option_rank, 2);
  assert.equal(record.is_selected, true);
  assert.equal(Number.isNaN(Date.parse(record.selected_at ?? "")), false);
  assert.deepEqual(record.novelty_json, { label: "new source" });
});

test("daily post record excludes unlinked products and keeps fallback option values", () => {
  for (const overrides of [
    { monetizableStatus: "unlinked" },
    { sourceProductMatch: { matched: false } },
  ]) {
    const record = dailyPlanPostRecord(5, board(), candidate(overrides), 0);
    assert.equal(record.product_id, null);
    assert.equal(record.quote_candidate_id, null);
    assert.equal(record.option_label, "A");
    assert.equal(record.option_name, "おすすめ");
    assert.equal(record.option_rank, 1);
    assert.equal(record.is_selected, true);
    assert.equal(record.selected_at, null);
    assert.deepEqual(record.novelty_json, {});
  }
});

test("candidate option summaries retain recommendation, product, evidence, and novelty fields", () => {
  const source = candidate();
  const slot = { slot: "slot-a", postOrder: 1, recommendedOption: "A", candidates: [source] };
  const [summary] = summarizeCandidateOptions(board([], [], {}, [slot]));
  const [item] = summary.candidates;

  assert.equal(summary.slot, "slot-a");
  assert.equal(summary.post_order, 1);
  assert.equal(summary.recommended_option, "A");
  assert.equal(item.id, 25);
  assert.equal(item.product_id, 12);
  assert.equal(item.product_title, "");
  assert.equal(item.affiliate_status, "saved");
  assert.equal(item.reason_to_care, "creator-specific evidence");
  assert.equal(item.visual_status, "verified");
  assert.equal(item.visual_evidence, "human observation");
  assert.equal(item.quality, 86);
  assert.equal(item.topic_value, 84);
  assert.equal(item.novelty_label, "new source");
  assert.equal(item.same_source_status, "unused");
  assert.equal(item.last_same_source_date, null);
  assert.equal(item.last_same_creator_date, null);
  assert.equal(item.past_body_similarity_label, "unique");
});

test("candidate option summaries retain null and missing-value defaults", () => {
  const source = candidate({ product: null, topicValue: null, visualUnderstanding: null, novelty: null, affiliateUrl: "" });
  const [summary] = summarizeCandidateOptions(board([], [], {}, [{ slot: "slot-b", postOrder: 2, recommendedOption: "B", candidates: [source] }]));
  const [item] = summary.candidates;

  assert.equal(item.product_id, null);
  assert.equal(item.ranking_context_product_id, 34);
  assert.equal(item.product_title, "");
  assert.equal(item.affiliate_status, "missing");
  assert.equal(item.reason_to_care, null);
  assert.equal(item.visual_status, "unavailable");
  assert.equal(item.visual_evidence, "");
  assert.equal(item.topic_value, null);
  assert.equal(item.novelty_label, null);
  assert.equal(item.last_same_source_date, null);
});

test("snapshot RPC payload keeps posts, first-ten attention, and deduplicated linkage rows", () => {
  const exactLinkage = {
    source_status_url: "https://x.com/creator/status/1",
    source_author_handle: "creator",
    discovered_myfans_url: "https://myfans.jp/posts/example",
    final_myfans_url: "https://myfans.jp/posts/example",
    product_id: 12,
    resolution_method: "exact_product_url",
    confidence: "exact",
    evidence_source: "author_post",
    verified_at: "2026-01-01T00:00:00.000Z",
    metadata: { winner: "candidate option" },
  };
  const diagnosticLinkage = { ...exactLinkage, source_status_url: "https://x.com/creator/status/2", diagnostic_mode: true };
  const sourceCandidate = candidate({ resolverEvidence: exactLinkage });
  const optionCandidate = candidate({ resolverEvidence: { ...exactLinkage, metadata: { winner: "candidate option" } } });
  const diagnosticCandidate = candidate({ resolverEvidence: diagnosticLinkage });
  const attentionRows = Array.from({ length: 11 }, (_, index) => ({
    globalScore: 90 - index,
    candidate: {
      id: index + 1,
      product_id: 12,
      score: 80 - index,
      quote_visual_ready: true,
      visual_render_status: "browser_visible",
      media_type: "image",
      media_permalink: `https://x.com/creator/status/${index + 1}/photo/1`,
      views: 1000,
      likes: 100,
      reposts: 5,
      replies: 2,
      creator_rank: 1,
      score_reason: "fixture",
    },
  }));
  const options = [{ slot: "slot-a", postOrder: 1, recommendedOption: "A", candidates: [optionCandidate, diagnosticCandidate] }];
  const data = board(
    [],
    attentionRows,
    { "1": "A" },
    options,
    {
      candidates: [sourceCandidate],
      planDate: "2026-10-29",
      planKey: "plan-key",
      day: "day-1",
      stage: "growth",
      strategy: { title: "strategy" },
      todayStrategy: { title: "today" },
      bottleneck: { stage: "reach" },
      profileFunnel: { visits: 5 },
      learning: { note: "learning" },
      outboundTasks: [{ type: "reply", targetUrl: "https://x.com/creator", reason: "source", suggestedText: "reply" }],
      heldCandidates: [{ id: "held" }],
      recovery: { history: [] },
      supplyAudit: { status: "ready" },
      linkedCandidateFunnel: { total: 1 },
      topicValue: { funnel: { selected: 1 }, top10: [{ id: 12 }] },
      quotePool: { funnel: { collected: 11 }, global: attentionRows },
    },
  );

  const payload = dailySnapshotRpcArgs(data, 5, "2026-10-29T00:00:00.000Z");
  assert.equal(payload.p_plan.approved_media_id, 5);
  assert.equal(payload.p_plan.plan_date, "2026-10-29");
  assert.equal(payload.p_plan.strategy_json.day, "day-1");
  assert.deepEqual(payload.p_plan.strategy_json.daily_option_selection, { "1": "A" });
  assert.equal(payload.p_posts.length, 2);
  assert.equal("daily_plan_id" in payload.p_posts[0], false);
  assert.equal(payload.p_attention.length, 10);
  assert.equal(payload.p_attention[0].quote_candidate_id, 1);
  assert.deepEqual(payload.p_linkage, [{
    approved_media_id: null,
    quote_candidate_id: null,
    source_status_url: exactLinkage.source_status_url,
    source_author_handle: exactLinkage.source_author_handle,
    discovered_myfans_url: exactLinkage.discovered_myfans_url,
    final_myfans_url: exactLinkage.final_myfans_url,
    product_id: exactLinkage.product_id,
    resolution_method: exactLinkage.resolution_method,
    confidence: exactLinkage.confidence,
    evidence_source: exactLinkage.evidence_source,
    verified_at: exactLinkage.verified_at,
    metadata: exactLinkage.metadata,
  }]);
  assert.deepEqual(payload.p_outbound, [{ task_type: "reply", target_url: "https://x.com/creator", reason: "source", suggested_text: "reply" }]);
  assert.deepEqual(payload.p_audit, { status: "ready" });
});
