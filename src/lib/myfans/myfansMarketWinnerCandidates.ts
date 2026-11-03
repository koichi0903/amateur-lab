import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "../myfansAnalytics";
import {
  calculateWinnerScore,
  evaluateCrossAccountGuard,
  type CrossAccountGuard,
  type GuardDecision,
  type MarketPatternKey,
  type WinnerScoreComponents,
  winnerScoreComponents,
} from "../myfansMarketWinner";

export type MarketWinnerPatternRow = {
  id: number;
  pattern_key: MarketPatternKey;
  name: string;
  objective_compatibility: string[];
  initial_weight: number;
  metadata: Record<string, unknown>;
};

export type MarketWinnerOpportunity = {
  id: number;
  patternKey: MarketPatternKey;
  patternName: string;
  sourceXUrl: string;
  sourceExcerpt: string;
  productTitle: string;
  productId: number | null;
  creatorName: string;
  creatorId: number | null;
  winnerScore: number;
  scoreComponents: WinnerScoreComponents;
  guard: { blocked: boolean; penalty: number; reasons: string[] };
  explanation: Record<string, unknown>;
};

export type MarketWinnerCandidateRow = {
  opportunity: MarketWinnerOpportunity;
  payload: Record<string, unknown>;
};

export type MarketWinnerLearningRow = {
  pattern_id: number;
  quote_candidate_id: number | null;
  product_id: number | null;
  posterior_weight: number | null;
};

export type SavedMarketWinnerRow = {
  id: number;
  pattern_id: number;
  quote_candidate_id: number | null;
  product_id: number | null;
  creator_id: number | null;
  source_x_url: string;
  winner_score: number;
  score_components: WinnerScoreComponents;
  explanation: Record<string, unknown>;
  status: string;
};

export type MarketWinnerPatternLabel = Pick<MarketWinnerPatternRow, "id" | "pattern_key" | "name">;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function fingerprint(quote: MyfansQuoteCandidate) {
  return [quote.x_post_url, quote.text_excerpt].join("|").toLowerCase().replace(/\s+/g, " ").trim();
}

function productScore(product: MyfansProduct | null) {
  if (!product) return 0;
  return clamp(Math.min(100, product.selection_score ?? 0) * 0.6 + (product.is_new ? 20 : 0) + Math.min(20, product.likes_count / 100));
}

function creatorScore(quote: MyfansQuoteCandidate) {
  return clamp((quote.creator_rank ? Math.max(0, 100 - quote.creator_rank) : 40) + Math.min(30, (quote.views ?? 0) / 10000));
}

type PatternScorer = (quote: MyfansQuoteCandidate, product: MyfansProduct | null, text: string) => number;

const PATTERN_SCORERS: Record<MarketPatternKey, PatternScorer> = {
  QUOTE_HOOK: (quote) => quote.text_excerpt.length >= 12 ? 92 : 55,
  PRICE_DROP: (quote, product, text) => product && (product.price > 0 || /値下げ|セール|割引|価格/.test(text)) ? 85 : 20,
  LIMITED_WINDOW: (_quote, _product, text) => /期間|限定|残り|終了|今日|まで/.test(text) ? 88 : 18,
  CREATOR_DISCOVERY: (quote) => quote.creator_id ? 82 : 35,
  COMPARISON: (_quote, product, text) => /比較|より|どっち|違い|選ぶ/.test(text) ? 86 : product ? 58 : 22,
  NEW_RELEASE: (_quote, product) => product?.is_new ? 90 : 26,
  SOCIAL_PROOF: (quote) => Math.min(95, 35 + (quote.likes ?? 0) / 20 + (quote.reposts ?? 0) / 5),
  CURIOSITY_GAP: (quote, _product, text) => /[？?]|なぜ|どうして|気になる|知らない/.test(text) ? 88 : quote.text_excerpt.length > 20 ? 62 : 30,
  FOLLOW_SERIES: (_quote, _product, text) => /続き|次回|シリーズ|第[一二三四五六七八九十0-9]+/.test(text) ? 90 : 24,
};

