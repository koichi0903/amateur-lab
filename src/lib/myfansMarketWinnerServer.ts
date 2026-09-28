import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansAnalytics, MyfansQuoteCandidate, MyfansProduct } from "@/lib/myfansAnalytics";
import {
  calculateWinnerScore,
  evaluateCrossAccountGuard,
  type CrossAccountGuard,
  type MarketPatternKey,
  type WinnerScoreComponents,
  winnerScoreComponents,
} from "@/lib/myfansMarketWinner";

type PatternRow = { id: number; pattern_key: MarketPatternKey; name: string; objective_compatibility: string[]; initial_weight: number; metadata: Record<string, unknown> };
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

const PATTERN_KEYS: MarketPatternKey[] = ["QUOTE_HOOK", "PRICE_DROP", "LIMITED_WINDOW", "CREATOR_DISCOVERY", "COMPARISON", "NEW_RELEASE", "SOCIAL_PROOF", "CURIOSITY_GAP", "FOLLOW_SERIES"];

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value * 100) / 100)); }
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
function patternFit(key: MarketPatternKey, quote: MyfansQuoteCandidate, product: MyfansProduct | null) {
  const text = `${quote.text_excerpt} ${product?.title ?? ""}`;
  const scores: Record<MarketPatternKey, number> = {
    QUOTE_HOOK: quote.text_excerpt.length >= 12 ? 92 : 55,
    PRICE_DROP: product && (product.price > 0 || /値下げ|セール|割引|価格/.test(text)) ? 85 : 20,
    LIMITED_WINDOW: /期間|限定|残り|終了|今日|まで/.test(text) ? 88 : 18,
    CREATOR_DISCOVERY: quote.creator_id ? 82 : 35,
    COMPARISON: /比較|より|どっち|違い|選ぶ/.test(text) ? 86 : product ? 58 : 22,
    NEW_RELEASE: product?.is_new ? 90 : 26,
    SOCIAL_PROOF: Math.min(95, 35 + (quote.likes ?? 0) / 20 + (quote.reposts ?? 0) / 5),
    CURIOSITY_GAP: /[？?]|なぜ|どうして|気になる|知らない/.test(text) ? 88 : quote.text_excerpt.length > 20 ? 62 : 30,
    FOLLOW_SERIES: /続き|次回|シリーズ|第[一二三四五六七八九十0-9]+/.test(text) ? 90 : 24,
  };
  return clamp(scores[key]);
}
function objectiveFor(key: MarketPatternKey, pattern: PatternRow) { return pattern.objective_compatibility?.[0] ?? (key.includes("PRICE") || key === "COMPARISON" ? "click" : "impression"); }

