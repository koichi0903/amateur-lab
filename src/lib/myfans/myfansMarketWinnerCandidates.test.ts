import test from "node:test";
import assert from "node:assert/strict";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "../myfansAnalytics";
import {
  buildMarketWinnerCandidateRows,
  mapSavedMarketWinnerOpportunities,
  type MarketWinnerPatternRow,
} from "./myfansMarketWinnerCandidates";

const quote = {
  id: 9,
  approved_media_id: 1,
  creator_id: 20,
  product_id: 10,
  source_x_handle: "@creator",
  x_post_url: "https://x.com/creator/status/9",
  text_excerpt: "期間限定の価格を比較しました",
  views: 200_000,
  likes: 100,
  reposts: 20,
  score: 60,
  global_score: 70,
  creator_rank: 10,
  media_permalink: null,
} as MyfansQuoteCandidate;

const product = {
  id: 10,
  creator_id: 20,
  title: "人気商品",
  price: 500,
  selection_score: 80,
  is_new: true,
  likes_count: 1_000,
} as MyfansProduct;

const analytics = {
  quoteCandidates: [quote],
  products: [product],
  creators: [{ id: 20, display_name: "Creator Name" }],
} as MyfansAnalytics;

const pattern: MarketWinnerPatternRow = {
  id: 3,
  pattern_key: "PRICE_DROP",
  name: "価格訴求",
  objective_compatibility: ["click"],
  initial_weight: 1,
  metadata: { prior: "observed" },
};

test("candidate generation preserves scoring, learning, link strategy, and creator display", () => {
  const [row] = buildMarketWinnerCandidateRows(analytics, [pattern], [], [{
    pattern_id: 3,
    quote_candidate_id: 9,
    product_id: 10,
    posterior_weight: 1.5,
  }]);

  assert.equal(row.opportunity.winnerScore, 88.6);
  assert.equal(row.opportunity.scoreComponents.productOpportunity, 78);
  assert.equal(row.opportunity.scoreComponents.creatorStrength, 100);
  assert.equal(row.opportunity.scoreComponents.learningWeight, 1.5);
  assert.equal(row.opportunity.creatorName, "Creator Name");
  assert.equal(row.opportunity.explanation.link_strategy, "reply_link");
  assert.equal(row.opportunity.explanation.prior_type, "observed");
  assert.equal(row.payload, row.opportunity.explanation);
});

test("candidate generation ignores quotes without URLs and keeps the top-40 order", () => {
  const manyQuotes = Array.from({ length: 42 }, (_, index) => ({
    ...quote,
    id: index + 1,
    x_post_url: index === 0 ? "" : `https://x.com/creator/status/${index + 1}`,
    global_score: 100 - index,
  })) as MyfansQuoteCandidate[];
  const rows = buildMarketWinnerCandidateRows({ ...analytics, quoteCandidates: manyQuotes }, [pattern], [], []);

  assert.equal(rows.length, 40);
  assert.equal(rows[0].opportunity.sourceXUrl, "https://x.com/creator/status/2");
  assert.equal(rows.at(-1)?.opportunity.sourceXUrl, "https://x.com/creator/status/41");
});

test("saved opportunities map persisted IDs and use fallbacks for missing relations", () => {
  const [mapped] = mapSavedMarketWinnerOpportunities([{
    id: 44,
    pattern_id: 3,
    quote_candidate_id: 9,
    product_id: 10,
    creator_id: 20,
    source_x_url: quote.x_post_url,
    winner_score: 90.6,
    score_components: {
      patternFit: 85,
      sourceStrength: 70,
      productOpportunity: 88,
      creatorStrength: 100,
      learningWeight: 1.5,
      guardPenalty: 0,
    },
    explanation: { source_excerpt: "保存済み抜粋" },
    status: "candidate",
  }], [pattern], analytics);

  assert.equal(mapped.id, 44);
  assert.equal(mapped.patternName, "価格訴求");
  assert.equal(mapped.sourceExcerpt, "保存済み抜粋");
  assert.equal(mapped.productTitle, "人気商品");
  assert.equal(mapped.creatorName, "Creator Name");
  assert.deepEqual(mapped.guard, { blocked: false, penalty: 0, reasons: [] });
});