function patternFit(key: MarketPatternKey, quote: MyfansQuoteCandidate, product: MyfansProduct | null) {
  const text = `${quote.text_excerpt} ${product?.title ?? ""}`;
  return clamp(PATTERN_SCORERS[key](quote, product, text));
}

function objectiveFor(key: MarketPatternKey, pattern: MarketWinnerPatternRow) {
  return pattern.objective_compatibility?.[0] ?? (key.includes("PRICE") || key === "COMPARISON" ? "click" : "impression");
}

function selectCandidateQuotes(quotes: MyfansQuoteCandidate[]) {
  return quotes
    .filter((quote) => Boolean(quote.x_post_url))
    .sort((a, b) => (b.global_score ?? b.score) - (a.global_score ?? a.score) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 40);
}

function createCandidate(quote: MyfansQuoteCandidate, product: MyfansProduct | null, pattern: MarketWinnerPatternRow, learningRows: MarketWinnerLearningRow[]) {
  const learning = learningRows.find((row) => row.pattern_id === pattern.id && (!row.quote_candidate_id || row.quote_candidate_id === quote.id) && (!row.product_id || row.product_id === product?.id));
  return {
    sourceXUrl: quote.x_post_url,
    body: quote.text_excerpt,
    productId: product?.id ?? null,
    creatorId: quote.creator_id ?? product?.creator_id ?? null,
    quoteCandidateId: quote.id,
    sourceStrength: clamp(quote.global_score ?? quote.score ?? 0),
    productOpportunity: productScore(product),
    creatorStrength: creatorScore(quote),
    patternFit: patternFit(pattern.pattern_key, quote, product),
    learningWeight: Number(learning?.posterior_weight ?? pattern.initial_weight ?? 1),
    globalContentFingerprint: fingerprint(quote),
  };
}

function scoreReasons(components: WinnerScoreComponents, penalty: number) {
  return [
    `pattern ${components.patternFit}/100`,
    `source ${components.sourceStrength}/100`,
    `product ${components.productOpportunity}/100`,
    `creator ${components.creatorStrength}/100`,
    `learning ${components.learningWeight}`,
    penalty ? `guard penalty -${penalty}` : "guard penalty 0",
  ];
}

function createExplanation(quote: MyfansQuoteCandidate, pattern: MarketWinnerPatternRow, guard: GuardDecision, components: WinnerScoreComponents) {
  const objective = objectiveFor(pattern.pattern_key, pattern);
  return {
    objective,
    link_strategy: objective === "conversion" || objective === "click" ? "reply_link" : "no_link",
    completed_body: quote.text_excerpt,
    source_excerpt: quote.text_excerpt,
    source_media: quote.media_permalink ?? null,
    guard_reasons: guard.reasons,
    score_reasons: scoreReasons(components, guard.penalty),
    prior_type: pattern.metadata?.prior ?? "hypothesis",
  };
}

function scoreOpportunity(
  quote: MyfansQuoteCandidate,
  product: MyfansProduct | null,
  pattern: MarketWinnerPatternRow,
  learningRows: MarketWinnerLearningRow[],
  guards: CrossAccountGuard[],
  creatorNameById: Map<number, string>,
): MarketWinnerCandidateRow {
  const candidate = createCandidate(quote, product, pattern, learningRows);
  const guard = evaluateCrossAccountGuard(candidate, guards);
  const score = calculateWinnerScore(candidate, guard);
  const components = winnerScoreComponents(candidate, guard);
  const explanation = createExplanation(quote, pattern, guard, components);
  const creatorId = candidate.creatorId ?? null;
  return {
    opportunity: {
      id: 0,
      patternKey: pattern.pattern_key,
      patternName: pattern.name,
      sourceXUrl: quote.x_post_url,
      sourceExcerpt: quote.text_excerpt,
      productTitle: product?.title ?? "供給プールの候補商品未紐付け",
      productId: product?.id ?? null,
      creatorName: creatorNameById.get(creatorId ?? 0) ?? quote.source_x_handle ?? "不明",
      creatorId,
      winnerScore: score,
      scoreComponents: components,
      guard,
      explanation,
    },
    payload: explanation,
  };
}

