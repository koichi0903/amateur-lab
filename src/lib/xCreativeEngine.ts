import type { XPostLog } from "@/lib/xPostLogs";
import { getXWeightedLength } from "@/lib/xText";

export type XGrowthIntent = "REACH" | "AUTHORITY" | "FOLLOW" | "CONVERSATION" | "MONEY";
export type XHookType = "price_anomaly" | "rating_anomaly" | "ranking_anomaly" | "review_proof" | "discovery_anomaly" | "buy_timing";
export type XHookDirection = "curiosity" | "contradiction" | "hot_take" | "follow_up" | "comparison" | "social_proof" | "confession" | "missed" | "surprise" | "empathy" | "question" | "surprising_concentration" | "contrast" | "curation" | "anti_obvious" | "pattern_break" | "selection_tension";
export type XPostFormat = "discovery" | "buy_timing" | "rating_anomaly" | "social_proof" | "actress" | "comparison";
export type XImageStrategy = "original_work_image" | "branded_data_card";
export type XLinkStrategy = "body_link" | "reply_link";
export type XCtaStrategy = "price_cta" | "reason_cta";
export type XCreativeStructure = "short" | "data" | "judgment" | "question" | "follow_up" | "series";
export type XCreativeMedia = "existing_link_image" | "sample_movie" | "data_card" | "text" | "quote";
export type XLinkPlan = "no_link" | "profile_only" | "reply_link" | "body_link";
export type XSourceType = "WORK" | "MARKET" | "FOLLOW_UP" | "COMPARISON" | "JUDGMENT" | "ACTRESS_TREND" | "GENRE_TREND" | "MAKER_TREND" | "PRICE_EVENT" | "HIDDEN_GEM" | "MONEY";
export type XVideoManualTag = "first_seconds_strong" | "visual_mismatch" | "actress_fit" | "scene_surprise" | "safe_preview" | "too_explicit_for_reach" | "weak_visual";

export type XQualityDimension =
  | "scrollStop" | "curiosity" | "proof" | "judgment" | "followValue"
  | "specificity" | "novelty" | "adSmell" | "ctaFit" | "mediaFit"
  | "shareability" | "replyability";

export type XQualityScore = {
  dimensions: Record<XQualityDimension, number>;
  total: number;
  passed: boolean;
  recommendation: "post" | "revise" | "do_not_post";
  reasons: Record<XQualityDimension, string>;
  weaknesses: string[];
  improvements: string[];
  gate: {
    intent: XGrowthIntent;
    passed: boolean;
    required: string[];
    failed: string[];
  };
  lastMile: {
    verdict: "post_ok" | "revise" | "do_not_post";
    passed: boolean;
    reasons: string[];
    rewriteCount: number;
    humanVoice: {
      passed: boolean;
      checks: Record<"xNative" | "audienceClear" | "readerAction" | "noInternalMetric" | "noRepeatedFact" | "concreteOpening", boolean>;
      forbiddenHits: string[];
      reasons: string[];
    };
    nativeXVoice: {
      passed: boolean;
      checks: Record<"timelineNative" | "notOperatorVoice" | "notReviewSite" | "emotionalFirstLine" | "notTooPolished" | "noTemplateReuse" | "subjectVariety", boolean>;
      forbiddenHits: string[];
      reasons: string[];
    };
  };
};

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
  intent: XGrowthIntent;
  postFormat: XPostFormat;
  hookType: XHookType;
  structure: XCreativeStructure;
  mediaType: XCreativeMedia;
  imageStrategy: XImageStrategy;
  linkStrategy: XLinkStrategy;
  linkPlan: XLinkPlan;
  ctaStrategy: XCtaStrategy;
  bodyText: string;
  replyText: string | null;
  url: string;
  rationale: string;
  weightedLength: number;
  quality: XQualityScore;
  buzzPotential: {
    total: number;
    scrollStop: number;
    shareability: number;
    replyability: number;
    followValue: number;
    mediaFit: number;
    curiosity: number;
    novelty: number;
    reason: string;
  };
  hookDirection: XHookDirection;
  hookAlternatives: Array<{ direction: XHookDirection; opening: string; score: number }>;
  creativeGenome: {
    topic: string;
    intent: XGrowthIntent;
    hook: string;
    proof: string;
    structure: string;
    emotion: string;
    length: string;
    media: string;
    cta: string;
    linkStrategy: string;
    postingSlot: string;
  };
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
  sampleMovieUrl?: string | null;
  imageUrl?: string | null;
  saleEndAt?: string | null;
  hasRightsCheckedMovie?: boolean;
  mediaManualTags?: XVideoManualTag[];
  mediaQuality?: "unreviewed" | "strong" | "normal" | "weak";
  xPageViews?: number;
  xFanzaClicks?: number;
  seriesName?: string | null;
  seriesObservationCount?: number;
  rankingHistoryCount?: number;
  previousRanking?: number | null;
  rankingDelta?: number | null;
  recentLogs?: XPostLog[];
  radarAvailable?: boolean;
  recommendedSlot?: string;
  sourceType?: XSourceType;
};

const HOOK_ORDER: XHookType[] = ["ranking_anomaly", "price_anomaly", "buy_timing", "discovery_anomaly", "rating_anomaly", "review_proof"];
const INTENTS: XGrowthIntent[] = ["REACH", "FOLLOW", "AUTHORITY", "MONEY"];
const PROMO_WORDS = ["期間限定", "今すぐ", "詳細はこちら", "お得", "🔥", "絶対", "見逃し厳禁", "セール中", "激安"];
const FORBIDDEN_PUBLIC_WORDS = [
  "本文では", "カードで", "見る順番を置く",
  "入口が作れる", "観察ポイント", "確認する価値", "今日買う理由が残る", "安全です", "価格条件は強め",
  "この条件なら", "根拠がそろっている", "広告っぽい", "広告っぽく見えない", "確認する価値があります",
  "今見る理由があります", "順位、評価、価格の根拠がそろっています", "データ上", "データ上では", "スコア",
  "スコア的に", "数字の組み合わせ",
  "数字の組み合わせです", "価格異常", "Opportunity", "Freshness", "発掘指数", "買い時スコア", "価格条件は強め",
  "投稿する価値", "確認する位置", "データ補足", "候補化", "候補です", "候補では", "比較候補",
  "覚えておく方が役に立つ", "拾うなら", "中身として拾いたい", "拾いたい", "入口", "観察",
  "比較メモ", "自然です", "差は大きく見せず", "価格条件", "中身として拾いたい",
  "過去価格との差で止まる日", "本文で説明するより", "動画あり",
  "短く見て決められます", "まず見る場所", "どこを見るか", "刺さるなら", "見ていいと思います",
  "タイトルだけなら流してました", "サンプルまで見ると印象が変わる", "サンプルまで見ると印象が変わりそう",
  "最初に見る場所", "まずだけ", "今日見る場所",
  "本文では", "カードで", "候補", "確認する価値", "刺さる題材だけ見れば十分", "外しにくい",
  "画像で雰囲気は伝わるので", "本文は短くてよさそう", "カードは補助", "気になる一本だけ見れば足ります",
  "半額だけでなく評価も高いので", "気になっていたなら今日は",
];
const FORBIDDEN_TEMPORAL_WORDS = ["上がってきた", "急上昇", "昨日より", "伸びている", "伸びてきた", "見つかり始めた", "勢いがある", "動きが出ています"];
const STRONG_FACT_LIMIT = 2;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const yen = (value: number | null) => value ? `${value.toLocaleString("ja-JP")}円` : "価格未取得";
const pct = (value: number) => `${Math.max(0, Math.round(value))}%`;

function axis(type: XHookType, score: number, label: string, evidence: string, metrics: Record<string, number | null>): XHookAxis {
  return { type, score: clamp(score), label, evidence, metrics };
}

