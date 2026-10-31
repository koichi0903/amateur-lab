export type XMediaAssetReviewInput = {
  id: number;
  status: "review" | "allowed" | "blocked";
  rightsBasisType?: string;
  rightsBasisUrl?: string;
  rightsBasisNote?: string;
  mediaQuality?: "unreviewed" | "strong" | "normal" | "weak";
  manualTags?: string[];
  reviewedBy?: string;
  reviewSource?: string;
};

export type XMediaAssetReviewUpdate = {
  rights_status: XMediaAssetReviewInput["status"];
  rights_basis_type: string | null;
  rights_basis_url: string | null;
  evidence_ref: string | null;
  rights_basis_note: string;
  reviewed_at: string;
  reviewed_by: string;
  review_source: string;
  x_usage_allowed: boolean;
  can_reupload: boolean;
  can_modify: boolean;
  quote_only: boolean;
  commercial_use_allowed: boolean;
  media_quality: NonNullable<XMediaAssetReviewInput["mediaQuality"]>;
  manual_tags: string[];
};

export type XMediaAssetReviewPlan =
  | { ok: false; error: string }
  | { ok: true; update: XMediaAssetReviewUpdate };

function buildRightsEvidenceFields(input: XMediaAssetReviewInput) {
  return {
    rights_basis_type: input.rightsBasisType ?? (input.status === "blocked" ? "insufficient_evidence" : null),
    rights_basis_url: input.rightsBasisUrl ?? null,
    evidence_ref: input.rightsBasisUrl ?? null,
    rights_basis_note: input.rightsBasisNote ?? "",
  };
}

function buildReviewMetadataFields(input: XMediaAssetReviewInput) {
  return {
    reviewed_by: input.reviewedBy ?? "admin_x_growth",
    review_source: input.reviewSource ?? "admin",
    media_quality: input.mediaQuality ?? "unreviewed",
    manual_tags: input.manualTags ?? [],
  };
}

export function buildXMediaAssetReviewPlan(
  input: XMediaAssetReviewInput,
  reviewedAt: string,
): XMediaAssetReviewPlan {
  if (input.status === "allowed" && (!input.rightsBasisType || (!input.rightsBasisUrl && !input.rightsBasisNote))) {
    return { ok: false, error: "allowedには権利根拠の種類とURLまたはメモが必要です。" };
  }

  const allowed = input.status === "allowed";
  return {
    ok: true,
    update: {
      rights_status: input.status,
      ...buildRightsEvidenceFields(input),
      reviewed_at: reviewedAt,
      ...buildReviewMetadataFields(input),
      x_usage_allowed: allowed,
      can_reupload: allowed,
      can_modify: false,
      quote_only: !allowed,
      commercial_use_allowed: allowed,
    },
  };
}
