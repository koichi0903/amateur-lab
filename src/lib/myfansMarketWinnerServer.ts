import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansAnalytics } from "@/lib/myfansAnalytics";
import {
  buildMarketWinnerCandidateRows,
  mapSavedMarketWinnerOpportunities,
  type MarketWinnerCandidateRow,
  type MarketWinnerLearningRow,
  type MarketWinnerOpportunity,
  type MarketWinnerPatternLabel,
  type MarketWinnerPatternRow,
  type SavedMarketWinnerRow,
} from "./myfansMarketWinnerCandidates";
import type { CrossAccountGuard, MarketPatternKey } from "./myfansMarketWinner";

type ExistingOpportunityRow = {
  id: number;
  pattern_id: number;
  quote_candidate_id: number | null;
  product_id: number | null;
};

const PATTERN_KEYS: MarketPatternKey[] = ["QUOTE_HOOK", "PRICE_DROP", "LIMITED_WINDOW", "CREATOR_DISCOVERY", "COMPARISON", "NEW_RELEASE", "SOCIAL_PROOF", "CURIOSITY_GAP", "FOLLOW_SERIES"];

function opportunityKey(row: Pick<ExistingOpportunityRow, "pattern_id" | "quote_candidate_id" | "product_id">) {
  return `${row.pattern_id}:${row.quote_candidate_id ?? 0}:${row.product_id ?? 0}`;
}

async function loadExistingOpportunities(approvedMediaId: number, patternIds: number[]) {
  const { data, error } = await supabaseAdmin
    .from("myfans_market_opportunities")
    .select("id,pattern_id,quote_candidate_id,product_id")
    .eq("approved_media_id", approvedMediaId)
    .in("pattern_id", patternIds)
    .limit(1000);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [opportunityKey(row), row as ExistingOpportunityRow]));
}

async function saveMarketWinnerRow(
  row: MarketWinnerCandidateRow,
  approvedMediaId: number,
  patterns: MarketWinnerPatternRow[],
  analytics: MyfansAnalytics,
  existingByKey: Map<string, ExistingOpportunityRow>,
) {
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
  const saved = existingByKey.get(`${patternId}:${quoteId ?? 0}:${row.opportunity.productId ?? 0}`);
  if (saved?.id) {
    const { error } = await supabaseAdmin.from("myfans_market_opportunities").update(payload).eq("id", saved.id);
    if (error) throw error;
    row.opportunity.id = saved.id;
    return "updated" as const;
  }

  const { data: inserted, error } = await supabaseAdmin.from("myfans_market_opportunities").insert(payload).select("id").single();
  if (error) throw error;
  row.opportunity.id = inserted?.id ?? 0;
  return "created" as const;
}

async function persistMarketWinnerRows(
  rows: MarketWinnerCandidateRow[],
  approvedMediaId: number,
  patterns: MarketWinnerPatternRow[],
  analytics: MyfansAnalytics,
) {
  const writeRows = rows
    .filter((row) => !row.opportunity.guard.blocked)
    .sort((a, b) => b.opportunity.winnerScore - a.opportunity.winnerScore)
    .slice(0, 100);
  if (!writeRows.length) return { opportunities: [] as MarketWinnerOpportunity[], createdCount: 0, updatedCount: 0 };

  const existingByKey = await loadExistingOpportunities(approvedMediaId, patterns.map((pattern) => pattern.id));
  let createdCount = 0;
  let updatedCount = 0;
  for (const row of writeRows) {
    const outcome = await saveMarketWinnerRow(row, approvedMediaId, patterns, analytics, existingByKey);
    if (outcome === "created") createdCount += 1;
    else updatedCount += 1;
  }
  return {
    opportunities: writeRows.map((row) => row.opportunity).sort((a, b) => b.winnerScore - a.winnerScore),
    createdCount,
    updatedCount,
  };
}

export async function buildMarketWinnerOpportunities(analytics: MyfansAnalytics, approvedMediaId: number) {
  const [patternsResult, guardsResult, learningResult] = await Promise.all([
    supabaseAdmin.from("myfans_market_patterns").select("id,pattern_key,name,objective_compatibility,initial_weight,metadata").in("pattern_key", PATTERN_KEYS),
    supabaseAdmin.from("myfans_cross_account_content_guards").select("source_x_url,product_id,creator_id,global_content_fingerprint,last_seen_at,cooldown_until").order("last_seen_at", { ascending: false }).limit(2000),
    supabaseAdmin.from("myfans_pattern_learning").select("pattern_id,creator_id,product_id,quote_candidate_id,posterior_weight").eq("approved_media_id", approvedMediaId),
  ]);
  if (patternsResult.error) throw patternsResult.error;
  if (guardsResult.error) throw guardsResult.error;
  if (learningResult.error) throw learningResult.error;

  const patterns = (patternsResult.data ?? []) as MarketWinnerPatternRow[];
  const guards = (guardsResult.data ?? []) as CrossAccountGuard[];
  const learningRows = (learningResult.data ?? []) as MarketWinnerLearningRow[];
  const candidates = analytics.quoteCandidates.filter((quote) => Boolean(quote.x_post_url)).sort((a, b) => (b.global_score ?? b.score) - (a.global_score ?? a.score) || (b.views ?? 0) - (a.views ?? 0)).slice(0, 40);
  const rows = buildMarketWinnerCandidateRows(analytics, patterns, guards, learningRows);
  const persisted = await persistMarketWinnerRows(rows, approvedMediaId, patterns, analytics);
  const scores = persisted.opportunities.map((item) => item.winnerScore);
  return {
    opportunities: persisted.opportunities,
    patternCount: patterns.length,
    sharedSupplyCount: candidates.length,
    createdCount: persisted.createdCount,
    updatedCount: persisted.updatedCount,
    generatedAt: new Date().toISOString(),
    scoreRange: scores.length ? { min: Math.min(...scores), max: Math.max(...scores) } : null,
  };
}

/** Read the persisted winner set without evaluating or writing any opportunities. */
export async function readMarketWinnerOpportunities(analytics: MyfansAnalytics, approvedMediaId: number) {
  const [patternsResult, opportunitiesResult] = await Promise.all([
    supabaseAdmin.from("myfans_market_patterns").select("id,pattern_key,name").in("pattern_key", PATTERN_KEYS),
    supabaseAdmin
      .from("myfans_market_opportunities")
      .select("id,pattern_id,quote_candidate_id,product_id,creator_id,source_x_url,winner_score,score_components,explanation,status")
      .eq("approved_media_id", approvedMediaId)
      .in("status", ["candidate", "selected", "held"])
      .order("winner_score", { ascending: false })
      .limit(100),
  ]);
  if (patternsResult.error) throw patternsResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;

  const patterns = (patternsResult.data ?? []) as MarketWinnerPatternLabel[];
  const rows = (opportunitiesResult.data ?? []) as SavedMarketWinnerRow[];
  return {
    opportunities: mapSavedMarketWinnerOpportunities(rows, patterns, analytics),
    patternCount: patterns.length,
    sharedSupplyCount: analytics.quoteCandidates.filter((quote) => Boolean(quote.x_post_url)).slice(0, 40).length,
  };
}