export function calculateHookScore(input: XCreativeInput): XHookScore {
  const priceDrop = input.previousPrice && input.currentPrice && input.previousPrice > input.currentPrice
    ? Math.round((1 - input.currentPrice / input.previousPrice) * 100)
    : input.discountRate;
  const priceScore = Math.max(input.isNinetyDayLow ? 92 : 0, priceDrop >= 70 ? 96 : priceDrop >= 50 ? 88 : priceDrop >= 30 ? 72 : priceDrop >= 15 ? 54 : 18);
  const ratingScore = input.reviewAverage ? input.reviewAverage >= 4.8 ? 94 : input.reviewAverage >= 4.6 ? 82 : input.reviewAverage >= 4.3 ? 66 : 34 : 0;
  const reviewScore = input.reviewCount >= 200 ? 96 : input.reviewCount >= 100 ? 86 : input.reviewCount >= 50 ? 72 : input.reviewCount >= 20 ? 56 : input.reviewCount >= 8 ? 38 : 0;
  const rankingScore = input.ranking ? input.ranking <= 10 ? 92 : input.ranking <= 30 ? 84 : input.ranking <= 80 ? 70 : input.ranking <= 180 ? 58 : 42 : 0;
  const discovery = input.discoveryScore ?? Math.max(0, Math.min(100, Math.round(input.score)));
  const buyTiming = input.buyTimingScore ?? Math.max(priceScore, input.discountRate >= 30 ? 68 : 0);
  const axes: Record<XHookType, XHookAxis> = {
    price_anomaly: axis("price_anomaly", priceScore, "価格異常", input.isNinetyDayLow ? `過去90日最安級、${pct(priceDrop)}OFF` : `${yen(input.previousPrice)}から${yen(input.currentPrice)}、${pct(priceDrop)}OFF`, { currentPrice: input.currentPrice, previousPrice: input.previousPrice, discountRate: priceDrop }),
    rating_anomaly: axis("rating_anomaly", ratingScore, "評価異常", `評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`, { reviewAverage: input.reviewAverage, reviewCount: input.reviewCount }),
    ranking_anomaly: axis("ranking_anomaly", rankingScore, "ランキング異常", `ランキング${input.ranking ?? "-"}位、評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`, { ranking: input.ranking, reviewAverage: input.reviewAverage, reviewCount: input.reviewCount }),
    review_proof: axis("review_proof", reviewScore, "レビュー証明", `レビュー${input.reviewCount}件、評価${input.reviewAverage?.toFixed(2) ?? "-"}`, { reviewAverage: input.reviewAverage, reviewCount: input.reviewCount }),
    discovery_anomaly: axis("discovery_anomaly", discovery, "発掘指数", `発掘指数${discovery}`, { discoveryScore: discovery, ranking: input.ranking }),
    buy_timing: axis("buy_timing", buyTiming, "買い時", `買い時${buyTiming}、${pct(input.discountRate)}OFF`, { buyTimingScore: buyTiming, discountRate: input.discountRate }),
  };
  const bestHook = [...HOOK_ORDER].map((type) => axes[type]).sort((a, b) => b.score - a.score || HOOK_ORDER.indexOf(a.type) - HOOK_ORDER.indexOf(b.type))[0];
  return { axes, bestHook };
}

function evidenceLines(input: XCreativeInput) {
  return [
    input.ranking ? `ランキング${input.ranking}位` : "",
    input.reviewAverage ? `評価${input.reviewAverage.toFixed(1)} / レビュー${input.reviewCount}件` : "",
    input.isNinetyDayLow ? `過去90日最安級 / ${pct(input.discountRate)}OFF` : input.discountRate >= 15 ? `${pct(input.discountRate)}OFF` : "",
    input.currentPrice ? `現在${yen(input.currentPrice)}` : "",
  ].filter(Boolean);
}

function strongestFacts(input: XCreativeInput) {
  const trend = rankingTrendLine(input);
  return [
    trend ? `${trend}` : "",
    input.reviewAverage && input.reviewAverage >= 4.7 ? `評価${input.reviewAverage.toFixed(1)}` : "",
    input.ranking && !trend && input.ranking <= 80 ? `ランキング${input.ranking}位` : "",
    input.isNinetyDayLow ? `過去90日最安級` : "",
    input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "",
    input.reviewCount >= 20 ? `レビュー${input.reviewCount}件` : "",
  ].filter(Boolean).slice(0, STRONG_FACT_LIMIT);
}

function primaryActress(input: XCreativeInput) {
  return input.actress?.split(/[,、/]/)[0]?.trim() || null;
}

function hasRankingTrend(input: XCreativeInput) {
  return Boolean(input.rankingHistoryCount && input.rankingHistoryCount >= 2 && input.previousRanking && input.ranking && input.previousRanking > input.ranking);
}

function rankingTrendLine(input: XCreativeInput) {
  return hasRankingTrend(input) ? `${input.previousRanking}位→${input.ranking}位` : null;
}

function naturalTitle(title: string, remainingWeight: number) {
  const clean = title.replace(/[.…]+$/g, "").trim();
  if (!clean) return null;
  return getXWeightedLength(`「${clean}」`) <= remainingWeight ? `「${clean}」` : null;
}

function formatText(lines: string[], title: string) {
  let working = [...lines];
  const titleIndex = working.findIndex((line) => line === "__TITLE__");
  if (titleIndex >= 0) {
    const withoutTitle = working.filter((_, index) => index !== titleIndex).join("\n");
    const titleLine = naturalTitle(title, 280 - getXWeightedLength(withoutTitle) - 2);
    working = titleLine ? working.map((line) => line === "__TITLE__" ? titleLine : line) : working.filter((line) => line !== "__TITLE__");
  }
  let text = working.join("\n");
  while (getXWeightedLength(text) > 280 && working.length > 2) {
    const removable = working.findIndex((line) => line.includes("確認") || line.includes("気になる") || line.includes("候補"));
    working.splice(removable >= 0 ? removable : working.length - 2, 1);
    text = working.join("\n");
  }
  return text;
}

function hookSubject(input: XCreativeInput) {
  return primaryActress(input)
    ?? input.seriesName
    ?? input.genre?.split(/[,、/]/)[0]?.trim()
    ?? null;
}

function safeTitleFragment(input: XCreativeInput) {
  const first = input.title.split(/[。！？!?]/)[0]?.trim() ?? input.title;
  if (getXWeightedLength(first) <= 28) return `「${first}」`;
  const actress = primaryActress(input);
  return actress ? `${actress}の一本` : input.genre ? `${input.genre.split(/[,、/]/)[0]}の一本` : "この一本";
}

const VIDEO_TAG_PRIORITY: XVideoManualTag[] = ["too_explicit_for_reach", "weak_visual", "first_seconds_strong", "visual_mismatch", "scene_surprise", "actress_fit", "safe_preview"];

function primaryVideoTag(input: XCreativeInput): XVideoManualTag | null {
  const tags = input.mediaManualTags ?? [];
  return VIDEO_TAG_PRIORITY.find((tag) => tags.includes(tag)) ?? null;
}

function videoSpecificLines(input: XCreativeInput, intent: XGrowthIntent, linkPlan: XLinkPlan) {
  const tag = primaryVideoTag(input);
  if (!tag || tag === "too_explicit_for_reach" || tag === "weak_visual") return null;
  const actress = primaryActress(input);
  const title = safeTitleFragment(input);
  const subject = actress ?? title;
  const proof = humanProofLine(input, intent);
  const link = linkPlan === "body_link" ? input.url : "";
  const second = proof && (tag === "first_seconds_strong" || tag === "visual_mismatch") ? proof : "";
  const lineByTag: Record<Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">, string> = {
    first_seconds_strong: "これ、冒頭でちょっと止まった。",
    visual_mismatch: `${subject}、ジャケより動画の方が気になる。`,
    actress_fit: actress ? `${actress}、この空気だと見え方が変わる。` : `${title}、動画の空気が合ってる。`,
    scene_surprise: "入り方が少し予想とズレます。",
    safe_preview: proof ? `${subject}、数字より先に動画で分かる。` : `${subject}、雰囲気だけ先に見える。`,
  };
  const closingByTag: Record<Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">, string> = {
    first_seconds_strong: actress ? `${actress}、この雰囲気かなり合ってる。` : "この雰囲気、かなり合ってる。",
    visual_mismatch: "こっちの雰囲気の方が好きな人いそう。",
    actress_fit: "名前だけで流すの、少しもったいない。",
    scene_surprise: "この入り方、少し気になる。",
    safe_preview: "強く言わなくても、これで十分。",
  };
  return [lineByTag[tag], second, closingByTag[tag], link].filter(Boolean);
}

