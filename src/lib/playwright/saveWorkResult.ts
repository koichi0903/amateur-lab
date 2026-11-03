type UpdatedRows = { length?: number } | null | undefined;

export function didSaveWorkChange(
  updated: UpdatedRows,
  priceDataChanged: boolean,
  legacyHistoryChanged: boolean,
): boolean {
  return Boolean(updated?.length) || priceDataChanged || legacyHistoryChanged;
}