export function buildMarketWinnerCandidateRows(
  analytics: MyfansAnalytics,
  patterns: MarketWinnerPatternRow[],
  guards: CrossAccountGuard[],
  learningRows: MarketWinnerLearningRow[],
): MarketWinnerCandidateRow[] {
  const productById = new Map(analytics.products.map((product) => [product.id, product]));
  const creatorNameById = new Map(analytics.creators.map((creator) => [creator.id, creator.display_name]));
  return selectCandidateQuotes(analytics.quoteCandidates).flatMap((quote) => {
    const product = quote.product_id ? productById.get(quote.product_id) ?? null : null;
    return patterns.map((pattern) => scoreOpportunity(quote, product, pattern, learningRows, guards, creatorNameById));
  });
}

export function mapSavedMarketWinnerOpportunities(
  rows: SavedMarketWinnerRow[],
  patterns: MarketWinnerPatternLabel[],
  analytics: MyfansAnalytics,
): MarketWinnerOpportunity[] {
  const patternById = new Map(patterns.map((row) => [row.id, row]));
  const quoteById = new Map(analytics.quoteCandidates.map((quote) => [quote.id, quote]));
  const productById = new Map(analytics.products.map((product) => [product.id, product]));
  const creatorNameById = new Map(analytics.creators.map((creator) => [creator.id, creator.display_name]));
  const indexes = { patternById, quoteById, productById, creatorNameById };
  return rows.map((row) => mapSavedOpportunity(row, indexes));
}

function mapSavedOpportunity(
  row: SavedMarketWinnerRow,
  indexes: {
    patternById: Map<number, MarketWinnerPatternLabel>;
    quoteById: Map<number, MyfansQuoteCandidate>;
    productById: Map<number, MyfansProduct>;
    creatorNameById: Map<number, string>;
  },
): MarketWinnerOpportunity {
  const pattern = indexes.patternById.get(row.pattern_id);
  const quote = getRelatedRow(row.quote_candidate_id, indexes.quoteById);
  const product = getRelatedRow(row.product_id, indexes.productById);
  const explanation = row.explanation ?? {};
  return {
    id: row.id,
    patternKey: savedPatternKey(pattern),
    patternName: savedPatternName(pattern),
    sourceXUrl: row.source_x_url,
    sourceExcerpt: savedSourceExcerpt(explanation, quote),
    productTitle: savedProductTitle(product),
    productId: row.product_id,
    creatorName: savedCreatorName(row, quote, indexes.creatorNameById),
    creatorId: row.creator_id,
    winnerScore: Number(row.winner_score ?? 0),
    scoreComponents: row.score_components,
    guard: { blocked: false, penalty: 0, reasons: [] },
    explanation,
  };
}

function getRelatedRow<T>(id: number | null, rowsById: Map<number, T>) {
  return id ? rowsById.get(id) ?? null : null;
}

function savedPatternKey(pattern: MarketWinnerPatternLabel | undefined) {
  return (pattern?.pattern_key ?? "QUOTE_HOOK") as MarketPatternKey;
}

function savedPatternName(pattern: MarketWinnerPatternLabel | undefined) {
  return pattern?.name ?? "保存済みPattern";
}

function savedSourceExcerpt(explanation: Record<string, unknown>, quote: MyfansQuoteCandidate | null) {
  return String(explanation.source_excerpt ?? quote?.text_excerpt ?? "");
}

function savedProductTitle(product: MyfansProduct | null) {
  return product?.title ?? "供給プールの候補商品未紐付け";
}

function savedCreatorName(row: SavedMarketWinnerRow, quote: MyfansQuoteCandidate | null, namesById: Map<number, string>) {
  return namesById.get(row.creator_id ?? 0) ?? quote?.source_x_handle ?? "不明";
}
