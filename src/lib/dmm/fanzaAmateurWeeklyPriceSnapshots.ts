type SnapshotSourceItem = {
  content_id?: unknown;
  prices?: unknown;
};

export function buildFanzaAmateurWeeklyPriceSnapshotRows(
  items: SnapshotSourceItem[],
  recentlyObservedContentIds: ReadonlySet<string>,
  runId: string,
  observedAt: string,
) {
  const rows = new Map<string, { source_run_id: string; content_id: string; observed_at: string; prices: Record<string, unknown> }>();
  for (const item of items) {
    if (typeof item.content_id !== "string" || !item.content_id.trim()) continue;
    const contentId = item.content_id.trim();
    if (recentlyObservedContentIds.has(contentId)) continue;
    const prices = item.prices && typeof item.prices === "object" && !Array.isArray(item.prices)
      ? item.prices as Record<string, unknown>
      : {};
    rows.set(contentId, { source_run_id: runId, content_id: contentId, observed_at: observedAt, prices });
  }
  return [...rows.values()];
}
