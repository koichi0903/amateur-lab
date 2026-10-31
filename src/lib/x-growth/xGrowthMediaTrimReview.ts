import {
  sourceKindFor,
  validateTrimStartSeconds,
  type XMediaAsset,
} from "@/lib/xMediaAssets";

export type XMediaAssetTrimReviewInput = {
  trimStartSeconds: number;
  trimNote?: string;
  trimModifyConfirmed?: boolean;
  reviewedBy?: string;
  reviewSource?: string;
};

export type XMediaAssetTrimReviewUpdate = {
  trim_start_seconds: number;
  trim_reviewed_at: string;
  trim_reviewed_by: string;
  trim_review_source: string;
  trim_modify_confirmed: boolean;
  trim_note: string;
};

export type XMediaAssetTrimReviewPlan =
  | { ok: false; error: string }
  | { ok: true; update: XMediaAssetTrimReviewUpdate; trimStartSeconds: number };

export function buildXMediaAssetTrimReviewPlan(
  existing: Pick<Partial<XMediaAsset>, "source_url" | "can_modify" | "trim_modify_confirmed">,
  input: XMediaAssetTrimReviewInput,
  reviewedAt: string,
): XMediaAssetTrimReviewPlan {
  const official = sourceKindFor(String(existing.source_url ?? "")) === "official_sample";
  if (!official && existing.can_modify !== true && existing.trim_modify_confirmed !== true) {
    return { ok: false, error: "外部動画のトリムには編集許可の確認が必要です。" };
  }

  const validation = validateTrimStartSeconds(input.trimStartSeconds);
  if (!validation.ok) return { ok: false, error: validation.error };

  return {
    ok: true,
    trimStartSeconds: validation.value,
    update: {
      trim_start_seconds: validation.value,
      trim_reviewed_at: reviewedAt,
      trim_reviewed_by: input.reviewedBy ?? "admin_x_growth",
      trim_review_source: input.reviewSource ?? "user_confirmed",
      trim_modify_confirmed: official ? true : input.trimModifyConfirmed === true,
      trim_note: input.trimNote ?? "",
    },
  };
}
