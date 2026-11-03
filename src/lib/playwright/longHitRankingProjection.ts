export type LongHitRankingValueRow = {
  product_id: string;
  long_hit_rank: number | null;
};

export function changedLongHitRankingProductIds(
  rows: LongHitRankingValueRow[],
  expectedRankByProduct: ReadonlyMap<string, number>,
) {
  const changed: string[] = [];
  for (const row of rows) {
    if (row.long_hit_rank !== (expectedRankByProduct.get(row.product_id) ?? null)) {
      changed.push(row.product_id);
    }
  }
  return changed;
}

export function shouldReportLongHitRankingProgress(processed: number, total: number) {
  return processed > 0 && (processed % 10 === 0 || processed === total);
}
