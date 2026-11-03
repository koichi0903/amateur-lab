export type ExistingEntityRankingRow = { id: number | string; name: string };

export function buildEntityRankingSyncPlan<T extends { name: string }>(
  rows: T[],
  existingRows: ExistingEntityRankingRow[],
) {
  const idsByName = new Map<string, Array<number | string>>();
  for (const existingRow of existingRows) {
    const ids = idsByName.get(existingRow.name) ?? [];
    ids.push(existingRow.id);
    idsByName.set(existingRow.name, ids);
  }

  const rowsToUpdate = rows.flatMap((row) =>
    (idsByName.get(row.name) ?? []).map((id) => ({ id, ...row })),
  );
  const rowsToInsert = rows.filter((row) => !idsByName.has(row.name));
  const currentNames = new Set(rows.map((row) => row.name));
  const staleIds = existingRows.filter((row) => !currentNames.has(row.name)).map((row) => row.id);

  return { rowsToUpdate, rowsToInsert, staleIds };
}
