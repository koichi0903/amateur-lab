export type FanzaAmateurApiDateRange = { fromDate: string; toDate: string };

export type FanzaAmateurApiActiveDateRange = FanzaAmateurApiDateRange & {
  offset: number;
  expectedCount: number | null;
};

export function splitFanzaAmateurApiDateRange(range: FanzaAmateurApiDateRange): [FanzaAmateurApiDateRange, FanzaAmateurApiDateRange] | null {
  const start = Date.parse(`${range.fromDate}T00:00:00Z`);
  const end = Date.parse(`${range.toDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 2) return null;
  const leftDays = Math.floor(days / 2);
  const middle = new Date(start + (leftDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const rightStart = new Date(start + leftDays * 86_400_000).toISOString().slice(0, 10);
  return [
    { fromDate: range.fromDate, toDate: middle },
    { fromDate: rightStart, toDate: range.toDate },
  ];
}

type EmptyRangeRecoveryRun = {
  expected_item_count: number;
  range_count: number;
};

export function recoverFanzaAmateurApiEmptyRange(
  run: EmptyRangeRecoveryRun,
  range: FanzaAmateurApiActiveDateRange & { expectedCount: number },
  pendingRanges: FanzaAmateurApiDateRange[],
  apiTotalCount: number,
) {
  const split = splitFanzaAmateurApiDateRange(range);
  if (split) {
    return {
      kind: "split" as const,
      updates: {
        total_count: apiTotalCount,
        next_offset: 1,
        current_range: null,
        pending_ranges: [...split, ...pendingRanges],
        expected_item_count: Math.max(0, run.expected_item_count - range.expectedCount),
        range_count: Math.max(0, run.range_count - 1),
        last_error: `日付範囲${range.fromDate}〜${range.toDate}でAPI件数と実取得数が一致しなかったため、範囲を分割して再確認しています。`,
      },
    };
  }
  return {
    kind: "needs_attention" as const,
    updates: {
      status: "needs_attention" as const,
      last_error: `1日分の範囲${range.fromDate}でAPI件数${range.expectedCount}件に対し取得位置${range.offset}までしか返されませんでした。欠落の可能性があるため、全作品補完を完了扱いにしていません。`,
      completed_at: new Date().toISOString(),
    },
  };
}

type CatalogPageProgressRun = EmptyRangeRecoveryRun & {
  fetched_item_count: number;
  completed_range_count: number;
};

export function buildFanzaAmateurApiCatalogPageProgress(input: {
  run: CatalogPageProgressRun;
  activeRange: FanzaAmateurApiActiveDateRange;
  pendingRanges: FanzaAmateurApiDateRange[];
  rawItemCount: number;
  observedItemKeyPaths: string[];
  totalCount: number;
}) {
  const { run, activeRange, pendingRanges, rawItemCount, observedItemKeyPaths, totalCount } = input;
  const expectedCount = activeRange.expectedCount ?? totalCount;
  const nextOffset = activeRange.offset + rawItemCount;
  const rangeComplete = rawItemCount === 0 || nextOffset > expectedCount;

  if (rawItemCount === 0 && activeRange.expectedCount !== null && activeRange.offset <= expectedCount) {
    const recovery = recoverFanzaAmateurApiEmptyRange(
      run,
      { ...activeRange, expectedCount },
      pendingRanges,
      totalCount,
    );
    return { kind: "recovery" as const, updates: recovery.updates };
  }

  return {
    kind: "advance" as const,
    rangeComplete,
    updates: {
      total_count: totalCount,
      next_offset: nextOffset,
      fetched_item_count: run.fetched_item_count + rawItemCount,
      observed_item_key_paths: observedItemKeyPaths,
      current_range: rangeComplete ? null : { ...activeRange, expectedCount, offset: nextOffset },
      pending_ranges: pendingRanges,
      expected_item_count: run.expected_item_count + (activeRange.expectedCount === null ? expectedCount : 0),
      range_count: run.range_count + (activeRange.expectedCount === null ? 1 : 0),
      completed_range_count: run.completed_range_count + (rangeComplete ? 1 : 0),
      last_error: null,
    },
  };
}
