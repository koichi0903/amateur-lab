type CandidateRow = {
  product: {
    id: number;
    quote_candidate_x_url?: string | null;
  };
};

type CandidateSelectionInput<T extends CandidateRow> = {
  pool: T[];
  products: T[];
  index: number;
  postType: string;
  exclude: Set<number>;
  topicPassProductIds: number[];
  topicReady: (row: T) => boolean;
};

function pickPostTypePreferredProduct<T extends CandidateRow>(input: CandidateSelectionInput<T>): T | null {
  const { pool, postType, exclude, topicPassProductIds, topicReady } = input;
  const isAvailable = (row: T) => !exclude.has(row.product.id);

  if (postType === "ranking_note") {
    const discoveryReady = pool.find((row) =>
      topicPassProductIds.includes(row.product.id) && isAvailable(row) && topicReady(row),
    ) ?? pool.find((row) => isAvailable(row) && topicReady(row));
    if (discoveryReady) return discoveryReady;
  }

  if (postType === "profile_cta" || postType === "comparison_review") {
    const authorityReady = pool.find((row) => isAvailable(row) && topicReady(row));
    if (authorityReady) return authorityReady;
  }

  return null;
}

function pickFallbackProduct<T extends CandidateRow>(input: CandidateSelectionInput<T>): T | null {
  const { pool, products, index, postType, exclude, topicPassProductIds } = input;
  const isAvailable = (row: T) => !exclude.has(row.product.id);
  const shouldUseQuoteCandidate = postType === "discovery_interest" || postType === "profile_cta";
  const unusedQuote = shouldUseQuoteCandidate
    ? pool.find((row) => row.product.quote_candidate_x_url && isAvailable(row))
    : null;
  const unusedTopicProduct = pool.find((row) => topicPassProductIds.includes(row.product.id) && isAvailable(row));
  const unused = unusedQuote ?? unusedTopicProduct ?? pool.find(isAvailable);
  return unused ?? pool[index] ?? pool[0] ?? products.find(isAvailable) ?? products[index] ?? products[0] ?? null;
}

export function pickMyfansCandidateProduct<T extends CandidateRow>(input: CandidateSelectionInput<T>): T | null {
  return pickPostTypePreferredProduct(input) ?? pickFallbackProduct(input);
}
