type ApiItem = Record<string, unknown> & { content_id?: unknown };

export type FanzaAmateurApiPopularityRankRun = {
  rank_next_offset: number;
  rank_fetched_item_count: number;
  rank_total_count: number | null;
  rank_snapshot_at: string | null;
};

export type FanzaAmateurApiPopularityRankRow = { rank: number; content_id: string };

export function buildFanzaAmateurApiPopularityPagePlan(input: {
  run: FanzaAmateurApiPopularityRankRun;
  items: ApiItem[];
  totalCount: number | null;
  rankLimit: number;
  capturedAtFallback: string;
}) {
  const { run, items, totalCount, rankLimit, capturedAtFallback } = input;
  if (totalCount === null) throw new Error("人気順APIのtotal_countを読み取れませんでした。");
  if (run.rank_total_count !== null && run.rank_total_count !== totalCount) {
    throw new Error(`人気順APIの総件数が取得中に変わりました（${run.rank_total_count}件 → ${totalCount}件）。整合性確認のため取得を停止しました。`);
  }

  const expectedTotalCount = run.rank_total_count ?? totalCount;
  const targetCount = Math.min(rankLimit, expectedTotalCount);
  if (items.some((item) => typeof item?.content_id !== "string" || !item.content_id.trim())) {
    throw new Error("人気順APIの返却作品にcontent_idがなく、順位の欠落を避けるため保存を停止しました。");
  }
  if (items.length === 0 && run.rank_next_offset <= targetCount) {
    throw new Error(`人気順APIが${run.rank_next_offset}位以降を返さず、順位取得を完了できませんでした。`);
  }

  const rankRows = items
    .slice(0, Math.max(0, targetCount - run.rank_next_offset + 1))
    .map((item, index) => ({ rank: run.rank_next_offset + index, content_id: String(item.content_id).trim() }));
  const nextOffset = run.rank_next_offset + rankRows.length;

  return {
    expectedTotalCount,
    targetCount,
    capturedAt: run.rank_snapshot_at ?? capturedAtFallback,
    rankRows,
    nextOffset,
    fetchedCount: run.rank_fetched_item_count + rankRows.length,
    complete: nextOffset > targetCount,
  };
}
