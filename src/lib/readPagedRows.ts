export type PagedRowsResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export async function readPagedRows<T>(
  readPage: (from: number, to: number) => PromiseLike<PagedRowsResult>,
  pageSize: number,
  maxRows: number,
  rowLimitError: string,
) {
  const rows: T[] = [];

  for (let from = 0; from <= maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows);
    const expectedPageSize = to - from + 1;
    const result = await readPage(from, to);
    if (result.error) return { rows: [] as T[], error: result.error.message };

    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (rows.length > maxRows) return { rows: [] as T[], error: rowLimitError };
    if (page.length < expectedPageSize) return { rows, error: null as string | null };
  }

  return { rows, error: null as string | null };
}
