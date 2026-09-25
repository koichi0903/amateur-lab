export type UnavailableStatusTransition = {
  nextStatus: string;
  nextCount: number;
  discontinued: boolean;
};

const UNAVAILABLE_STATUS_PATTERN =
  /^UNAVAILABLE_(\d+)_([0-9]{8})_(RESERVED|NEW|SEMI_NEW|OLD)$/;

export function advanceUnavailableStatus(
  currentStatus: string | null | undefined,
  stage: string | null | undefined,
  today: string,
): UnavailableStatusTransition {
  const match = (currentStatus ?? "").match(UNAVAILABLE_STATUS_PATTERN);
  const originalStage =
    match?.[3] ?? (stage === "DISCONTINUED" ? "OLD" : stage ?? "OLD");
  const previousCount = Number(match?.[1] ?? 0);
  const previousDate = match?.[2] ?? "";
  const nextCount = previousDate === today ? previousCount : previousCount + 1;
  const discontinued = nextCount >= 3;

  return {
    nextCount,
    discontinued,
    nextStatus: discontinued
      ? `DISCONTINUED_${today}_${originalStage}`
      : `UNAVAILABLE_${nextCount}_${today}_${originalStage}`,
  };
}
