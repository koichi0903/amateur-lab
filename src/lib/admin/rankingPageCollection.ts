export type RankingPageProgress = (processedCount: number, current: number, total: number) => Promise<void>;

export async function collectUniqueRankingTargets<T extends { content_id?: string }>({
  limit,
  pageSize,
  maxPageCount,
  fetchPage,
  onProgress,
}: {
  limit: number;
  pageSize: number;
  maxPageCount: number;
  fetchPage: (offset: number) => Promise<T[]>;
  onProgress: RankingPageProgress;
}): Promise<{ targets: Array<T & { rank: number }>; pages: number }> {
  const uniqueItemsById = new Map<string, T>();
  let pages = 0;

  for (
    let offset = 1;
    pages < maxPageCount && uniqueItemsById.size < limit;
    offset += pageSize
  ) {
    const items = await fetchPage(offset);
    if (items.length === 0) break;

    for (const item of items) {
      if (item.content_id && !uniqueItemsById.has(item.content_id)) {
        uniqueItemsById.set(item.content_id, item);
      }
    }

    pages += 1;
    const processedCount = Math.min(uniqueItemsById.size, limit);
    await onProgress(
      Math.min(10, Math.round((uniqueItemsById.size / limit) * 10)),
      processedCount,
      limit,
    );

    if (items.length < pageSize) break;
  }

  const targets = Array.from(uniqueItemsById.values())
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  return { targets, pages };
}
