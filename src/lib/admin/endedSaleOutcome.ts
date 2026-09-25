export type EndedSaleRemainingTarget = {
  product_id: string;
  playwright_status: string | null;
};

export type EndedSaleRemainingClassification = {
  deferred: EndedSaleRemainingTarget[];
  fatal: EndedSaleRemainingTarget[];
};

export type EndedSaleItemOutcome =
  | "updated"
  | "unavailable_deferred"
  | "unchanged";

export function summarizeEndedSaleOutcomes(
  outcomes: readonly EndedSaleItemOutcome[],
): { updated: number; deferred: number; unchanged: number } {
  return outcomes.reduce(
    (summary, outcome) => {
      if (outcome === "updated") summary.updated += 1;
      else if (outcome === "unavailable_deferred") summary.deferred += 1;
      else summary.unchanged += 1;
      return summary;
    },
    { updated: 0, deferred: 0, unchanged: 0 },
  );
}

const DEFERRED_UNAVAILABLE_STATUS = /^UNAVAILABLE_[12]_[0-9]{8}_(RESERVED|NEW|SEMI_NEW|OLD)$/;

export function isDeferredUnavailableStatus(status: string | null): boolean {
  return status ? DEFERRED_UNAVAILABLE_STATUS.test(status) : false;
}

export function classifyEndedSaleRemaining(
  remaining: EndedSaleRemainingTarget[],
  processedProductIds: ReadonlySet<string>,
): EndedSaleRemainingClassification {
  const deferred: EndedSaleRemainingTarget[] = [];
  const fatal: EndedSaleRemainingTarget[] = [];

  for (const target of remaining) {
    if (
      processedProductIds.has(target.product_id) &&
      isDeferredUnavailableStatus(target.playwright_status)
    ) {
      deferred.push(target);
    } else {
      fatal.push(target);
    }
  }

  return { deferred, fatal };
}