function hookOpenings(input: XCreativeInput, intent: XGrowthIntent): Array<{ direction: XHookDirection; opening: string; score: number }> {
  const subject = hookSubject(input);
  const facts = strongestFacts(input);
  const fact = facts[0] ?? (subject ? `${subject}` : "");
  const title = safeTitleFragment(input);
  const hasTrend = hasRankingTrend(input);
  const actress = primaryActress(input);
  const topic = actress ? `${actress}のこれ` : title;
  const moneyReason = input.isNinetyDayLow ? "過去90日でかなり安い" : input.saleEndAt ? "セール期限が近い" : input.discountRate >= 30 ? "値下げ幅が大きい" : "サンプルで判断しやすい";
  const genre = input.genre?.split(/[,、/]/)[0]?.trim();
  const discount = input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "セール";
  const videoLines = input.hasRightsCheckedMovie && input.sampleMovieUrl ? videoSpecificLines(input, intent, "no_link") : null;
  const openings: Array<{ direction: XHookDirection; opening: string; score: number }> = [
    ...(videoLines ? [{ direction: primaryVideoTag(input) === "visual_mismatch" ? "contrast" as const : primaryVideoTag(input) === "scene_surprise" ? "surprise" as const : "curiosity" as const, opening: videoLines[0], score: 104 }] : []),
    ...(input.sourceType === "MARKET" ? [
      { direction: "surprising_concentration" as const, opening: genre ? `今日の${discount}、${genre}に当たりが寄っています。` : `今日の${discount}、数より並び方の偏りが気になります。`, score: 97 },
      { direction: "pattern_break" as const, opening: genre ? `今日はランキング順より、${genre}の並び方で止まりました。` : "今日はランキング順より、セール欄の並び方で止まりました。", score: 95 },
      { direction: "anti_obvious" as const, opening: "ランキングだけ見ていると、今日の当たりを外しそうです。", score: 94 },
      { direction: "curation" as const, opening: genre ? `今見るなら、まず${genre}からでよさそうです。` : "今見るなら、まずこの並びからでよさそうです。", score: 91 },
      { direction: "selection_tension" as const, opening: `今日の${discount}、全部見るより一回だけ引っかかりを選びたいです。`, score: 90 },
    ] : []),
    ...(input.sourceType === "COMPARISON" ? [
      { direction: "contrast" as const, opening: input.discountRate >= 30 ? `同じ${pct(input.discountRate)}OFFでも、サンプルを見るなら差があります。` : "似た条件でも、最初に気になる一本は変わります。", score: 97 },
      { direction: "selection_tension" as const, opening: "3本で迷うなら、今日は最初の1本を決めてからでいいです。", score: 94 },
      { direction: "anti_obvious" as const, opening: "安い順で見ると、たぶん選び方を外します。", score: 91 },
      { direction: "question" as const, opening: "似た条件で並べると、意外と選び方が変わります。", score: 88 },
    ] : []),
    ...(input.sourceType === "JUDGMENT" ? [
      { direction: "hot_take" as const, opening: input.discountRate >= 30 ? `${pct(input.discountRate)}OFFだけど、これは今日は見送っていいかもしれません。` : "売れてそうに見えても、今日は急がなくてよさそうです。", score: 95 },
      { direction: "contradiction" as const, opening: "安さより先に、見送る理由を確認したい一本です。", score: 88 },
    ] : []),
    ...(input.sourceType === "FOLLOW_UP" ? [
      { direction: "follow_up" as const, opening: hasTrend ? `前回${input.previousRanking}位から今日${input.ranking}位。これは続報で拾えます。` : input.seriesName ? `${input.seriesName}周辺、今日も追う理由があります。` : "昨日の注目枠として、もう一度だけ見ておきたい一本です。", score: hasTrend ? 96 : 82 },
    ] : []),
    ...(input.sourceType === "ACTRESS_TREND" ? [
      { direction: "curiosity" as const, opening: actress ? `${actress}は、こういう静かな作品の方が強く見える日があります。` : "女優軸で見ると、今日はこの候補が残ります。", score: 92 },
      { direction: "social_proof" as const, opening: actress ? `${actress}目当てで追うなら、評価より先に型を見たい一本です。` : "女優名だけで追うと、少し見方が変わります。", score: 88 },
    ] : []),
    ...(input.sourceType === "GENRE_TREND" ? [
      { direction: "comparison" as const, opening: input.genre ? `${input.genre.split(/[,、/]/)[0]}で探すなら、今日はランキング順だけで決めない方がよさそうです。` : "ジャンル軸で見ると、今日はランキング順だけでは決めにくいです。", score: 90 },
    ] : []),
    ...(input.sourceType === "MAKER_TREND" ? [
      { direction: "curiosity" as const, opening: input.seriesName ? `${input.seriesName}周辺は、メーカーの出し方まで含めて見たいです。` : "メーカー軸で見ると、今日は少し引っかかります。", score: 86 },
    ] : []),
    ...(input.sourceType === "PRICE_EVENT" ? [
      { direction: "curiosity" as const, opening: input.discountRate >= 30 ? `半額だけでなく、評価まで高いのが少し気になります。` : "今日は価格より、サンプルで刺さるかを先に見たいです。", score: 94 },
      { direction: "hot_take" as const, opening: "安いから即決、までは言いません。", score: 88 },
      { direction: "empathy" as const, opening: input.isNinetyDayLow ? "安いから買う、ではなく過去価格との差で止まる日です。" : `セール欄を流し見してる人ほど、${topic}は一回止まっていいと思います。`, score: 90 },
    ] : []),
    { direction: "missed", opening: `${topic}、最初は通りすぎてました。`, score: 78 + (input.imageUrl ? 4 : 0) },
    { direction: "curiosity", opening: `${topic}、数字より先に雰囲気で気になります。`, score: 76 + (input.reviewAverage ?? 0) * 3 },
    { direction: "contradiction", opening: fact && !fact.includes("ランキング") ? `${fact}まであるのに、押し出しは意外と静かです。` : "強く押されていないのに、妙に気になる一本です。", score: 70 + (facts.length * 7) },
    { direction: "comparison", opening: "ランキングだけ見ていると、こういう候補を落としがちです。", score: 68 + (input.ranking && input.ranking <= 80 ? 10 : 0) },
    { direction: "social_proof", opening: input.reviewAverage ? `知らない作品でも、ここまで評価が高いと少し見方が変わります。` : "知らない作品ほど、最初のひっかかりで決めたいです。", score: 66 + Math.min(input.reviewCount, 60) / 3 },
    { direction: "confession", opening: "正直、最初は通りすぎていました。", score: 68 + (input.imageUrl ? 4 : 0) },
    { direction: "hot_take", opening: intent === "MONEY" ? `安いだけなら流しますが、これは${moneyReason}のが引っかかります。` : "売れているかより、引っかかり方の方が気になります。", score: 73 + (input.isNinetyDayLow ? 6 : 0) },
    { direction: "surprise", opening: `${topic}、思ったより静かな顔をしてます。`, score: 76 + (facts.length * 5) },
    { direction: "empathy", opening: `セール欄を流し見してる人ほど、${topic}は一回止まっていいと思います。`, score: intent === "MONEY" ? 84 : 72 },
    { direction: "question", opening: `${topic}、まだ見てない人は多そうです。`, score: 80 },
    { direction: "follow_up", opening: hasTrend ? `前回${input.previousRanking}位から今日${input.ranking}位。これは続報で拾えます。` : subject ? `${subject}周辺は、もう少し追っていい気がします。` : "これは次も追っていい一本です。", score: hasTrend ? 92 : 50 },
  ];
  return openings.sort((a, b) => b.score - a.score).slice(0, 6);
}

function hookLine(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection) {
  const subject = input.seriesName ?? input.actress?.split(/[,、/]/)[0]?.trim() ?? input.genre?.split(/[,、/]/)[0]?.trim();
  const opening = hookOpenings(input, intent).find((item) => item.direction === direction)?.opening;
  if (opening) return opening;
  if (intent === "FOLLOW") return subject ? `${subject}周辺は、もう少し追っていい気がします。` : "こういう候補を毎日拾うためのメモです。";
  if (intent === "AUTHORITY") return "ランキングだけ見ていると、こういう候補を落としがちです。";
  return input.isNinetyDayLow ? "安いから買う、ではまだ弱いです。" : "クリック前に、見る理由だけ先に確認します。";
}

