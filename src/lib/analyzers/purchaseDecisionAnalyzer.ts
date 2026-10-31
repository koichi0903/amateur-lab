import type { PriceRecord } from "./recommendAnalyzer";
import { parseRuntimeMinutes } from "@/lib/runtimeMinutes";

type PurchaseDecisionWork = {
  review_average: number | null;
  review_count: number | null;
  discount_rate: number | null;
  duration: number | string | null;
  sale_end_at?: string | null;
  sample_movie_url?: string | null;
};

export type PurchaseDecisionEvidence = {
  label: string;
  value: string;
  detail: string;
};

export type PurchaseDecision = {
  verdict: string;
  summary: string;
  evidence: PurchaseDecisionEvidence[];
  suitedFor: string[];
  cautions: string[];
};

export type PurchaseDecisionInput = {
  work: PurchaseDecisionWork;
  currentPrice: PriceRecord;
  priceHistory?: PriceRecord[];
  offerCount?: number;
  mainActress?: string;
  mainGenre?: string;
  mainSeries?: string;
};

const effectivePrice = (price: PriceRecord): number | null => {
  const value = price.sale_price && price.sale_price > 0
    ? price.sale_price
    : price.normal_price;
  return typeof value === "number" && value > 0 ? value : null;
};

const formatPrice = (price: number) => `¥${price.toLocaleString("ja-JP")}`;

