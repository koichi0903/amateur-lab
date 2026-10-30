const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);
const HOUR_MS = 60 * 60 * 1000;

export type ManualImpressionPayload = {
  postKey: string;
  account: string;
  impressions: number;
};

export type ManualImpressionPayloadValidation =
  | { error: string }
  | ManualImpressionPayload;

export function validateManualImpressionPayload(value: unknown): ManualImpressionPayloadValidation {
  const payload = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const postKey = typeof payload?.postKey === "string" ? payload.postKey.trim() : "";
  const account = typeof payload?.account === "string" ? payload.account : "";
  const impressions = payload?.impressions;

  if (!postKey || postKey.length > 180 || !ACCOUNTS.has(account)) {
    return { error: "投稿情報が正しくありません。画面を再読み込みしてください。" };
  }
  if (typeof impressions !== "number" || !Number.isSafeInteger(impressions) || impressions < 0 || impressions > 1_000_000_000) {
    return { error: "Xに表示された閲覧数を0以上の整数で入力してください。" };
  }

  return { postKey, account, impressions };
}

export type ManualPostAgeValidation = { ageHours: number } | { error: string };

export function validateManualPostAge(postedAt: string, capturedAt: Date): ManualPostAgeValidation {
  const ageHours = (capturedAt.getTime() - Date.parse(postedAt)) / HOUR_MS;
  if (ageHours < 24) {
    return { error: `投稿からまだ${ageHours.toFixed(1)}時間です。24時間後に記録してください。` };
  }
  if (ageHours >= 30 * 24) {
    return { error: `投稿から${ageHours.toFixed(1)}時間経過しています。手入力は投稿後30日以内に行ってください。` };
  }
  return { ageHours };
}

export function existingManualSnapshotConflict(
  existing: { account_handle: string; source: string } | null,
  account: string,
): string | null {
  if (existing && existing.account_handle !== account) {
    return "この投稿キーは別のアカウントの表示数に使われています。";
  }
  if (existing && existing.source !== "manual") {
    return "すでに別の方法で記録されています。上書きしませんでした。";
  }
  return null;
}