function judgmentLine(input: XCreativeInput, intent: XGrowthIntent) {
  if (input.sourceType === "JUDGMENT") {
    if (input.reviewAverage && input.reviewAverage < 4.2) return "値引きより、評価の低さが先に引っかかります。";
    if (!input.isNinetyDayLow && input.discountRate >= 30) return "値引きはありますが、価格優位だけで押すには少し弱いです。";
    if ((input.xPageViews ?? 0) >= 5 && (input.xFanzaClicks ?? 0) === 0) return "反応はあってもクリックに進んでいないので、今日は売り込まない判断でいいです。";
    return "買う理由より、見送る理由を先に置いた方が信頼を残せます。";
  }
  if (input.sourceType === "MARKET") return "一覧を流す前に、一回止まる理由だけ残せば十分です。";
  if (input.sourceType === "COMPARISON") return "安さで並べても、最後は見たい空気がある方に寄ります。";
  if (input.sourceType === "HIDDEN_GEM") {
    if (input.discountRate >= 30) return "セール目的じゃなくても、一度サンプルまで見てほしい一本です。";
    if (input.reviewAverage && input.reviewAverage >= 4.6) return "ランキングだけなら見落とすけど、評価まで見ると少し残ります。";
    return "ジャケだけで判断しない方がいいタイプです。";
  }
  if (input.sourceType === "ACTRESS_TREND") {
    if (primaryActress(input)) return "女優目当てなら、タイトルより中身寄りで一度見ていい一本です。";
    return "タイトルより中身寄りで、一度見方を変えていい一本です。";
  }
  if (input.sourceType === "PRICE_EVENT") return "半額だけでなく評価も高いので、気になっていたなら今日は見ていいと思います。";
  if (intent === "REACH") return input.hasRightsCheckedMovie ? "動画で一瞬止められるなら、今日はこの形が一番自然です。" : "派手に煽るより、違和感だけ置いた方が読まれそうです。";
  if (intent === "FOLLOW") return "タイトルより中身寄りで見る方が合っています。";
  if (intent === "AUTHORITY") {
    if (input.ranking && input.ranking <= 80 && input.reviewAverage) return "数字を少し添えるだけで、流すには惜しい理由が出ます。";
    return input.reviewAverage ? "サンプルの方が強いかどうかまで見ると判断しやすいです。" : "評価と価格を分けて見ると、判断しやすい一本です。";
  }
  if (intent === "CONVERSATION") return "外の投稿に乗るなら、断定より一つだけ事実を添える方がよさそうです。";
  return input.discountRate >= 30 || input.isNinetyDayLow ? "気になっていたなら、価格とサンプルを見て決めていい日です。" : "急がず、他の一本と比べてからでよさそうです。";
}

function humanProofLine(input: XCreativeInput, intent: XGrowthIntent) {
  const facts = strongestFacts(input);
  if (!facts.length) return "";
  if (intent === "MONEY") {
    if (input.isNinetyDayLow) return input.reviewAverage && input.reviewAverage >= 4.6 ? `${facts.find((fact) => fact.startsWith("評価")) ?? ""} / 過去90日最安級`.replace(/^ \/ /, "") : "過去90日最安級";
    return facts[0];
  }
  return facts.slice(0, 1).join(" / ");
}

function moneyClickReason(input: XCreativeInput) {
  if (input.isNinetyDayLow) return "気になってた人は、今日はサンプルまで見てから決めていいと思います。";
  if (input.saleEndAt) return "迷っていた人は、期限だけ先に見ておくと判断しやすいです。";
  if (input.discountRate >= 30) return "値段だけで決めず、サンプルで刺さるか確認するくらいがちょうどいいです。";
  return "急がず、他の一本と比べてからでよさそうです。";
}

function mediaFor(input: XCreativeInput, intent: XGrowthIntent): XCreativeMedia {
  if (intent === "MONEY") return "existing_link_image";
  if (intent === "CONVERSATION") return "quote";
  if ((input.mediaManualTags ?? []).includes("too_explicit_for_reach") || (input.mediaManualTags ?? []).includes("weak_visual") || input.mediaQuality === "weak") return input.imageUrl ? "existing_link_image" : "text";
  if (input.hasRightsCheckedMovie && input.sampleMovieUrl && (intent === "REACH" || intent === "FOLLOW" || intent === "AUTHORITY")) return "sample_movie";
  if (input.imageUrl && input.sourceType !== "MARKET" && input.sourceType !== "COMPARISON" && input.sourceType !== "JUDGMENT") return "existing_link_image";
  if ((input.sourceType === "MARKET" || input.sourceType === "COMPARISON" || input.sourceType === "JUDGMENT") && evidenceLines(input).length >= 2) return "data_card";
  return "text";
}

function variantPlan(intent: XGrowthIntent): { structure: XCreativeStructure; linkPlan: XLinkPlan; cta: XCtaStrategy } {
  if (intent === "REACH") return { structure: "short", linkPlan: "no_link", cta: "reason_cta" };
  if (intent === "FOLLOW") return { structure: "follow_up", linkPlan: "profile_only", cta: "reason_cta" };
  if (intent === "AUTHORITY") return { structure: "judgment", linkPlan: "no_link", cta: "reason_cta" };
  if (intent === "CONVERSATION") return { structure: "question", linkPlan: "no_link", cta: "reason_cta" };
  return { structure: "data", linkPlan: "body_link", cta: "price_cta" };
}

function buildBody(input: XCreativeInput, intent: XGrowthIntent, structure: XCreativeStructure, linkPlan: XLinkPlan, direction: XHookDirection) {
  const proofLine = humanProofLine(input, intent);
  const judgment = intent === "MONEY" ? moneyClickReason(input) : judgmentLine(input, intent);
  const lines = [
    hookLine(input, intent, direction),
    proofLine,
    input.title.length <= 42 ? "__TITLE__" : "",
    judgment,
  ].filter(Boolean);
    if (input.sourceType === "COMPARISON" && input.genre) lines.splice(1, 0, `${input.genre.split(/[,、/]/)[0]}で迷う人は、先に雰囲気が合う方からでよさそうです。`);
  if (intent === "FOLLOW" && !proofLine) lines.push("こういう候補を、毎日ひとつずつ拾っています。");
  if (linkPlan === "body_link") lines.push(input.url);
  return sanitizePublicText(formatText(lines, input.title));
}