function historicalMinimum(input: PurchaseDecisionInput, current: number): number | null {
  const matching = (input.priceHistory ?? [])
    .filter((item) =>
      item.display_name === input.currentPrice.display_name &&
      item.type === input.currentPrice.type &&
      (item.period ?? null) === (input.currentPrice.period ?? null)
    )
    .sort((a, b) => Date.parse(b.changed_at ?? "") - Date.parse(a.changed_at ?? ""));

  const prior = matching.length > 0 && effectivePrice(matching[0]) === current
    ? matching.slice(1)
    : matching;
  const prices = prior.map(effectivePrice).filter((price): price is number => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

type PurchasePriceFacts = {
  current: number | null;
  historicalMin: number | null;
  discountRate: number;
  reviewAverage: number;
  reviewCount: number;
  reviewIsReliable: boolean;
  atHistoricalLow: boolean;
};

function purchasePriceFacts(input: PurchaseDecisionInput): PurchasePriceFacts {
  const current = effectivePrice(input.currentPrice);
  const regular = input.currentPrice.normal_price;
  const historicalMin = current === null ? null : historicalMinimum(input, current);
  const discountRate = current && regular && regular > current
    ? Math.round((1 - current / regular) * 100)
    : Math.max(0, Math.round(input.work.discount_rate ?? 0));
  const reviewAverage = input.work.review_average ?? 0;
  const reviewCount = input.work.review_count ?? 0;
  const reviewIsReliable = reviewAverage >= 4.2 && reviewCount >= 10;
  const atHistoricalLow = current !== null && historicalMin !== null && current <= historicalMin;
  return { current, historicalMin, discountRate, reviewAverage, reviewCount, reviewIsReliable, atHistoricalLow };
}

function purchaseVerdict(facts: PurchasePriceFacts) {
  let verdict = "情報を比較して判断したい作品";
  if (facts.atHistoricalLow && facts.reviewIsReliable) {
    verdict = "価格と評価の両面で検討しやすい";
  } else if (facts.atHistoricalLow || facts.discountRate >= 40) {
    verdict = "価格条件に注目したい作品";
  } else if (facts.reviewIsReliable) {
    verdict = "購入者評価を重視する人向けの候補";
  }
  return verdict;
}

function purchaseSummary(facts: PurchasePriceFacts) {
  const summaryParts: string[] = [];
  if (facts.current !== null) summaryParts.push(`現在の代表価格は${formatPrice(facts.current)}`);
  if (facts.atHistoricalLow) {
    summaryParts.push("同じ販売条件の記録上で過去最安水準です");
  } else if (facts.historicalMin !== null && facts.current !== null) {
    summaryParts.push(`記録上の過去最安は${formatPrice(facts.historicalMin)}です`);
  } else if (facts.discountRate > 0) {
    summaryParts.push(`${facts.discountRate}%OFFです`);
  }
  if (facts.reviewCount > 0) {
    summaryParts.push(`レビューは${facts.reviewAverage.toFixed(2)}（${facts.reviewCount}件）です`);
  }
  return summaryParts.length ? `${summaryParts.join("。")}。` : "価格と評価の取得状況を確認してから比較してください。";
}

function purchaseEvidence(facts: PurchasePriceFacts): PurchaseDecisionEvidence[] {
  const evidence: PurchaseDecisionEvidence[] = [];
  if (facts.current !== null) {
    const priceDetail = facts.atHistoricalLow
      ? "同一プランの過去記録と比較して最安水準"
      : facts.historicalMin !== null
        ? `過去最安との差は${formatPrice(Math.max(0, facts.current - facts.historicalMin))}`
        : facts.discountRate > 0
          ? `通常価格から${facts.discountRate}%OFF`
          : "現在取得できる代表プランの価格";
    evidence.push({ label: "現在価格", value: formatPrice(facts.current), detail: priceDetail });
  }
  if (facts.reviewCount > 0) {
    evidence.push({
      label: "購入者評価",
      value: `${facts.reviewAverage.toFixed(2)} / 5`,
      detail: facts.reviewCount >= 10 ? `${facts.reviewCount}件のレビューを集計` : `レビュー${facts.reviewCount}件のため参考値`,
    });
  }
  return evidence.slice(0, 3);
}

function purchaseSuitedFor(input: PurchaseDecisionInput, facts: PurchasePriceFacts) {
  const suitedFor: string[] = [];
  if (input.mainActress) suitedFor.push(`${input.mainActress}の出演作を探している人`);
  if (input.mainGenre) suitedFor.push(`${input.mainGenre}ジャンルを比較して選びたい人`);
  if (input.mainSeries) suitedFor.push(`${input.mainSeries}シリーズを追っている人`);
  if (facts.discountRate >= 30) suitedFor.push("通常価格より割安なタイミングを重視する人");
  const duration = parseRuntimeMinutes(input.work.duration);
  if (duration !== null && duration >= 120) suitedFor.push(`${duration}分の長時間作品を探している人`);
  if (input.work.sample_movie_url) suitedFor.push("サンプル映像を確認してから選びたい人");
  return suitedFor.slice(0, 4);
}

function purchaseCautions(input: PurchaseDecisionInput, facts: PurchasePriceFacts) {
  const cautions: string[] = [];
  if (facts.reviewCount < 10) cautions.push(`レビューは${facts.reviewCount}件のため、評価は参考値として確認してください。`);
  if (facts.historicalMin !== null && facts.current !== null && facts.current > facts.historicalMin) {
    cautions.push(`現在価格は記録上の過去最安より${formatPrice(facts.current - facts.historicalMin)}高い状態です。`);
  }
  if ((input.offerCount ?? 0) > 1) cautions.push("販売形式や視聴期間によって価格が異なるため、購入先で選択内容を確認してください。");
  if (facts.historicalMin === null) cautions.push("同一プランの比較可能な価格履歴が少なく、過去最安との判定はできません。");
  if (facts.discountRate > 0 && !input.work.sale_end_at) cautions.push("セール終了日時は購入先の最新表示を確認してください。");
  if (cautions.length === 0) cautions.push("価格や販売条件は変わる場合があるため、購入直前に販売ページで確認してください。");
  return cautions.slice(0, 3);
}

export function analyzePurchaseDecision(input: PurchaseDecisionInput): PurchaseDecision {
  const facts = purchasePriceFacts(input);
  return {
    verdict: purchaseVerdict(facts),
    summary: purchaseSummary(facts),
    evidence: purchaseEvidence(facts),
    suitedFor: purchaseSuitedFor(input, facts),
    cautions: purchaseCautions(input, facts),
  };
}
