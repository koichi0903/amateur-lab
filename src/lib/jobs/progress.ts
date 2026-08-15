const PROGRESS_PREFIX = "@progress";

export type JobProgressDetail = {
  phase: string;
  current?: number;
  total?: number;
  productId?: string;
};

export function encodeJobProgress({
  phase,
  current,
  total,
  productId,
}: JobProgressDetail): string {
  return [
    PROGRESS_PREFIX,
    phase,
    current ?? "",
    total ?? "",
    productId ?? "",
  ].join("|");
}

export function decodeJobProgress(
  value: string | null | undefined,
): JobProgressDetail | null {
  if (!value?.startsWith(`${PROGRESS_PREFIX}|`)) return null;

  const [, phase, currentValue, totalValue, productId] = value.split("|");
  const current = Number(currentValue);
  const total = Number(totalValue);

  return {
    phase,
    current: Number.isFinite(current) && currentValue !== "" ? current : undefined,
    total: Number.isFinite(total) && totalValue !== "" ? total : undefined,
    productId: productId || undefined,
  };
}
