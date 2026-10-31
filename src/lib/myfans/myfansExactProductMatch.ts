export type ExactProductMatchDecision =
  | { kind: "not_found" }
  | {
      kind: "ambiguous";
      method: "exact_canonical_url_duplicate" | "exact_url_creator_conflict";
    }
  | { kind: "match"; product: Record<string, unknown> };

export function decideExactProductMatch(
  matches: Record<string, unknown>[] | null | undefined,
  creatorId: number,
): ExactProductMatchDecision {
  if (!matches?.length) return { kind: "not_found" };
  if (matches.length > 1) {
    return { kind: "ambiguous", method: "exact_canonical_url_duplicate" };
  }

  const product = matches[0];
  if (product.creator_id != null && Number(product.creator_id) !== creatorId) {
    return { kind: "ambiguous", method: "exact_url_creator_conflict" };
  }

  return { kind: "match", product };
}