export async function buildMarketWinnerOpportunities(analytics: MyfansAnalytics, approvedMediaId: number) {
  const [patternsResult, guardsResult, learningResult] = await Promise.all([
    supabaseAdmin.from("myfans_market_patterns").select("id,pattern_key,name,objective_compatibility,initial_weight,metadata").in("pattern_key", PATTERN_KEYS),
    supabaseAdmin.from("myfans_cross_account_content_guards").select("source_x_url,product_id,creator_id,global_content_fingerprint,last_seen_at,cooldown_until").order("last_seen_at", { ascending: false }).limit(2000),
    supabaseAdmin.from("myfans_pattern_learning").select("pattern_id,creator_id,product_id,quote_candidate_id,posterior_weight").eq("approved_media_id", approvedMediaId),
  ]);
  if (patternsResult.error) throw patternsResult.error;
  if (guardsResult.error) throw guardsResult.error;
  if (learningResult.error) throw learningResult.error;
  const patterns = (patternsResult.data ?? []) as PatternRow[];
  const guards = (guardsResult.data ?? []) as CrossAccountGuard[];
  const learningRows = learningResult.data ?? [];
  const products = analytics.products;
  const productById = new Map(products.map((product) => [product.id, product]));
  const creatorNameById = new Map(analytics.creators.map((creator) => [creator.id, creator.display_name]));
  const candidates = analytics.quoteCandidates
    .filter((quote) => Boolean(quote.x_post_url))
    .sort((a, b) => (b.global_score ?? b.score) - (a.global_score ?? a.score) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 40);
  const rows: Array<{ opportunity: MarketWinnerOpportunity; payload: Record<string, unknown> }> = [];
  for (const quote of candidates) {
    const product = quote.product_id ? productById.get(quote.product_id) ?? null : null;
    for (const pattern of patterns) {
      const learning = learningRows.find((row) => row.pattern_id === pattern.id && (!row.quote_candidate_id || row.quote_candidate_id === quote.id) && (!row.product_id || row.product_id === product?.id));
      const candidate = {
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
      const guard = evaluateCrossAccountGuard(candidate, guards);
      const score = calculateWinnerScore(candidate, guard);
      const components = winnerScoreComponents(candidate, guard);
      const objective = objectiveFor(pattern.pattern_key, pattern);
      const explanation = {
        objective,
        link_strategy: objective === "conversion" || objective === "click" ? "reply_link" : "no_link",
        completed_body: quote.text_excerpt,
        source_excerpt: quote.text_excerpt,
        source_media: quote.media_permalink ?? null,
        guard_reasons: guard.reasons,
        score_reasons: [
          `pattern ${components.patternFit}/100`,
          `source ${components.sourceStrength}/100`,
          `product ${components.productOpportunity}/100`,
          `creator ${components.creatorStrength}/100`,
          `learning ${components.learningWeight}`,
          guard.penalty ? `guard penalty -${guard.penalty}` : "guard penalty 0",
        ],
        prior_type: pattern.metadata?.prior ?? "hypothesis",
      };
      rows.push({
        opportunity: {
          id: 0,
          patternKey: pattern.pattern_key,
          patternName: pattern.name,
          sourceXUrl: quote.x_post_url,
          sourceExcerpt: quote.text_excerpt,
          productTitle: product?.title ?? "供給プールの候補商品未紐付け",
          productId: product?.id ?? null,
          creatorName: creatorNameById.get(candidate.creatorId ?? 0) ?? quote.source_x_handle ?? "不明",
          creatorId: candidate.creatorId ?? null,
          winnerScore: score,
          scoreComponents: components,
          guard,
          explanation,
        },
        payload: explanation,
      });
    }
  }
  const writeRows = rows.filter((row) => !row.opportunity.guard.blocked).sort((a, b) => b.opportunity.winnerScore - a.opportunity.winnerScore).slice(0, 100);
  if (writeRows.length) {
    const patternIds = patterns.map((pattern) => pattern.id);
    const { data: existingRows, error: existingError } = await supabaseAdmin.from("myfans_market_opportunities").select("id,pattern_id,quote_candidate_id,product_id").eq("approved_media_id", approvedMediaId).in("pattern_id", patternIds).limit(1000);
    if (existingError) throw existingError;
    const byKey = new Map((existingRows ?? []).map((row) => [`${row.pattern_id}:${row.quote_candidate_id ?? 0}:${row.product_id ?? 0}`, row]));
    for (const row of writeRows) {
      const patternId = patterns.find((pattern) => pattern.pattern_key === row.opportunity.patternKey)?.id;
      const quoteId = analytics.quoteCandidates.find((quote) => quote.x_post_url === row.opportunity.sourceXUrl)?.id ?? null;
      const payload = {
        approved_media_id: approvedMediaId,
        pattern_id: patternId,
        quote_candidate_id: quoteId,
        product_id: row.opportunity.productId,
        creator_id: row.opportunity.creatorId,
        source_x_url: row.opportunity.sourceXUrl,
        status: "candidate",
        winner_score: row.opportunity.winnerScore,
        score_components: row.opportunity.scoreComponents,
        explanation: row.payload,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = byKey.get(`${patternId}:${quoteId ?? 0}:${row.opportunity.productId ?? 0}`);
      let savedId = saved?.id ?? 0;
      if (saved?.id) {
        const { error } = await supabaseAdmin.from("myfans_market_opportunities").update(payload).eq("id", saved.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabaseAdmin.from("myfans_market_opportunities").insert(payload).select("id").single();
        if (error) throw error;
        savedId = inserted?.id ?? 0;
      }
      row.opportunity.id = savedId;
    }
  }
  return { opportunities: writeRows.map((row) => row.opportunity).sort((a, b) => b.winnerScore - a.winnerScore), patternCount: patterns.length, sharedSupplyCount: candidates.length };
}
