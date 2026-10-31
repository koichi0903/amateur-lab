import assert from "node:assert/strict";
import { evaluateMyfansCandidateNovelty, myfansBodySimilarity, type MyfansCandidateNoveltyInput, type MyfansNoveltyCandidate } from "./myfansCandidateNovelty";
import type { MyfansAnalytics } from "../myfansAnalytics";

const candidate: MyfansNoveltyCandidate = {
  body: "新作の雰囲気を見てから決めたい",
  quoteXUrl: "https://x.com/creator/status/10",
  sourceXUrl: "https://x.com/creator/status/10",
  topicIdentity: "quote:10",
  topicSemanticKey: "creator:1:comparison",
  product: {
    id: 99,
  } as MyfansNoveltyCandidate["product"],
  postType: "comparison_review",
  creativeStrategy: "quote_post",
};

const unusedHistory = {
  latestSource: () => null,
  latestCreator: () => null,
  latestTopic: () => null,
};

function makeInput(overrides: Partial<MyfansCandidateNoveltyInput> = {}): MyfansCandidateNoveltyInput {
  return {
    posts: [],
    pastUsage: unusedHistory,
    planDate: "2026-10-27",
    postedSourceCooldownDays: 7,
    creatorKeyForCandidateSource: () => "creator:1",
    ...overrides,
  };
}

function makePost(overrides: Partial<MyfansAnalytics["posts"][number]> = {}): MyfansAnalytics["posts"][number] {
  return {
    id: 31,
    product_id: 99,
    post_type: "comparison_review",
    status: "posted",
    body: "山道を歩いて休日を過ごした記録",
    creative_strategy: "quote_post",
    self_reply: "",
    includes_pr: false,
    source_x_url: "https://x.com/creator/status/11",
    affiliate_url: "",
    selection_reason: "",
    scheduled_at: null,
    posted_at: "2026-10-24T00:00:00.000Z",
    x_post_url: "https://x.com/account/status/31",
    impressions: 0,
    likes_count: 0,
    reposts_count: 0,
    replies_count: 0,
    created_at: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

assert.equal(myfansBodySimilarity("新作 100%off https://x.com/post/1", "新作　100％OFF"), 1);
assert.equal(myfansBodySimilarity("", "作品を見てみる"), 0);

const fresh = evaluateMyfansCandidateNovelty(candidate, makeInput());
assert.equal(fresh.verdict, "fresh");
assert.equal(fresh.maxPastSimilarity, 0);

const repeatedTopic = evaluateMyfansCandidateNovelty(candidate, makeInput({ posts: [makePost()] }));
assert.equal(repeatedTopic.verdict, "near");
assert.equal(repeatedTopic.sameTopicPastCount, 1);

const repeatedCopy = evaluateMyfansCandidateNovelty(candidate, makeInput({
  posts: [makePost({ body: candidate.body })],
}));
assert.equal(repeatedCopy.verdict, "blocked");
assert.equal(repeatedCopy.maxPastSimilarity, 1);
assert.equal(repeatedCopy.nearestPastPostId, 31);
assert.equal(repeatedCopy.pastBodySimilarityLabel, "高");

const repeatedSource = evaluateMyfansCandidateNovelty(candidate, makeInput({
  posts: [makePost({ quote_x_url: candidate.quoteXUrl })],
}));
assert.equal(repeatedSource.verdict, "blocked");
assert.equal(repeatedSource.sameSourcePastCount, 1);

const recentSource = evaluateMyfansCandidateNovelty(candidate, makeInput({
  pastUsage: {
    latestSource: () => ({ date: "2026-10-23" }),
    latestCreator: () => ({ date: "2026-10-20" }),
    latestTopic: () => null,
  },
}));
assert.equal(recentSource.verdict, "blocked");
assert.equal(recentSource.sameSourceLabel, "7日以内使用済み");
assert.equal(recentSource.lastSameCreatorDate, "2026-10-20");

console.log("myfansCandidateNovelty tests passed");
