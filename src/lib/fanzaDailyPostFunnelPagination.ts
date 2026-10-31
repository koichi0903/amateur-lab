export const FANZA_DAILY_POST_FUNNEL_PAGE_SIZE = 1_000;
export const FANZA_DAILY_POST_FUNNEL_MAX_ROWS = 50_000;
export const FANZA_DAILY_POST_FUNNEL_KEY_BATCH_SIZE = 250;
const rowLimitErrorFor = (maxRows: number) =>
  `投稿別イベントが${maxRows.toLocaleString("ja-JP")}件を超えたため、完全な集計を出せません。`;

type PageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export async function readFanzaDailyPostFunnelRows<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize = FANZA_DAILY_POST_FUNNEL_PAGE_SIZE,
  maxRows = FANZA_DAILY_POST_FUNNEL_MAX_ROWS,
  rowLimitError = rowLimitErrorFor(maxRows),
) {
  const rows: T[] = [];

  for (let from = 0; from <= maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows);
    const expectedPageSize = to - from + 1;
    const result = await readPage(from, to);
    if (result.error) return { rows: [] as T[], error: result.error.message };

    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (rows.length > maxRows) {
      return { rows: [] as T[], error: rowLimitError };
    }
    if (page.length < expectedPageSize) return { rows, error: null as string | null };
  }

  return { rows, error: null as string | null };
}

export async function readFanzaDailyPostFunnelRowsForKeys<T>(
  keys: readonly string[],
  readPage: (keys: readonly string[], from: number, to: number) => PromiseLike<PageResult>,
  pageSize = FANZA_DAILY_POST_FUNNEL_PAGE_SIZE,
  maxRows = FANZA_DAILY_POST_FUNNEL_MAX_ROWS,
  keyBatchSize = FANZA_DAILY_POST_FUNNEL_KEY_BATCH_SIZE,
) {
  const rows: T[] = [];
  for (let index = 0; index < keys.length; index += keyBatchSize) {
    const batch = keys.slice(index, index + keyBatchSize);
    const remainingRows = maxRows - rows.length;
    const result = await readFanzaDailyPostFunnelRows<T>(
      (from, to) => readPage(batch, from, to),
      pageSize,
      remainingRows,
      rowLimitErrorFor(maxRows),
    );
    if (result.error) return { rows: [] as T[], error: result.error };
    rows.push(...result.rows);
  }

  return { rows, error: null as string | null };
}
