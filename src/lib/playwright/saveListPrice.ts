export function resolveListPriceToSave(
  listPrice: number | null | undefined,
  currentListPrice: number | null | undefined,
  mainNormalPrice: number | null | undefined,
): number | null | undefined {
  if (listPrice !== undefined) return listPrice;
  if (currentListPrice == null && mainNormalPrice != null) {
    return mainNormalPrice;
  }
  return undefined;
}
