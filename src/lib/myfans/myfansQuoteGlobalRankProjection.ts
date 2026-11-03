export type GlobalQuoteRankCandidate = {
  id: number;
  creator_id: number | null;
  creator_x_url: string | null;
  score: number;
  creator_rank: number | null;
  collected_at: string | null;
  cooldown_until: string | null;
  last_used_at: string | null;
  use_count: number | null;
  is_repost: boolean;
  media_type: string | null;
  media_permalink: string | null;
  quote_visual_ready: boolean | null;
  media_permalink_validation_status: string | null;
  visual_score: number | null;
};

export type ScoredGlobalQuoteRankCandidate = GlobalQuoteRankCandidate & { globalScore: number };

function isAvailableGlobalQuoteCandidate(candidate: GlobalQuoteRankCandidate, nowIso: string) {
  return !candidate.is_repost
    && !candidate.last_used_at
    && (!candidate.cooldown_until || candidate.cooldown_until <= nowIso);
}

function candidateAgeDays(collectedAt: string | null, nowMs = Date.now()) {
  return collectedAt ? Math.max(0, (nowMs - new Date(collectedAt).getTime()) / 86_400_000) : 7;
}

function candidateVisualBoost(candidate: GlobalQuoteRankCandidate) {
  if (candidate.quote_visual_ready && candidate.media_permalink) {
    if (candidate.media_type === "video") return 18;
    if (candidate.media_type === "image") return 12;
    return 0;
  }
  return candidate.visual_score ? -12 : 0;
}

type RenderStatus = "browser_visible" | "app_only" | "blocked";

function candidateRenderStatus(candidate: GlobalQuoteRankCandidate): RenderStatus {
  if (
    candidate.quote_visual_ready
    && candidate.media_permalink
    && (candidate.media_type === "image" || candidate.media_permalink_validation_status === "verified_video_permalink")
  ) return "browser_visible";
  if (/not_rendered/i.test(candidate.media_permalink_validation_status ?? "")) return "app_only";
  return "blocked";
}

function candidateRenderPenalty(status: RenderStatus) {
  return { browser_visible: 0, app_only: 30, blocked: 45 }[status];
}

function scoreGlobalQuoteCandidate(candidate: GlobalQuoteRankCandidate, nowMs?: number) {
  const baseScore = Math.round(Math.max(
    0,
    Math.min(
      120,
      candidate.score
        + candidateVisualBoost(candidate)
        + Math.max(0, 10 - candidateAgeDays(candidate.collected_at, nowMs))
        - ((candidate.creator_rank ?? 3) - 1) * 4
        - (candidate.use_count ?? 0) * 12,
    ),
  ));
  return Math.max(0, baseScore - candidateRenderPenalty(candidateRenderStatus(candidate)));
}

export function projectGlobalQuoteCandidates(
  candidates: GlobalQuoteRankCandidate[],
  nowIso: string,
  nowMs?: number,
): ScoredGlobalQuoteRankCandidate[] {
  return candidates
    .filter((candidate) => isAvailableGlobalQuoteCandidate(candidate, nowIso))
    .map((candidate) => ({ ...candidate, globalScore: scoreGlobalQuoteCandidate(candidate, nowMs) }))
    .sort((a, b) => b.globalScore - a.globalScore || b.score - a.score);
}

function quoteCandidateCreatorKey(candidate: ScoredGlobalQuoteRankCandidate) {
  return candidate.creator_id
    ? `creator:${candidate.creator_id}`
    : `x:${String(candidate.creator_x_url).toLowerCase()}`;
}

function isQuoteCandidateReadyForToday(candidate: ScoredGlobalQuoteRankCandidate) {
  return Boolean(
    candidate.quote_visual_ready
    && candidate.media_permalink
    && (candidate.media_type === "image" || candidate.media_permalink_validation_status === "verified_video_permalink"),
  );
}

export type GlobalQuoteRankUpdate = {
  id: number;
  global_score: number;
  global_rank: number;
  selected_for_today: boolean;
};

export function projectGlobalQuoteRankUpdates(rows: ScoredGlobalQuoteRankCandidate[]): GlobalQuoteRankUpdate[] {
  const selectedCreators = new Set<string>();
  let selectedCount = 0;
  return rows.map((row, index) => {
    const key = quoteCandidateCreatorKey(row);
    const selectedForToday = isQuoteCandidateReadyForToday(row)
      && !selectedCreators.has(key)
      && (selectedCount === 0 || row.globalScore >= 78)
      && selectedCount < 2;
    if (selectedForToday) {
      selectedCreators.add(key);
      selectedCount += 1;
    }
    return {
      id: row.id,
      global_score: row.globalScore,
      global_rank: index + 1,
      selected_for_today: selectedForToday,
    };
  });
}
