import assert from "node:assert/strict";
import test from "node:test";
import { makeCandidate } from "./xPostPlannerCandidate";
import type { XPostCandidate } from "../xPostPlanner";
import type { CandidateWork, FunnelStat } from "./xPostPlannerData";
import type { XPostPriceChart } from "./xPostPlannerPriceChart";

const work: CandidateWork = {
  id: 7,
  product_id: "abc",
  title: "作品タイトル",
  actress: "女優A",
  genre: "ジャンルA,ジャンルB",
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

const chart: XPostPriceChart = {
  points: [
    { changedAt: "2026-10-01T00:00:00.000Z", price: 900 },
    { changedAt: "2026-10-20T00:00:00.000Z", price: 500 },
  ],
  previousPrice: 900,
  hadPriceDrop: true,
  seriesName: "30日系列",
  seriesPeriod: "2026-10",
  seriesMinimumPrice: 450,
  seriesMaximumPrice: 1200,
  seriesObservationCount: 4,
  seriesStartedAt: "2026-10-01T00:00:00.000Z",
  seriesLowestAt: "2026-10-05T00:00:00.000Z",
  newRecordedLowToday: false,
  isNinetyDayLow: false,
  checkedAt: "2026-10-20T00:00:00.000Z",
};

const funnel: FunnelStat = { pageViews: 2, fanzaClicks: 1, ctr: 50 };
const candidateEvaluationTime = Date.parse("2026-10-20T12:00:00.000Z");

const categoryExpectations: Array<{
  category: XPostCandidate["category"];
  label: string;
  reason: string;
  selectionReasonPrefix: string;
  creativeKind: XPostCandidate["creativeKind"];
  sourceType: XPostCandidate["sourceType"];
}> = [
  { category: "sales", label: "実績発掘", reason: "販売実績あり・¥500", selectionReasonPrefix: "実際の販売実績がある候補。30日間の作品重複を回避。", creativeKind: "discovery", sourceType: "FOLLOW_UP" },
  { category: "deal", label: "価格アラート", reason: "900円 → 500円（44%下落）", selectionReasonPrefix: "同じ販売形式・期間の履歴で値下げを確認。30日系列（2026-10）。", creativeKind: "price-chart", sourceType: "PRICE_EVENT" },
  { category: "score", label: "AI発掘", reason: "評価4.5・レビュー15件", selectionReasonPrefix: "価格・評価・人気を分析。30日間の作品重複を回避。", creativeKind: "discovery", sourceType: "FOLLOW_UP" },
  { category: "new", label: "新作発掘", reason: "発売 2026-10-01・¥500", selectionReasonPrefix: "新作候補から日付固定で分散選出。30日間の作品重複を回避。", creativeKind: "discovery", sourceType: "FOLLOW_UP" },
  { category: "hidden_gem", label: "値下げ×埋もれ名作", reason: "発掘指数43・買い時48", selectionReasonPrefix: "ランキング80位、評価4.5、レビュー15件。58%OFFで割安感がある。ランキング80位で再評価余地あり。", creativeKind: "price-chart", sourceType: "HIDDEN_GEM" },
  { category: "today_buy", label: "今日の買い時", reason: "買い時48・58%OFF・¥500", selectionReasonPrefix: "買い時スコアと価格条件で選出。58%OFFで割引幅が大きい。発売から日が浅い新作。", creativeKind: "price-chart", sourceType: "PRICE_EVENT" },
  { category: "today_discovery", label: "今日の発掘", reason: "発掘指数43・買い時48", selectionReasonPrefix: "ランキング80位、評価4.5、レビュー15件。58%OFFで割安感がある。ランキング80位で再評価余地あり。", creativeKind: "price-chart", sourceType: "HIDDEN_GEM" },
  { category: "market_scan", label: "市場メモ", reason: "58%OFF・ジャンルA", selectionReasonPrefix: "今日のセール群からジャンルA系に寄った作品を抽出。ランキング80位、評価4.5。", creativeKind: "comparison", sourceType: "MARKET" },
  { category: "comparison_pick", label: "比較メモ", reason: "58%OFF・評価4.5", selectionReasonPrefix: "同価格帯/同割引率で比較しやすい作品を抽出。ジャンルジャンルA、ランキング80位。", creativeKind: "comparison", sourceType: "COMPARISON" },
  { category: "judgment_pick", label: "見送り判断", reason: "58%OFF・評価4.5", selectionReasonPrefix: "値引きはあるが評価/レビュー/順位の押しが弱い作品を抽出。買わない判断も投稿価値として扱う。", creativeKind: "comparison", sourceType: "JUDGMENT" },
  { category: "review_gap", label: "レビューギャップ", reason: "評価4.5・レビュー15件", selectionReasonPrefix: "評価とレビュー件数/順位のズレを抽出。ランキング80位、レビュー15件。", creativeKind: "comparison", sourceType: "JUDGMENT" },
  { category: "discovery_gap", label: "発掘ギャップ", reason: "高評価×低順位・評価4.5", selectionReasonPrefix: "高評価だがランキング/PVが弱い作品を抽出。DISCOVERY_GAPとして初見ユーザー向けに使う。", creativeKind: "discovery", sourceType: "HIDDEN_GEM" },
  { category: "actress_best", label: "女優別おすすめ", reason: "女優Aのおすすめ・評価4.5・レビュー15件", selectionReasonPrefix: "女優AページのBEST10導線に使う候補。作品重複を30日間回避。", creativeKind: "discovery", sourceType: "ACTRESS_TREND" },
  { category: "genre_best", label: "ジャンル別おすすめ", reason: "ジャンルAのおすすめ・評価4.5・レビュー15件", selectionReasonPrefix: "ジャンルAページのBEST10導線に使う候補。作品重複を30日間回避。", creativeKind: "discovery", sourceType: "GENRE_TREND" },
  { category: "maker_best", label: "メーカー別おすすめ", reason: "メーカーAのおすすめ・評価4.5・レビュー15件", selectionReasonPrefix: "メーカーAページのBEST10導線に使う候補。作品重複を30日間回避。", creativeKind: "discovery", sourceType: "MAKER_TREND" },
  { category: "series_best", label: "シリーズ別おすすめ", reason: "シリーズAのおすすめ・評価4.5・レビュー15件", selectionReasonPrefix: "シリーズAページのBEST10導線に使う候補。作品重複を30日間回避。", creativeKind: "discovery", sourceType: "FOLLOW_UP" },
];

for (const expected of categoryExpectations) {
  test(`candidate presentation stays stable for ${expected.category}`, () => {
    const originalNow = Date.now;
    Date.now = () => candidateEvaluationTime;
    try {
      const candidate = makeCandidate(work, expected.category, chart, 30, funnel, []);
      assert.equal(candidate.label, expected.label);
      assert.equal(candidate.reason, expected.reason);
      assert.equal(candidate.selectionReason.split(" 直近30日X流入")[0], expected.selectionReasonPrefix);
      assert.equal(candidate.creativeKind, expected.creativeKind);
      assert.equal(candidate.sourceType, expected.sourceType);
    } finally {
      Date.now = originalNow;
    }
  });
}
