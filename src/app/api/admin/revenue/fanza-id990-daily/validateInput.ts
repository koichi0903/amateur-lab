export type DailyMetricInput = {
  reportDate: string;
  reportStatus: "provisional" | "confirmed";
  clickCount: number;
  directRewardCount: number;
  directRewardYen: number;
  categoryRewardCount: number;
  categoryRewardYen: number;
  serviceRewardCount: number;
  serviceRewardYen: number;
  notes: string;
};

type ValidationResult =
  | { ok: true; value: DailyMetricInput }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
}

function validateReportDate(reportDate: unknown, latestAllowedDate: string): string | null {
  if (typeof reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return "対象日を正しく選択してください。";
  }

  // Validate in UTC so JST midnight does not roll back to the prior UTC day.
  const parsedDate = new Date(`${reportDate}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== reportDate) {
    return "実在する日付を選択してください。";
  }
  if (reportDate > latestAllowedDate) {
    return "当日分は翌日反映のため、昨日以前の日付を選択してください。";
  }

  return null;
}

function validateCounts(input: Record<string, unknown>): string | null {
  const numbers = [
    input.clickCount,
    input.directRewardCount,
    input.directRewardYen,
    input.categoryRewardCount,
    input.categoryRewardYen,
    input.serviceRewardCount,
    input.serviceRewardYen,
  ];
  return numbers.every(isCount)
    ? null
    : "クリック数・成果件数・報酬額は0以上の整数で入力してください。";
}

export function validateDailyMetricInput(
  value: unknown,
  latestAllowedDate: string,
): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "対象日を正しく選択してください。" };
  }

  const dateError = validateReportDate(value.reportDate, latestAllowedDate);
  if (dateError) return { ok: false, error: dateError };
  if (value.reportStatus !== "confirmed" && value.reportStatus !== "provisional") {
    return { ok: false, error: "確定状態を選択してください。" };
  }

  const countError = validateCounts(value);
  if (countError) return { ok: false, error: countError };
  if (typeof value.notes !== "string" || value.notes.length > 500) {
    return { ok: false, error: "メモは500文字以内で入力してください。" };
  }

  return { ok: true, value: value as unknown as DailyMetricInput };
}
