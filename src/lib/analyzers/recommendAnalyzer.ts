export type RecommendationCategory = "price" | "review" | "popularity" | "discovery";

export type RecommendReason = {
  category: RecommendationCategory;
  title: string;
  description: string;
  color: "green" | "amber" | "pink" | "indigo";
};

export type PriceRecord = {
  display_name: string | null;
  type: string | null;
  normal_price: number | null;
  sale_price: number | null;
  changed_at?: string | null;
};

type Work = {
  review_average: number | null;
  review_count: number | null;
  ranking: number | null;
  realtime_rank?: number | null;
  previous_realtime_rank?: number | null;
  score: number | null;
  stage: string | null;
  duration: number | string | null;
  long_hit_rank?: number | null;
};

export type EntityRanks = {
  actress?: number | null;
  genre?: number | null;
  maker?: number | null;
  series?: number | null;
};

export type RecommendationInput = {
  work: Work;
  currentPrice?: PriceRecord | null;
  priceHistory?: PriceRecord[];
  entityRanks?: EntityRanks;
};

const effectivePrice = (price: PriceRecord): number | null => {
  const value = price.sale_price ?? price.normal_price;
  return typeof value === "number" && value > 0 ? value : null;
};

const formatPrice = (price: number) => `¥${price.toLocaleString("ja-JP")}`;

const parseRuntimeMinutes = (duration: number | string | null): number | null => {
  if (typeof duration === "number") return Number.isFinite(duration) ? duration : null;
  if (!duration) return null;
  const hours = duration.match(/(\d+)\s*時間/);
  const minutes = duration.match(/(\d+)\s*分/);
  if (hours || minutes) return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  const numeric = Number(duration.match(/\d+/)?.[0]);
  return Number.isFinite(numeric) ? numeric : null;
};

function priceReason(input: RecommendationInput): RecommendReason | null {
  const current = input.currentPrice;
  if (!current) return null;
  const currentPrice = effectivePrice(current);
  if (currentPrice === null) return null;

  const matchingHistory = (input.priceHistory ?? [])
    .filter((item) => item.display_name === current.display_name && item.type === current.type)
    .filter((item) => effectivePrice(item) !== null)
    .sort((a, b) => Date.parse(b.changed_at ?? "") - Date.parse(a.changed_at ?? ""));

  // price_history の最新行は現在値の保存時点であるため、現在値と同じなら比較対象から外す。
  const priorHistory = matchingHistory.length > 0 && effectivePrice(matchingHistory[0]) === currentPrice
    ? matchingHistory.slice(1)
    : matchingHistory;
  const historicalPrices = priorHistory.map(effectivePrice).filter((price): price is number => price !== null);
  const historicalMin = historicalPrices.length ? Math.min(...historicalPrices) : null;
  if (historicalMin !== null && currentPrice <= historicalMin) {
    return {
      category: "price",
      title: "過去最安値",
      description: `${current.display_name ?? "現在の価格種別"}が過去最安の${formatPrice(currentPrice)}です。`,
      color: "green",
    };
  }

  const regularPrice = current.normal_price;
  const discountRate = regularPrice && regularPrice > currentPrice
    ? ((regularPrice - currentPrice) / regularPrice) * 100
    : 0;
  if (discountRate >= 50) {
    return {
      category: "price",
      title: "大幅割引",
      description: `${Math.round(discountRate)}%OFFで${formatPrice(currentPrice)}です。`,
      color: "green",
    };
  }

  const previousPrice = priorHistory[0] ? effectivePrice(priorHistory[0]) : null;
  if (previousPrice && previousPrice > currentPrice) {
    const dropRate = ((previousPrice - currentPrice) / previousPrice) * 100;
    if (dropRate >= 10) {
      return {
        category: "price",
        title: "直近価格下落",
        description: `直前の${formatPrice(previousPrice)}から${Math.round(dropRate)}%下落しました。`,
        color: "green",
      };
    }
  }

  if (regularPrice && currentPrice < regularPrice) {
    return {
      category: "price",
      title: "現在セール中",
      description: `通常${formatPrice(regularPrice)}のところ、現在${formatPrice(currentPrice)}です。`,
      color: "green",
    };
  }
  return null;
}

function reviewReason(work: Work): RecommendReason | null {
  const average = work.review_average ?? 0;
  const count = work.review_count ?? 0;
  if (average >= 4.2 && count >= 10) {
    return { category: "review", title: "高評価", description: `レビュー${average.toFixed(2)}（${count}件）の高評価作品です。`, color: "amber" };
  }
  if (count >= 50) {
    return { category: "review", title: "レビュー多数", description: `${count}件のレビューが投稿されています。`, color: "amber" };
  }
  return null;
}

function popularityReason(work: Work, ranks: EntityRanks): RecommendReason | null {
  const currentRank = work.realtime_rank ?? work.ranking;
  const previousRank = work.previous_realtime_rank;
  if (currentRank && previousRank && previousRank - currentRank >= 20) {
    return { category: "popularity", title: "ランキング急上昇", description: `${previousRank}位から${currentRank}位へ${previousRank - currentRank}位上昇しました。`, color: "pink" };
  }
  if (currentRank && currentRank <= 100) {
    return { category: "popularity", title: "ランキング上位", description: `現在のランキングは${currentRank}位です。`, color: "pink" };
  }
  if (ranks.actress && ranks.actress <= 50) return { category: "popularity", title: "人気女優出演", description: `出演女優が女優ランキング${ranks.actress}位です。`, color: "pink" };
  if (ranks.genre && ranks.genre <= 30) return { category: "popularity", title: "人気ジャンル", description: `ジャンルランキング${ranks.genre}位の作品です。`, color: "pink" };
  if (ranks.maker && ranks.maker <= 30) return { category: "popularity", title: "人気メーカー", description: `メーカーランキング${ranks.maker}位の作品です。`, color: "pink" };
  if (ranks.series && ranks.series <= 50) return { category: "popularity", title: "人気シリーズ", description: `シリーズランキング${ranks.series}位の作品です。`, color: "pink" };
  return null;
}

function discoveryReason(work: Work): RecommendReason | null {
  if ((work.score ?? 0) >= 80) return { category: "discovery", title: "発掘スコア上位", description: `発掘スコア${work.score}点の注目作品です。`, color: "indigo" };
  if (work.long_hit_rank != null) return { category: "discovery", title: "ロングヒット", description: `ロングヒットランキング${work.long_hit_rank}位の作品です。`, color: "indigo" };
  if (work.stage === "NEW") return { category: "discovery", title: "新作", description: "現在NEWステージの新作です。", color: "indigo" };
  if (work.stage === "SEMI_NEW") return { category: "discovery", title: "準新作", description: "現在SEMI_NEWステージの準新作です。", color: "indigo" };
  const runtime = parseRuntimeMinutes(work.duration);
  if (runtime !== null && runtime >= 120) return { category: "discovery", title: "長時間作品", description: `収録時間${runtime}分の長時間作品です。`, color: "indigo" };
  return null;
}

export function analyzeRecommendation(input: RecommendationInput): RecommendReason[] {
  return [
    priceReason(input),
    reviewReason(input.work),
    popularityReason(input.work, input.entityRanks ?? {}),
    discoveryReason(input.work),
  ].filter((reason): reason is RecommendReason => reason !== null);
}
