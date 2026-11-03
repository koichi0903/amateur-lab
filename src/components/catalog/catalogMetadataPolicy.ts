type CatalogMetadataPageResult = {
  error: unknown | null;
  works: readonly unknown[];
};

export function shouldIndexCatalogMetadata({
  page,
  result,
  summaryIsIndexable,
}: {
  page: number;
  result: CatalogMetadataPageResult | null;
  summaryIsIndexable: boolean;
}) {
  return page === 1 && result !== null && !result.error && result.works.length > 0 && summaryIsIndexable;
}
