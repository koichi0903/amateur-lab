import { getXWeightedLength, truncateXText } from "@/lib/xText";

export type XHookType =
  | "price_anomaly"
  | "rating_anomaly"
  | "ranking_anomaly"
  | "review_proof"
  | "discovery_anomaly"
  | "buy_timing";

export type XPostFormat =
  | "discovery"
  | "buy_timing"
  | "rating_anomaly"
  | "social_proof"
  | "actress"
  | "comparison";

export type XImageStrategy = "original_work_image" | "branded_data_card";
export type XLinkStrategy = "body_link" | "reply_link";
export type XCtaStrategy = "price_cta" | "reason_cta";

export type XHookAxis = {
  type: XHookType;
  score: number;
  label: string;
  evidence: string;
  metrics: Record<string, number | null>;
};

export type XHookScore = {
  axes: Record<XHookType, XHookAxis>;
  bestHook: XHookAxis;
};

export type XCreativeVariant = {
  id: string;
  postFormat: XPostFormat;
  hookType: XHookType;
  imageStrategy: XImageStrategy;
  linkStrategy: XLinkStrategy;
  ctaStrategy: XCtaStrategy;
  bodyText: string;
  replyText: string | null;
  url: string;
  rationale: string;
  weightedLength: number;
};

export type XCreativeInput = {
  key: string;
  title: string;
  url: string;
  category: string;
  actress: string | null;
  genre: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  discountRate: number;
  reviewAverage: number | null;
  reviewCount: number;
  ranking: number | null;
  score: number;
  discoveryScore: number | null;
  buyTimingScore: number | null;
  isNinetyDayLow: boolean;
};

