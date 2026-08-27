import type { PriceRecord } from "./recommendAnalyzer";

type PurchaseDecisionWork = {
  score: number | null;
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

const runtimeMinutes = (duration: number | string | null): number | null => {
  if (typeof duration === "number") return Number.isFinite(duration) ? duration : null;
  if (!duration) return null;
  const hours = duration.match(/(\d+)\s*時間/);
  const minutes = duration.match(/(\d+)\s*分/);
  if (hours || minutes) return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  const numeric = Number(duration.match(/\d+/)?.[0]);
  return Number.isFinite(numeric) ? numeric : null;
};

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

export function analyzePurchaseDecision(input: PurchaseDecisionInput): PurchaseDecision {
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

  let verdict = "情報を比較して判断したい作品";
  if (atHistoricalLow && reviewIsReliable) {
    verdict = "価格と評価の両面で検討しやすい";
  } else if (atHistoricalLow || discountRate >= 40) {
    verdict = "価格条件に注目したい作品";
  } else if (reviewIsReliable) {
    verdict = "購入者評価を重視する人向けの候補";
  }

  const summaryParts: string[] = [];
  if (current !== null) summaryParts.push(`現在の代表価格は${formatPrice(current)}`);
  if (atHistoricalLow) {
    summaryParts.push("同じ販売条件の記録上で過去最安水準です");
  } else if (historicalMin !== null && current !== null) {
    summaryParts.push(`記録上の過去最安は${formatPrice(historicalMin)}です`);
  } else if (discountRate > 0) {
    summaryParts.push(`${discountRate}%OFFです`);
  }
  if (reviewCount > 0) {
    summaryParts.push(`レビューは${reviewAverage.toFixed(2)}（${reviewCount}件）です`);
  }

  const evidence: PurchaseDecisionEvidence[] = [];
  if (current !== null) {
    const priceDetail = atHistoricalLow
      ? "同一プランの過去記録と比較して最安水準"
      : historicalMin !== null
        ? `過去最安との差は${formatPrice(Math.max(0, current - historicalMin))}`
        : discountRate > 0
          ? `通常価格から${discountRate}%OFF`
          : "現在取得できる代表プランの価格";
    evidence.push({ label: "現在価格", value: formatPrice(current), detail: priceDetail });
  }
  if (reviewCount > 0) {
    evidence.push({
      label: "購入者評価",
      value: `${reviewAverage.toFixed(2)} / 5`,
      detail: reviewCount >= 10 ? `${reviewCount}件のレビューを集計` : `レビュー${reviewCount}件のため参考値`,
    });
  }
  if ((input.work.score ?? 0) > 0) {
    evidence.push({
      label: "発掘スコア",
      value: `${input.work.score}点`,
      detail: "価格・評価・人気などのサイト内指標",
    });
  }

  const suitedFor: string[] = [];
  if (input.mainActress) suitedFor.push(`${input.mainActress}の出演作を探している人`);
  if (input.mainGenre) suitedFor.push(`${input.mainGenre}ジャンルを比較して選びたい人`);
  if (input.mainSeries) suitedFor.push(`${input.mainSeries}シリーズを追っている人`);
  if (discountRate >= 30) suitedFor.push("通常価格より割安なタイミングを重視する人");
  const duration = runtimeMinutes(input.work.duration);
  if (duration !== null && duration >= 120) suitedFor.push(`${duration}分の長時間作品を探している人`);
  if (input.work.sample_movie_url) suitedFor.push("サンプル映像を確認してから選びたい人");

  const cautions: string[] = [];
  if (reviewCount < 10) cautions.push(`レビューは${reviewCount}件のため、評価は参考値として確認してください。`);
  if (historicalMin !== null && current !== null && current > historicalMin) {
    cautions.push(`現在価格は記録上の過去最安より${formatPrice(current - historicalMin)}高い状態です。`);
  }
  if ((input.offerCount ?? 0) > 1) cautions.push("販売形式や視聴期間によって価格が異なるため、購入先で選択内容を確認してください。");
  if (historicalMin === null) cautions.push("同一プランの比較可能な価格履歴が少なく、過去最安との判定はできません。");
  if (discountRate > 0 && !input.work.sale_end_at) cautions.push("セール終了日時は購入先の最新表示を確認してください。");
  if (cautions.length === 0) cautions.push("価格や販売条件は変わる場合があるため、購入直前に販売ページで確認してください。");

  return {
    verdict,
    summary: summaryParts.length ? `${summaryParts.join("。")}。` : "価格と評価の取得状況を確認してから比較してください。",
    evidence: evidence.slice(0, 3),
    suitedFor: suitedFor.slice(0, 4),
    cautions: cautions.slice(0, 3),
  };
}
