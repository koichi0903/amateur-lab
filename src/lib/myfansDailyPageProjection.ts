export type MyfansDailyPlanProjectionInput = {
  id: number;
  plan_date: string;
  approved_media_id: number | null;
  revision?: number | null;
  evaluated_at?: string | null;
  updated_at?: string | null;
};

export function parseMyfansDailyPageParams(params: { media?: string; date?: string } | undefined) {
  const selectedMediaId = params?.media ? Number(params.media) : null;
  const planDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
  return { selectedMediaId, planDate };
}

export function selectCurrentMyfansDailyPlan<T extends MyfansDailyPlanProjectionInput>(
  plans: readonly T[],
  planDate: string,
  approvedMediaId: number | null,
) {
  return plans
    .filter((plan) => plan.plan_date === planDate && plan.approved_media_id === approvedMediaId)
    .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0)
      || String(b.evaluated_at ?? b.updated_at ?? "").localeCompare(String(a.evaluated_at ?? a.updated_at ?? ""))
      || b.id - a.id)[0]
    ?? null;
}

export function buildMyfansSupplyEvidenceStatus(
  products: readonly { id: number }[],
  evidenceRows: readonly { product_id?: number | null; confidence: string }[],
) {
  const productIds = new Set(products.map(({ id }) => id));
  return evidenceRows.reduce<Record<string, number>>((counts, evidence) => {
    const productLinked = Boolean(evidence.product_id) && productIds.has(evidence.product_id as number);
    const key = evidence.confidence === "exact" && productLinked
      ? "exact_ready"
      : productLinked
        ? "registered_no_exact"
        : evidence.confidence === "strong"
          ? "resolved_unregistered"
          : "unresolved";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildMyfansDailyBoardSummary({
  persistedSelectedCount,
  candidateOptions,
  recovery,
  candidates,
}: {
  persistedSelectedCount: number | null;
  candidateOptions: readonly { candidates: readonly unknown[] }[];
  recovery: { passCount: number; selectedMinimum: number };
  candidates: readonly unknown[];
}) {
  const selectedCount = persistedSelectedCount ?? recovery.passCount;
  return {
    optionCount: candidateOptions.reduce((count, slot) => count + slot.candidates.length, 0),
    selectedCount,
    selectedStatus: selectedCount >= recovery.selectedMinimum ? "READY" as const : "SUPPLY_INSUFFICIENT" as const,
    postCount: persistedSelectedCount ?? candidates.length,
  };
}