function sanitizePublicText(text: string) {
  return FORBIDDEN_PUBLIC_WORDS.reduce((current, word) => current.replaceAll(word, ""), text)
    .replace(/[.…]{2,}/g, "")
    .replace(/\s+寄り/g, "寄り")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NATIVE_X_FORBIDDEN_PHRASES = [
  "このズレだけで、一回止まる理由になります",
  "今日は短く見て決められます",
  "まず見る場所",
  "どこを見るか",
  "タイトルだけなら流してました",
  "サンプルまで見ると印象が変わる",
  "理由になります",
  "方が外しにくい",
  "で決めやすい",
  "確認する価値",
  "画像で雰囲気は伝わるので",
  "本文は短くてよさそう",
  "カードは補助",
  "気になる一本だけ見れば足ります",
  "気になっていたなら今日は",
];

function finalNativeXVoiceGate(input: XCreativeInput, variant: { intent: XGrowthIntent; mediaType: XCreativeMedia; text: string }) {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const joined = variant.text;
  const forbiddenHits = NATIVE_X_FORBIDDEN_PHRASES.filter((phrase) => joined.includes(phrase));
  const softTemplateHits = ["刺さるなら", "見ていいと思います", "な一本です", "タイプです"].filter((phrase) => joined.includes(phrase));
  const recentSevenDays = (input.recentLogs ?? []).filter((log) => Date.now() - new Date(log.posted_at).getTime() <= 7 * 86_400_000);
  const recentSimilarity = Math.max(0, ...recentSevenDays.slice(0, 30).map((log) => similarity(joined, log.post_text)));
  const firstChars = first.replace(/[0-9０-９]+/g, "#").replace(/\s+/g, "").slice(0, 20);
  const sentencePattern = lines.map((line) => /評価|ランキング|OFF|円|レビュー/.test(line) ? "proof" : /^https?:\/\//.test(line) ? "link" : "story").join("+");
  const subjectPosition = primaryActress(input) && first.startsWith(primaryActress(input) ?? "") ? "actress_first" : first.startsWith("「") ? "title_first" : /今日|同じ|似た|ランキング|安い/.test(first) ? "market_first" : "feeling_first";
  const endingStyle = (lines.at(-1) ?? "").replace(/[0-9０-９]+/g, "#").slice(0, 18);
  const sameFingerprintCount = recentSevenDays.filter((log) => {
    const logLines = log.post_text.split("\n").map((line) => line.trim()).filter(Boolean);
    const logFirst = logLines[0] ?? "";
    const logPattern = logLines.map((line) => /評価|ランキング|OFF|円|レビュー/.test(line) ? "proof" : /^https?:\/\//.test(line) ? "link" : "story").join("+");
    const logSubject = primaryActress(input) && logFirst.startsWith(primaryActress(input) ?? "") ? "actress_first" : logFirst.startsWith("「") ? "title_first" : /今日|同じ|似た|ランキング|安い/.test(logFirst) ? "market_first" : "feeling_first";
    return logPattern === sentencePattern && logSubject === subjectPosition;
  }).length;
  const frequentPhraseHits = lines.filter((line) => line.length >= 8 && recentSevenDays.filter((log) => log.post_text.includes(line)).length >= 2);
  const digitCount = (joined.match(/\d/g) ?? []).length;
  const startsWithActressEveryTime = Boolean(primaryActress(input) && first.startsWith(primaryActress(input) ?? ""));
  const reviewSiteTone = /確認|判断|価値|優先|採用|根拠|訴求|導線|おすすめ/.test(joined);
  const operatorVoice = /止まる理由|読まれ|使う|投稿|本文|Hook|動画を置く|運用|REACH|クリック/.test(joined);
  const emotionalFirstLine = /気になる|止ま|好き|違う|ズレ|迷う|見落|空気|こっち|正直|なんか|意外|早い|もったいない|外しそう|引っか|流して|弱い|強い|合う|寄って|印象|ジャケ|決めない|半額だけ|数字より|選び方|差が|差あり/.test(first);
  const tooPolished = lines.length >= 3 && lines.every((line) => /です。|ます。|ました。|ます$|です$/.test(line));
  const brokenText = /、です|で、。|。、|^、|。\s*、/.test(joined);
  const checks = {
    timelineNative: lines.length >= 1 && lines.length <= 3 && first.length >= 8 && digitCount <= (variant.intent === "MONEY" ? 10 : 6),
    notOperatorVoice: !operatorVoice,
    notReviewSite: !reviewSiteTone || variant.intent === "MONEY",
    emotionalFirstLine,
    notTooPolished: !tooPolished,
    noTemplateReuse: forbiddenHits.length === 0 && softTemplateHits.length <= 1 && recentSimilarity < 0.58 && sameFingerprintCount < 2 && frequentPhraseHits.length === 0,
    subjectVariety: !startsWithActressEveryTime || emotionalFirstLine || variant.mediaType === "sample_movie",
  };
  const reasons = [
    !checks.timelineNative ? "Xの流れより説明文に寄っている" : "",
    !checks.notOperatorVoice ? "運用者視点の言葉が残っている" : "",
    !checks.notReviewSite ? "レビューサイト文っぽい" : "",
    !checks.emotionalFirstLine ? "1行目に感情・違和感・発見が薄い" : "",
    !checks.notTooPolished ? "整いすぎてAIテンプレに見える" : "",
    brokenText ? "禁止語除去後の文が不自然" : "",
    !checks.noTemplateReuse ? `直近/禁止テンプレ重複${forbiddenHits.length ? `: ${forbiddenHits.join(", ")}` : frequentPhraseHits.length ? `: ${frequentPhraseHits.join(", ")}` : sameFingerprintCount >= 2 ? `: 同型fingerprint ${sameFingerprintCount}回` : recentSimilarity >= 0.58 ? `: 類似度${Math.round(recentSimilarity * 100)}%` : ""}` : "",
    !checks.subjectVariety ? "女優名冒頭の型に寄りすぎ" : "",
  ].filter(Boolean);
  void firstChars;
  void endingStyle;
  return { passed: reasons.length === 0, checks, forbiddenHits: [...forbiddenHits, ...softTemplateHits, ...frequentPhraseHits], reasons };
}

function finalHumanVoiceGate(input: XCreativeInput, variant: { intent: XGrowthIntent; linkPlan: XLinkPlan; text: string }) {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const forbiddenHits = FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word));
  const repeatedFacts = factOccurrences(variant.text, input);
  const hasReaderVerb = /見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(variant.text);
  const internalMetricLeak = /発掘指数|買い時|CTR|PV|FANZA|Opportunity|Freshness|score|スコア|候補/.test(variant.text);
  const abstractOpening = /^(強い|弱い|良い|悪い|自然|安全|価値|候補|判断|確認)/.test(first) || first.length < 12;
  const checks = {
    xNative: lines.length >= 1 && lines.length <= 5 && !/[。\.].*[。\.].*[。\.]/.test(first),
    audienceClear: Boolean(primaryActress(input) || input.genre || first.includes("今日") || first.includes("同じ") || first.includes("半額") || first.includes("ランキング")),
    readerAction: hasReaderVerb,
    noInternalMetric: !internalMetricLeak && forbiddenHits.length === 0,
    noRepeatedFact: repeatedFacts.length === 0,
    concreteOpening: !abstractOpening && !lineStartsWithNumber(variant.text),
  };
  const reasons = [
    !checks.xNative ? "普通のX投稿より説明文に寄っている" : "",
    !checks.audienceClear ? "誰向けの話か冒頭で分かりにくい" : "",
    !checks.readerAction ? "読者の行動/感情に翻訳されていない" : "",
    !checks.noInternalMetric ? `内部/運用者語が残っている${forbiddenHits.length ? `: ${forbiddenHits.join(", ")}` : ""}` : "",
    !checks.noRepeatedFact ? `同じ事実を繰り返している: ${repeatedFacts.join(", ")}` : "",
    !checks.concreteOpening ? "1行目が抽象判断または数字始まり" : "",
  ].filter(Boolean);
  return { passed: reasons.length === 0, checks, forbiddenHits, reasons };
}

function similarity(a: string, b: string) {
  const tokens = new Set(a.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const other = new Set(b.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const overlap = [...tokens].filter((token) => other.has(token)).length;
  return overlap / Math.max(tokens.size, other.size, 1);
}

function factOccurrences(text: string, input: XCreativeInput) {
  const facts = [
    input.reviewAverage ? `評価${input.reviewAverage.toFixed(1)}` : "",
    input.ranking ? `ランキング${input.ranking}位` : "",
    input.currentPrice ? yen(input.currentPrice) : "",
    input.discountRate >= 1 ? pct(input.discountRate) : "",
    input.isNinetyDayLow ? "過去90日最安級" : "",
    primaryActress(input) ?? "",
  ].filter(Boolean);
  return facts.filter((fact) => text.split(fact).length - 1 >= 2);
}

function lineStartsWithNumber(text: string) {
  const first = text.split("\n")[0] ?? "";
  if (/^\s*[0-9０-９]+%OFFだけど/.test(first)) return false;
  return /^\s*(評価|レビュー|過去90日|\d|[0-9０-９])/.test(first);
}

function lastMileGate(input: XCreativeInput, variant: { intent: XGrowthIntent; mediaType: XCreativeMedia; linkPlan: XLinkPlan; text: string }, rewriteCount: number) {
  const lines = variant.text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const forbiddenHits = FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word));
  const temporalHits = hasRankingTrend(input) ? [] : FORBIDDEN_TEMPORAL_WORDS.filter((word) => variant.text.includes(word));
  const repeated = factOccurrences(variant.text, input);
  const repeatedPhrases = ["こういう", "これ"].filter((word) => variant.text.split(word).length - 1 >= 2);
  const slashFacts = (variant.text.match(/\//g) ?? []).length;
  const digitCount = (variant.text.match(/\d/g) ?? []).length;
  const titleTooForced = input.title.length > 42 && variant.text.includes(input.title);
  const hasConcreteEntry = Boolean(primaryActress(input) || input.genre || input.imageUrl || input.reviewAverage || input.ranking || input.isNinetyDayLow);
  const reachApprovalFailures = variant.intent === "REACH" ? [
    !hasConcreteEntry || first.length < 14 ? "REACH Approval: 1行目が具体的ではない" : "",
    /市場|傾向|分析|データ|報告/.test(variant.text) && !/見る|迷|止ま|外|差|カード|サンプル/.test(variant.text) ? "REACH Approval: 抽象的な市場説明で終わっている" : "",
    variant.mediaType === "text" && !/ランキング|評価|半額|OFF|見落|差|迷|女優|ジャンル|サンプル/.test(variant.text) ? "REACH Approval: 画像/比較/強い題材のどれも弱い" : "",
    !/今日|今|セール|迷|サンプル|ランキング|半額|OFF|動画|ジャケ|冒頭|開いてすぐ/.test(variant.text) ? "REACH Approval: なぜ今見るかが弱い" : "",
    evaluateAdSmell(variant.text, variant.linkPlan, input) > 30 ? "REACH Approval: 広告臭が強い" : "",
  ].filter(Boolean) : [];
  const mediaWeak = variant.mediaType === "text" && !first.includes("見落") && !first.includes("流し") && !first.includes("なぜ") && !first.includes("？") && !first.includes("ひっか") && !first.includes("今日") && !first.includes("同じ") && !first.includes("見送");
  const humanVoice = finalHumanVoiceGate(input, variant);
  const nativeXVoice = finalNativeXVoiceGate(input, variant);
  const reasons = [
    first.length < 12 ? "1行目が弱い" : "",
    lineStartsWithNumber(variant.text) ? "数字始まり" : "",
    forbiddenHits.length ? `内部/分析者臭: ${forbiddenHits.join(", ")}` : "",
    temporalHits.length ? `未確認時系列: ${temporalHits.join(", ")}` : "",
    repeated.length ? `同一事実の重複: ${repeated.join(", ")}` : "",
    repeatedPhrases.length ? `同じ言い回しの重複: ${repeatedPhrases.join(", ")}` : "",
    slashFacts >= 2 || digitCount >= 14 ? "数字羅列に見える" : "",
    !hasConcreteEntry ? "作品を知らない人の入口が弱い" : "",
    titleTooForced || variant.text.includes("…") ? "長い作品名の機械的処理が残っている" : "",
    variant.intent === "MONEY" && variant.linkPlan !== "body_link" ? "MONEYなのにリンクがない" : "",
    variant.intent !== "MONEY" && variant.linkPlan === "body_link" ? "認知投稿に直リンクが強すぎる" : "",
    mediaWeak ? "テキストのみのHookが弱い" : "",
    ...reachApprovalFailures,
    ...humanVoice.reasons.map((reason) => `Human Voice Gate: ${reason}`),
    ...nativeXVoice.reasons.map((reason) => `Native X Voice Gate: ${reason}`),
  ].filter(Boolean);
  return {
    verdict: reasons.length === 0 ? "post_ok" as const : reasons.length <= 2 ? "revise" as const : "do_not_post" as const,
    passed: reasons.length === 0,
    reasons,
    rewriteCount,
    humanVoice,
    nativeXVoice,
  };
}

function evaluateAdSmell(text: string, linkPlan: XLinkPlan, input: XCreativeInput) {
  let penalty = PROMO_WORDS.reduce((sum, word) => sum + (text.includes(word) ? 12 : 0), 0);
  if (linkPlan === "body_link") penalty += 18;
  if (input.discountRate >= 30 && evidenceLines(input).length <= 1) penalty += 18;
  if ((text.match(/\d/g) ?? []).length >= 12) penalty += 18;
  if ((text.match(/\//g) ?? []).length >= 3) penalty += 14;
  if ((text.match(/#PR|#FANZA/g) ?? []).length > 0) penalty += 16;
  return clamp(penalty);
}

function qualityFor(input: XCreativeInput, variant: { intent: XGrowthIntent; structure: XCreativeStructure; mediaType: XCreativeMedia; linkPlan: XLinkPlan; text: string }) {
  const proofCount = strongestFacts(input).length;
  const videoTag = primaryVideoTag(input);
  const reachSourceSignal = input.sourceType === "MARKET" || input.sourceType === "COMPARISON" || input.sourceType === "JUDGMENT" ? 18 : 0;
  const reachTextHook = variant.text.includes("今日") || variant.text.includes("同じ") || variant.text.includes("見送") || variant.text.includes("偏り") || variant.text.includes("差が") || variant.text.includes("迷う") || variant.text.includes("冒頭") || variant.text.includes("ジャケ") || variant.text.includes("動画") ? 16 : 0;
  const firstSecondsBoost = variant.intent === "REACH" && variant.mediaType === "sample_movie" && videoTag === "first_seconds_strong" && input.mediaQuality === "strong" ? 28 : 0;
  const mediaStoryFit = variant.mediaType === "sample_movie"
    ? ((videoTag === "first_seconds_strong" || videoTag === "visual_mismatch" || videoTag === "scene_surprise" || videoTag === "actress_fit") && variant.text.split("\n").filter(Boolean).length <= 3 && !variant.text.includes("http") ? 98 : variant.text.split("\n").filter(Boolean).length <= 3 && !variant.text.includes("http") ? 88 : 72)
    : variant.mediaType === "data_card"
      ? (/カード|どこから見る|見るなら|迷う|差|ランキングだけ/.test(variant.text) && (variant.text.match(/\d/g) ?? []).length <= 8 ? 92 : 68)
      : variant.mediaType === "existing_link_image"
        ? (variant.intent === "MONEY" ? 84 : /ジャケ|画像|雰囲気|見た|止ま|流し|気にな|印象/.test(variant.text) ? 88 : 76)
        : (/ランキング|評価|半額|OFF|見落|差|迷|サンプル/.test(variant.text) ? 74 : 55);
  const adSmell = evaluateAdSmell(variant.text, variant.linkPlan, input);
  const forbiddenHits = FORBIDDEN_PUBLIC_WORDS.filter((word) => variant.text.includes(word));
  const temporalHits = hasRankingTrend(input) ? [] : FORBIDDEN_TEMPORAL_WORDS.filter((word) => variant.text.includes(word));
  const recentSimilarity = Math.max(0, ...(input.recentLogs ?? []).slice(0, 12).map((log) => similarity(variant.text, log.post_text)));
  const sameStructureCount = (input.recentLogs ?? []).slice(0, 8).filter((log) => String(log.creative_genome?.structure ?? "").includes(variant.structure)).length;
  const historicalWinnerBonus = (input.recentLogs ?? []).slice(0, 60).some((log) => log.hook_type === calculateHookScore(input).bestHook.type && ((log.impressions_24h ?? 0) >= 500 || (log.profile_visits_24h ?? 0) > 0 || (log.follows_24h ?? 0) > 0)) ? 5 : 0;
  const noveltyPenalty = Math.round(recentSimilarity * 40) + sameStructureCount * 8;
  const dimensions: Record<XQualityDimension, number> = {
    scrollStop: clamp(42 + reachSourceSignal + reachTextHook + firstSecondsBoost + (input.ranking && input.ranking <= 50 ? 10 : 0) + (input.isNinetyDayLow ? 8 : 0) + (input.discoveryScore ?? 0) / 6),
    curiosity: clamp(45 + reachTextHook + (variant.text.includes("なぜ") || variant.text.includes("ズレ") || variant.text.includes("不自然") || variant.text.includes("印象") || variant.text.includes("流して") || variant.text.includes("偏り") ? 24 : 0) + proofCount * 5),
    proof: clamp(30 + proofCount * 16 + (input.seriesObservationCount ?? 0) * 2),
    judgment: clamp(variant.text.includes("近い") || variant.text.includes("見落と") || variant.text.includes("サンプル") || variant.text.includes("決め") || variant.text.includes("外し") || variant.text.includes("迷う") || variant.text.includes("差") ? 80 : 48),
    followValue: clamp(variant.intent === "FOLLOW" ? 62 + proofCount * 8 : variant.intent === "AUTHORITY" ? 58 + proofCount * 6 : 42 + proofCount * 4),
    specificity: clamp(36 + proofCount * 14 + (input.currentPrice ? 8 : 0) + (input.reviewCount ? 8 : 0)),
    novelty: clamp(82 - noveltyPenalty + (variant.structure === "question" ? 6 : 0) + historicalWinnerBonus),
    adSmell,
    ctaFit: clamp(variant.intent === "MONEY" ? (variant.linkPlan === "body_link" ? 86 : 58) : variant.linkPlan === "body_link" ? 30 : 82),
    mediaFit: clamp(variant.mediaType === "sample_movie" && !input.hasRightsCheckedMovie ? 0 : mediaStoryFit),
    shareability: clamp(44 + (input.sourceType === "MARKET" || input.sourceType === "COMPARISON" || input.sourceType === "JUDGMENT" ? 22 : 0) + (variant.text.includes("こういう") || variant.text.includes("流して") || variant.text.includes("ランキングだけ") ? 18 : 0) + (variant.text.includes("見落と") || variant.text.includes("一回止ま") || variant.text.includes("外し") || variant.text.includes("差が") ? 16 : 0) + (variant.linkPlan === "body_link" ? -10 : 8)),
    replyability: clamp(38 + (variant.text.includes("なぜ") || variant.text.includes("気になります") || variant.text.includes("弱いです") || variant.text.includes("迷う") || variant.text.includes("こっち") ? 20 : 0) + (variant.intent === "AUTHORITY" ? 10 : 0)),
  };
  const rules: Record<XGrowthIntent, Array<[XQualityDimension, number]>> = {
    REACH: [["scrollStop", 70], ["curiosity", 62], ["shareability", 58], ["novelty", 62], ["ctaFit", 70], ["mediaFit", 60]],
    FOLLOW: [["followValue", 70], ["judgment", 68], ["specificity", 62], ["novelty", 55]],
    AUTHORITY: [["proof", 54], ["judgment", 72], ["replyability", 56], ["adSmell", 0], ["mediaFit", 60]],
    MONEY: [["proof", 58], ["ctaFit", 75], ["mediaFit", 65]],
    CONVERSATION: [["curiosity", 68], ["judgment", 64], ["adSmell", 0]],
  };
  const failed = rules[variant.intent]
    .filter(([key, min]) => key === "adSmell" ? dimensions.adSmell > (variant.intent === "MONEY" ? 45 : 24) : dimensions[key] < min)
    .map(([key]) => key);
  const lastMile = lastMileGate(input, variant, 0);
  if (forbiddenHits.length || temporalHits.length || variant.text.includes("…") || !lastMile.passed || !lastMile.humanVoice.passed || !lastMile.nativeXVoice.passed) failed.push("specificity");
  const total = variant.intent === "REACH"
    ? clamp(dimensions.scrollStop * 0.2 + dimensions.curiosity * 0.14 + dimensions.shareability * 0.17 + dimensions.replyability * 0.08 + dimensions.followValue * 0.09 + dimensions.mediaFit * 0.17 + dimensions.novelty * 0.12 + (100 - dimensions.adSmell) * 0.03)
    : clamp((dimensions.scrollStop + dimensions.curiosity + dimensions.proof + dimensions.judgment + dimensions.followValue + dimensions.specificity + dimensions.novelty + dimensions.ctaFit + dimensions.mediaFit + dimensions.shareability + dimensions.replyability + (100 - dimensions.adSmell)) / 12);
  const passed = lastMile.passed && lastMile.humanVoice.passed && lastMile.nativeXVoice.passed && forbiddenHits.length === 0 && temporalHits.length === 0 && !variant.text.includes("…") && failed.length === 0 && total >= (variant.intent === "MONEY" ? 68 : variant.intent === "REACH" ? 70 : 72) && getXWeightedLength(variant.text) <= 280;
  return {
    dimensions,
    total,
    passed,
    recommendation: passed ? "post" as const : total >= 62 ? "revise" as const : "do_not_post" as const,
    reasons: {
      scrollStop: "ランキング、過去最安、発掘指数など冒頭に使える異常値から算出",
      curiosity: "疑問、ズレ、不自然さ、根拠の出し惜しみを文面から判定",
      proof: "価格、ランキング、レビュー、発掘指数、買い時、価格系列数から算出",
      judgment: "数字の意味づけが入っているかを文面から判定",
      followValue: "継続して追う理由、メディアとしての視点、シリーズ性から算出",
      specificity: lastMile.reasons.length ? `Last-Mile Gate: ${lastMile.reasons.join(" / ")}` : forbiddenHits.length ? `投稿本文に内部語が残っています: ${forbiddenHits.join(", ")}` : temporalHits.length ? `履歴不足で使えない時系列表現があります: ${temporalHits.join(", ")}` : variant.text.includes("…") ? "完成文に機械的な省略記号が残っています" : "具体的な数値と作品固有情報の量から算出",
      novelty: `直近投稿との最大類似度${Math.round(recentSimilarity * 100)}%、同型連投${sameStructureCount}件から減点`,
      adSmell: `販促語、直リンク、セール率だけの訴求、PRタグ臭を減点。検出値${adSmell}`,
      ctaFit: "intentに対してリンクとCTAが強すぎないかを判定",
      mediaFit: variant.mediaType === "sample_movie" && videoTag ? `動画manual tag ${videoTag} と短文Hookの噛み合いを判定。REACHでは冒頭力を価格/評価より優先` : "素材種別と本文の役割が噛み合うかを判定。カードなら比較、動画なら短いHookを重視",
      shareability: "広告ではなく、他人にも見せたくなる違和感や比較があるかを判定",
      replyability: "問い、反論、補足が生まれやすい余白があるかを判定",
    },
    weaknesses: failed,
    improvements: [...lastMile.reasons, ...failed.map((key) => key === "adSmell" ? "販促語と直リンクを弱め、データ判断を前に出す" : key === "proof" ? "価格・ランキング・レビューの根拠が薄いので投稿しない候補に寄せる" : key === "novelty" ? "冒頭型か構造を変えて同型連投を避ける" : `${key}を補強する`)],
    gate: { intent: variant.intent, passed, required: rules[variant.intent].map(([key, min]) => key === "adSmell" ? "Ad Smellを低く保つ" : `${key} >= ${min}`), failed },
    lastMile,
  };
}

function buildLastMileBodies(input: XCreativeInput, intent: XGrowthIntent, linkPlan: XLinkPlan, direction: XHookDirection) {
  const actress = primaryActress(input);
  const topic = actress ? `${actress}のこれ` : safeTitleFragment(input);
  const naturalTopic = actress ? `${actress}でこれ` : safeTitleFragment(input);
  const proof = humanProofLine(input, intent);
  const proofSentence = proof ? proof.startsWith("評価") ? `でも${proof}。` : `${proof}です。` : "";
  const link = linkPlan === "body_link" ? input.url : "";
  const moneyReason = moneyClickReason(input);
  const reachReason = input.imageUrl ? "ジャケだけだと少し流してた。" : "知らなかった人でも、サンプルからなら入りやすい。";
  const videoLines = input.hasRightsCheckedMovie && input.sampleMovieUrl && intent !== "MONEY" ? videoSpecificLines(input, intent, linkPlan) : null;
  if (videoLines) {
    return [...new Set([
      formatText(videoLines, input.title),
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    ].map(sanitizePublicText))];
  }
  if (input.sourceType === "PRICE_EVENT") {
    return [...new Set([
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
      formatText([input.discountRate >= 30 ? "半額だけでなく、評価まで高いのが少し気になります。" : "今日は価格より、サンプルで刺さるかを先に見たいです。", proofSentence || proof, "気になっていたなら、今日は見ていいと思います。", link].filter(Boolean), input.title),
      formatText(["安いから即決、までは言いません。", proof, "でもサンプルで刺さるなら、今日見ておきたい一本です。", link].filter(Boolean), input.title),
    ].map(sanitizePublicText))];
  }
  if (input.hasRightsCheckedMovie && input.sampleMovieUrl && intent !== "MONEY") {
    const actress = primaryActress(input);
    const topic = actress ? `${actress}のこれ` : safeTitleFragment(input);
    return [...new Set([
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
      formatText([`${topic}、最初は通りすぎてました。`, proof || "", "動画で見た方が早い一本です。"].filter(Boolean), input.title),
      formatText([actress ? `${actress}でこれ、少し見落としてました。` : `${topic}、少し見落としてました。`, proof || "", "今日は動画だけで止めます。"].filter(Boolean), input.title),
      formatText([`${topic}、派手に煽るよりそのまま見た方が早いです。`, proof || "", "今日は見ていい一本だと思います。"].filter(Boolean), input.title),
    ].map(sanitizePublicText))];
  }
  if (input.sourceType === "MARKET") {
    const genre = input.genre?.split(/[,、/]/)[0]?.trim();
    const discount = input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "セール";
    return [...new Set([
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
      formatText([genre ? `今日の${discount}、${genre}に当たりが寄っています。` : `今日の${discount}、数より並び方の偏りが気になります。`, "一覧を流す前に、一回止まる理由だけ残せば十分です。"].filter(Boolean), input.title),
      formatText(["ランキングだけ見ていると、今日の当たりを外しそうです。", proof, "全部見るより、引っかかった一本だけでいい日。"].filter(Boolean), input.title),
      formatText([genre ? `今日はランキング順より、${genre}の並び方で止まりました。` : "今日はランキング順より、セール欄の並び方で止まりました。", "数字なしでも、並べると空気の違いは分かります。", "雰囲気が合う一本だけ拾えばいい日です。"].filter(Boolean), input.title),
    ].map(sanitizePublicText))];
  }
  if (input.sourceType === "COMPARISON") {
    return [...new Set([
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
      formatText([input.discountRate >= 30 ? `同じ${pct(input.discountRate)}OFFでも、サンプルを見るなら差があります。` : "似た条件でも、最初に気になる一本は変わります。", proof, "迷ったら安さより、雰囲気が合う方から見たいです。"].filter(Boolean), input.title),
      formatText(["3本で迷うなら、今日は最初の1本を決めてからでいいです。", "安さで並べても、最後は見たい空気がある方に寄ります。"].filter(Boolean), input.title),
    ].map(sanitizePublicText))];
  }
  if (input.sourceType === "JUDGMENT") {
    return [...new Set([
      buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
      formatText([input.discountRate >= 30 ? `${pct(input.discountRate)}OFFだけど、これは今日は見送っていいかもしれません。` : "売れてそうに見えても、今日は急がなくてよさそうです。", proof, "安さより、刺さる理由が弱い方が気になります。"].filter(Boolean), input.title),
    ].map(sanitizePublicText))];
  }
  const bodies = [
    buildBody(input, intent, variantPlan(intent).structure, linkPlan, direction),
    formatText([`${naturalTopic}、最初は見落としてました。`, proofSentence, intent === "MONEY" ? moneyReason : judgmentLine(input, intent), link].filter(Boolean), input.title),
    formatText([`${topic}は、ジャケだけで決めない方がよさそうです。`, proof, intent === "MONEY" ? moneyReason : reachReason, link].filter(Boolean), input.title),
    formatText([`セール欄を流し見してる人ほど、${topic}は一回止まっていいと思います。`, proof, intent === "MONEY" ? moneyReason : "派手に煽るより、この違和感だけで十分です。", link].filter(Boolean), input.title),
    formatText([`${topic}、まだ見てない人は多そうです。`, proof, intent === "MONEY" ? moneyReason : "知らなかった人でも、サンプルから入れば分かりやすい一本です。", link].filter(Boolean), input.title),
  ];
  return [...new Set(bodies.map(sanitizePublicText))];
}

function chooseFormat(input: XCreativeInput, hook: XHookType): XPostFormat {
  if (input.category === "actress_best") return "actress";
  if (["genre_best", "maker_best", "series_best"].includes(input.category)) return "comparison";
  if (hook === "buy_timing" || hook === "price_anomaly") return "buy_timing";
  if (hook === "rating_anomaly") return "rating_anomaly";
  if (hook === "review_proof") return "social_proof";
  return "discovery";
}

export function buildXCreativeVariants(input: XCreativeInput, hookScore = calculateHookScore(input)): XCreativeVariant[] {
  const intents = input.radarAvailable ? [...INTENTS, "CONVERSATION" as const] : INTENTS;
  return intents.flatMap((intent) => {
    const plan = variantPlan(intent);
    const mediaType = mediaFor(input, intent);
    const alternatives = hookOpenings(input, intent);
    return alternatives.slice(0, 5).map((alternative, alternativeIndex) => {
      const reviewed = buildLastMileBodies(input, intent, plan.linkPlan, alternative.direction)
        .map((text, index) => ({
          text,
          quality: qualityFor(input, { intent, structure: plan.structure, mediaType, linkPlan: plan.linkPlan, text }),
          rewriteCount: index,
        }))
        .sort((a, b) => Number(b.quality.passed) - Number(a.quality.passed) || b.quality.total - a.quality.total)[0];
      const text = reviewed.text;
      const quality = {
        ...reviewed.quality,
        lastMile: { ...lastMileGate(input, { intent, mediaType, linkPlan: plan.linkPlan, text }, reviewed.rewriteCount), rewriteCount: reviewed.rewriteCount },
      };
      const length = getXWeightedLength(text);
      const proof = strongestFacts(input).join(" / ") || "story_only";
      const buzzPotential = {
        total: intent === "REACH"
          ? clamp(quality.dimensions.scrollStop * 0.24 + quality.dimensions.shareability * 0.2 + quality.dimensions.mediaFit * 0.2 + quality.dimensions.curiosity * 0.14 + quality.dimensions.novelty * 0.12 + quality.dimensions.replyability * 0.1)
          : clamp(quality.dimensions.scrollStop * 0.18 + quality.dimensions.shareability * 0.16 + quality.dimensions.replyability * 0.14 + quality.dimensions.followValue * 0.18 + quality.dimensions.mediaFit * 0.16 + quality.dimensions.curiosity * 0.1 + quality.dimensions.novelty * 0.08),
        scrollStop: quality.dimensions.scrollStop,
        shareability: quality.dimensions.shareability,
        replyability: quality.dimensions.replyability,
        followValue: quality.dimensions.followValue,
        mediaFit: quality.dimensions.mediaFit,
        curiosity: quality.dimensions.curiosity,
        novelty: quality.dimensions.novelty,
        reason: mediaType === "sample_movie" ? "動画で止まりやすい"
          : alternative.direction === "contradiction" ? "一目で違和感が伝わる"
            : alternative.direction === "follow_up" ? "続報として会話が生まれやすい"
              : alternative.direction === "comparison" ? "比較で読まれやすい"
                : "自然なひっかかりで止める",
      };
      return {
      id: `${input.key}-${intent.toLowerCase()}-${plan.structure}-${alternative.direction}-${alternativeIndex}`,
      intent,
      postFormat: chooseFormat(input, hookScore.bestHook.type),
      hookType: hookScore.bestHook.type,
      structure: plan.structure,
      mediaType,
      imageStrategy: mediaType === "existing_link_image" ? "original_work_image" as const : "branded_data_card" as const,
      linkStrategy: plan.linkPlan === "body_link" ? "body_link" as const : "reply_link" as const,
      linkPlan: plan.linkPlan,
      ctaStrategy: plan.cta,
      bodyText: text,
      replyText: plan.linkPlan === "reply_link" ? formatText(["必要な時だけ確認用です。", input.url], input.title) : null,
      url: input.url,
      rationale: `${hookScore.bestHook.label}: ${hookScore.bestHook.evidence} / ${intent}向け`,
      weightedLength: length,
      quality,
      buzzPotential,
      hookDirection: alternative.direction,
      hookAlternatives: alternatives,
      creativeGenome: {
        topic: input.category,
        intent,
        hook: hookScore.bestHook.type,
        proof,
        structure: plan.structure,
        emotion: intent === "MONEY" ? "confidence" : "curiosity",
        length: length <= 150 ? "short" : "medium",
        media: mediaType,
        cta: plan.cta,
        linkStrategy: plan.linkPlan,
        postingSlot: input.recommendedSlot ?? "mixed",
      },
    };
    });
  }).sort((a, b) => Number(b.quality.passed) - Number(a.quality.passed) || b.quality.total - a.quality.total);
}