const HOOK_ORDER: XHookType[] = [
  "ranking_anomaly",
  "price_anomaly",
  "buy_timing",
  "discovery_anomaly",
  "rating_anomaly",
  "review_proof",
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function yen(value: number | null) {
  return value ? `${value.toLocaleString("ja-JP")}円` : "価格は詳細で確認";
}

function pct(value: number) {
  return `${Math.max(0, Math.round(value))}%`;
}

function scoreFromRanking(ranking: number | null) {
  if (!ranking) return 0;
  if (ranking >= 500) return 96;
  if (ranking >= 300) return 88;
  if (ranking >= 150) return 76;
  if (ranking >= 80) return 62;
  return 30;
}

function fitLines(lines: string[], title: string) {
  let titleLimit = 62;
  let text = lines.map((line) => line.replace("__TITLE__", truncateXText(title, titleLimit))).join("\n");
  while (getXWeightedLength(text) > 280 && titleLimit > 18) {
    titleLimit -= 2;
    text = lines.map((line) => line.replace("__TITLE__", truncateXText(title, titleLimit))).join("\n");
  }
  return text;
}

function axis(type: XHookType, score: number, label: string, evidence: string, metrics: Record<string, number | null>): XHookAxis {
  return { type, score: clampScore(score), label, evidence, metrics };
}

export function calculateHookScore(input: XCreativeInput): XHookScore {
  const priceDrop = input.previousPrice && input.currentPrice && input.previousPrice > input.currentPrice
    ? Math.round((1 - input.currentPrice / input.previousPrice) * 100)
    : input.discountRate;
  const priceScore = Math.max(
    input.isNinetyDayLow ? 92 : 0,
    priceDrop >= 70 ? 96 : priceDrop >= 50 ? 88 : priceDrop >= 30 ? 72 : priceDrop >= 15 ? 54 : 20,
  );
  const ratingScore = input.reviewAverage
    ? (input.reviewAverage >= 4.8 ? 94 : input.reviewAverage >= 4.6 ? 82 : input.reviewAverage >= 4.3 ? 66 : 34)
    : 0;
  const reviewScore = input.reviewCount >= 200 ? 96 : input.reviewCount >= 100 ? 86 : input.reviewCount >= 50 ? 72 : input.reviewCount >= 20 ? 56 : input.reviewCount >= 8 ? 38 : 0;
  const rankingBase = scoreFromRanking(input.ranking);
  const rankingScore = input.ranking && input.reviewAverage
    ? Math.min(100, rankingBase * 0.62 + ratingScore * 0.28 + Math.min(reviewScore, 80) * 0.1)
    : rankingBase;
  const discovery = input.discoveryScore ?? Math.max(0, Math.min(100, Math.round(input.score)));
  const buyTiming = input.buyTimingScore ?? Math.max(priceScore, input.discountRate >= 30 ? 68 : 0);

  const axes: Record<XHookType, XHookAxis> = {
    price_anomaly: axis(
      "price_anomaly",
      priceScore,
      "価格異常",
      input.isNinetyDayLow
        ? `過去90日最安級、${pct(priceDrop)}OFF`
        : `${yen(input.previousPrice)} → ${yen(input.currentPrice)}、${pct(priceDrop)}OFF`,
      { currentPrice: input.currentPrice, previousPrice: input.previousPrice, discountRate: priceDrop, isNinetyDayLow: input.isNinetyDayLow ? 1 : 0 },
    ),
    rating_anomaly: axis(
      "rating_anomaly",
      ratingScore,
      "評価異常",
      `評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`,
      { reviewAverage: input.reviewAverage, reviewCount: input.reviewCount },
    ),
    ranking_anomaly: axis(
      "ranking_anomaly",
      rankingScore,
      "ランキング異常",
      `ランキング${input.ranking ?? "-"}位なのに評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`,
      { ranking: input.ranking, reviewAverage: input.reviewAverage, reviewCount: input.reviewCount },
    ),
    review_proof: axis(
      "review_proof",
      reviewScore,
      "レビュー証明",
      `レビュー${input.reviewCount}件、評価${input.reviewAverage?.toFixed(2) ?? "-"}`,
      { reviewAverage: input.reviewAverage, reviewCount: input.reviewCount },
    ),
    discovery_anomaly: axis(
      "discovery_anomaly",
      discovery,
      "発掘指数",
      `発掘指数${discovery}`,
      { discoveryScore: discovery, ranking: input.ranking },
    ),
    buy_timing: axis(
      "buy_timing",
      buyTiming,
      "買い時",
      `買い時${buyTiming}、${pct(input.discountRate)}OFF`,
      { buyTimingScore: buyTiming, discountRate: input.discountRate, currentPrice: input.currentPrice },
    ),
  };

  const bestHook = [...HOOK_ORDER]
    .map((type) => axes[type])
    .sort((a, b) => b.score - a.score || HOOK_ORDER.indexOf(a.type) - HOOK_ORDER.indexOf(b.type))[0];

  return { axes, bestHook };
}

function chooseFormat(input: XCreativeInput, hook: XHookType): XPostFormat {
  if (input.category === "actress_best") return "actress";
  if (input.category === "genre_best" || input.category === "maker_best" || input.category === "series_best") return "comparison";
  if (hook === "buy_timing" || hook === "price_anomaly") return "buy_timing";
  if (hook === "rating_anomaly") return "rating_anomaly";
  if (hook === "review_proof") return "social_proof";
  return "discovery";
}

function mainEvidence(input: XCreativeInput, hook: XHookType) {
  if (hook === "price_anomaly") return input.isNinetyDayLow ? `過去90日最安級。しかも${pct(input.discountRate)}OFF。` : `${yen(input.previousPrice)}から${yen(input.currentPrice)}へ。`;
  if (hook === "buy_timing") return `買い時${input.buyTimingScore ?? "-"}。価格条件が強い候補です。`;
  if (hook === "ranking_anomaly") return `ランキング${input.ranking ?? "-"}位なのに、評価${input.reviewAverage?.toFixed(2) ?? "-"}。`;
  if (hook === "rating_anomaly") return `評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件。`;
  if (hook === "review_proof") return `レビュー${input.reviewCount}件で評価${input.reviewAverage?.toFixed(2) ?? "-"}。`;
  return `発掘指数${input.discoveryScore ?? input.score}。ランキングだけでは見つけにくい候補です。`;
}

function ctaLine(cta: XCtaStrategy) {
  return cta === "price_cta" ? "価格とサンプルを見る →" : "高得点の理由を見る →";
}

function variantText(input: XCreativeInput, hook: XHookType, format: XPostFormat, cta: XCtaStrategy, includeUrl: boolean) {
  const entity = input.actress?.split(/[,、/]/)[0]?.trim() || input.genre?.split(/[,、/]/)[0]?.trim() || null;
  const lines = format === "actress"
    ? [
      entity ? `${entity}で選ぶなら、今日はこの一本。` : "条件別で選ぶなら、今日はこの一本。",
      mainEvidence(input, hook),
      "「__TITLE__」",
      ctaLine(cta),
    ]
    : format === "comparison"
      ? [
        entity ? `${entity}周辺で迷うなら、今はこれを軸に比較。` : "同条件で迷うなら、今はこれを軸に比較。",
        mainEvidence(input, hook),
        "「__TITLE__」",
        ctaLine(cta),
      ]
      : [
        mainEvidence(input, hook),
        hook === "ranking_anomaly" ? "これ、かなり埋もれてます。" : hook === "price_anomaly" || hook === "buy_timing" ? "今回は待つより確認優先でよさそう。" : "数字で見ると候補に入ります。",
        "「__TITLE__」",
        ctaLine(cta),
      ];

  if (includeUrl) lines.push(input.url);
  return fitLines(lines, input.title);
}

export function buildXCreativeVariants(input: XCreativeInput, hookScore = calculateHookScore(input)): XCreativeVariant[] {
  const best = hookScore.bestHook.type;
  const altHook: XHookType = best === "price_anomaly" || best === "buy_timing"
    ? (hookScore.axes.ranking_anomaly.score >= hookScore.axes.discovery_anomaly.score ? "ranking_anomaly" : "discovery_anomaly")
    : (hookScore.axes.price_anomaly.score >= hookScore.axes.buy_timing.score ? "price_anomaly" : "buy_timing");
  const format = chooseFormat(input, best);
  const imageStrategy: XImageStrategy = best === "price_anomaly" || best === "buy_timing" || best === "discovery_anomaly"
    ? "branded_data_card"
    : "original_work_image";
  const base = [
    { suffix: "body-card-reason", hookType: best, linkStrategy: "body_link" as const, imageStrategy, ctaStrategy: "reason_cta" as const },
    { suffix: "reply-card-price", hookType: best, linkStrategy: "reply_link" as const, imageStrategy: "branded_data_card" as const, ctaStrategy: "price_cta" as const },
    { suffix: "body-original-alt", hookType: altHook, linkStrategy: "body_link" as const, imageStrategy: "original_work_image" as const, ctaStrategy: "reason_cta" as const },
  ];

  return base.map((variant) => {
    const postFormat = chooseFormat(input, variant.hookType) === "comparison" ? format : chooseFormat(input, variant.hookType);
    const bodyText = variantText(input, variant.hookType, postFormat, variant.ctaStrategy, variant.linkStrategy === "body_link");
    const replyText = variant.linkStrategy === "reply_link"
      ? fitLines(["詳細はこちら。", input.url], input.title)
      : null;
    return {
      id: `${input.key}-${variant.suffix}`,
      postFormat,
      hookType: variant.hookType,
      imageStrategy: variant.imageStrategy,
      linkStrategy: variant.linkStrategy,
      ctaStrategy: variant.ctaStrategy,
      bodyText,
      replyText,
      url: input.url,
      rationale: `${hookScore.axes[variant.hookType].label}: ${hookScore.axes[variant.hookType].evidence}`,
      weightedLength: getXWeightedLength(bodyText),
    };
  });
}
