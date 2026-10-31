import assert from "node:assert/strict";
import test from "node:test";
import { assembleXPostCandidatesFromSelections } from "../xPostPlanner";
import type { CandidateWork, FunnelStat, PriceHistoryRow } from "./xPostPlannerData";

const work: CandidateWork = {
  id: 7,
  product_id: "abc",
  title: "作品タイトル",
  actress: "女優A",
  genre: "ジャンルA",
  maker: "メーカーA",
  series: "シリーズA",
  score: 45,
  price: 1000,
  sale_price: 500,
  list_price: 1200,
  discount_rate: 50,
  review_average: 4.5,
  review_count: 15,
  ranking: 80,
  lowest_price: 450,
  is_bottom_price: false,
  release_date: "2026-10-01",
  image_url: "https://example.invalid/image.jpg",
  stage: null,
  is_on_sale: true,
  sale_end_at: "2099-12-31T00:00:00.000Z",
  sample_movie_url: "https://cc3001.dmm.co.jp/sample/7.mp4",
};

const funnel: FunnelStat = { pageViews: 0, fanzaClicks: 0, ctr: 0 };
const decisionSupply = {
  RECORD_LOW: emptyDecisionSupply(),
  HIGH_DISCOUNT_NOT_LOW: emptyDecisionSupply(),
  HIDDEN_VALUE: emptyDecisionSupply(),
};

function emptyDecisionSupply() {
  return {
    dbFetchedWorks: 0,
    dbRawWorks: 0,
    afterPostedCooldown: 0,
    chartEligible: 0,
    uniqueWorks: 0,
    creativeVariants: 0,
    qualityEligible: 0,
    selected: 0,
    persisted: 0,
    firstDropReasonCounts: {},
    firstDropByWorkId: {},
  };
}

function history(previousPrice: number): PriceHistoryRow[] {
  return [
    { product_id: "abc", changed_at: "2026-10-10T00:00:00.000Z", display_name: "30日系列", period: "2026-10", normal_price: previousPrice, sale_price: null },
    { product_id: "abc", changed_at: "2026-10-20T00:00:00.000Z", display_name: "30日系列", period: "2026-10", normal_price: 500, sale_price: null },
  ];
}

function assemble(options: {
  rows?: PriceHistoryRow[];
  videoWorks?: CandidateWork[];
  postedIds?: ReadonlySet<number>;
}) {
  return assembleXPostCandidatesFromSelections({
    videoSupplyWorks: options.videoWorks ?? [],
    saleVideoWorkIds: new Set(),
    selectedGroups: [{ category: "deal", decisionType: null, selected: [work], cooldownDays: 14 }],
    postedWorkIds: options.postedIds ?? new Set(),
    logs: [],
    decisionSupply,
    rowsByProduct: new Map([["abc", options.rows ?? history(900)]]),
    funnels: new Map([[work.id, funnel]]),
  });
}

test("deal candidates require a price drop in the matching price-history series", () => {
  assert.deepEqual(assemble({ rows: history(500) }), []);
  assert.deepEqual(assemble({ rows: history(900) }).map((candidate) => candidate.workId), [work.id]);
});

test("posted works are excluded and video candidates deduplicate selected groups", () => {
  assert.deepEqual(assemble({ videoWorks: [work], postedIds: new Set([work.id]) }), []);

  const candidates = assemble({ videoWorks: [work] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.category, "comparison_pick");
});
