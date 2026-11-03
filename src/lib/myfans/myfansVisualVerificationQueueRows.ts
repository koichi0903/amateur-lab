type VisualVerificationSourceCandidate = {
  id: number;
  creator_id: number | null;
  media_permalink: string | null;
  x_post_url: string | null;
  media_type: string | null;
};

export function buildVisualVerificationQueueRows(
  candidates: readonly VisualVerificationSourceCandidate[],
  analyzerVersion: string,
) {
  const unique = new Map<string, VisualVerificationSourceCandidate & { source_url: string }>();
  for (const candidate of candidates) {
    const sourceUrl = String(candidate.media_permalink || candidate.x_post_url || "").trim();
    if (sourceUrl && !unique.has(sourceUrl)) unique.set(sourceUrl, { ...candidate, source_url: sourceUrl });
  }

  const sources = [...unique.values()].slice(0, 42);
  return {
    totalSources: Math.min(42, unique.size),
    rows: sources.map((candidate) => ({
      quote_candidate_id: candidate.id,
      source_url: candidate.source_url,
      creator_id: candidate.creator_id,
      media_type: candidate.media_type || "none",
      analyzer_version: analyzerVersion,
    })),
  };
}
