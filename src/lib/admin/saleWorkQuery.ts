export type SaleWorkQueryRow = { product_id: string };

export async function collectSaleWorks<T extends SaleWorkQueryRow>(
  saleIds: ReadonlySet<string>,
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<{ allWorks: T[]; works: T[] }> {
  const allWorks: T[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allWorks.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { allWorks, works: allWorks.filter((work) => saleIds.has(work.product_id)) };
}
