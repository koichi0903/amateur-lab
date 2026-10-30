import assert from "node:assert/strict";
import test from "node:test";
import { makeCandidate } from "./xPostPlannerCandidate";
import type { CandidateWork } from "./xPostPlannerData";
import { withCreativeQuality } from "./xGrowthCreativeQuality";
import { scoreOpportunity } from "./xGrowthOpportunityScoring";

const sampleMovieUrl = "https://cc3001.dmm.co.jp/sample/quality-fixture.mp4";
const work: CandidateWork = {
  id: 701,
  product_id: "quality-fixture",
  title: "品質確認作品",
  actress: "女優A",
  genre: "ジャンルA",
  maker: "メーカーA",
  series: null,
  score: 80,
  price: 1000,
  sale_price: 500,
  list_price: 1200,
  discount_rate: 50,
  review_average: 4.5,
  review_count: 30,
  ranking: 40,
  lowest_price: 450,
  is_bottom_price: false,
  release_date: "2026-10-01",
  image_url: "https://pics.dmm.co.jp/digital/video/quality/qualitypl.jpg",
  stage: null,
  is_on_sale: true,
  sale_end_at: "2099-12-31T00:00:00.000Z",
  sample_movie_url: sampleMovieUrl,
};

test("official sample movie and real work image remain available as creative variants", () => {
  const candidate = makeCandidate(work, "sales", null, 30, { pageViews: 0, fanzaClicks: 0, ctr: 0 }, []);
  const opportunity = scoreOpportunity(candidate);
  assert.deepEqual(
    [opportunity.reachScore, opportunity.followScore, opportunity.authorityScore, opportunity.revenueScore],
    [70, 66, 64, 44],
  );
  assert.equal(opportunity.intent, "FOLLOW");
  assert.equal(opportunity.mediaType, "sample_movie");
  assert.deepEqual(
    [opportunity.freshness.opportunityScore, opportunity.freshness.saleScore, opportunity.freshness.priceChangeScore, opportunity.freshness.rankingVelocityScore, opportunity.freshness.total, opportunity.freshness.status],
    [92, 35, 92, 58, 73, "fresh"],
  );
  assert.deepEqual(opportunity.creativeGenome, {
    topic: "price_anomaly",
    intent: "FOLLOW",
    hook: "price_anomaly",
    proof: "review",
    structure: "story_first",
    emotion: "curiosity",
    length: "short",
    media: "sample_movie",
    cta: "reason_cta",
    linkStrategy: "no_link_or_profile",
    postingSlot: "lunch",
  });
  const result = withCreativeQuality({
    ...opportunity,
    canNativeVideo: true,
    mediaAsset: {
      source_url: sampleMovieUrl,
      source_kind: "official_sample",
      fetch_status: "ok",
      fetch_status_code: 200,
      mime_type: "video/mp4",
      content_length: 4096,
      media_quality: "unreviewed",
      manual_tags: [],
    },
  }, []);

  assert.ok(result.creativeVariants.some((variant) => variant.mediaType === "sample_movie"));
  assert.ok(result.creativeVariants.some((variant) => variant.mediaType === "existing_link_image"));
});
