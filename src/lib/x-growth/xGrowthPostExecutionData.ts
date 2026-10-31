import type { XPostLogInput } from "@/lib/xPostLogs";
import { xPostKeyFromText } from "@/lib/xPostTracking";
import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";

type XGrowthCreativeLogFields = Pick<
  XPostLogInput,
  "creativeVariantId" | "hookType" | "linkStrategy" | "ctaStrategy" | "creativeGenome"
>;
type XGrowthSelectedVariantLogFields = Pick<XPostLogInput, "hookType" | "linkStrategy" | "ctaStrategy">;

function selectedVariantLogFields(persistedPick: SerializedTopPick | null): XGrowthSelectedVariantLogFields {
  const selectedVariant = persistedPick?.selectedVariant;
  return {
    hookType: selectedVariant?.hookType ?? null,
    linkStrategy: selectedVariant?.linkStrategy ?? null,
    ctaStrategy: selectedVariant?.ctaStrategy ?? null,
  };
}

function persistedPickCreativeGenome(persistedPick: SerializedTopPick | null): XGrowthCreativeLogFields["creativeGenome"] {
  if (!persistedPick) return null;
  return {
    persisted_top_pick: persistedPick,
    candidate_id: persistedPick.candidateId ?? null,
    slot_role: persistedPick.slotRole ?? null,
    candidate_rank: persistedPick.candidateRank ?? null,
  };
}

function xGrowthCreativeLogFields(
  persistedPick: SerializedTopPick | null,
  opportunityKey: string,
): XGrowthCreativeLogFields {
  return {
    creativeVariantId: persistedPick?.candidateId ?? opportunityKey,
    ...selectedVariantLogFields(persistedPick),
    creativeGenome: persistedPickCreativeGenome(persistedPick),
  };
}

type ManualXGrowthPostLogData = {
  accountHandle: string;
  candidateId: string;
  candidateRank?: string | null;
  intent?: string | null;
  linkStrategy: "reply_link" | "body_link" | null;
  mediaAssetId?: number | null;
  postDate: string;
  postKey: string;
  postText: string;
  slotId?: string | null;
  slotRole?: string | null;
  title: string;
  workId: number;
  xPostId: string;
};

function manualPostCreativeGenome(input: ManualXGrowthPostLogData): Record<string, unknown> {
  return {
    candidate_id: input.candidateId,
    slot_id: input.slotId ?? null,
    slot_role: input.slotRole ?? null,
    candidate_rank: input.candidateRank ?? null,
    intent: input.intent ?? null,
    completion_source: "admin_manual_posted_button",
  };
}

export function buildManualXGrowthPostLogInput(input: ManualXGrowthPostLogData): XPostLogInput {
  return {
    postKey: input.postKey,
    workId: input.workId,
    category: "score",
    title: input.title.slice(0, 300),
    postText: input.postText,
    postDate: input.postDate,
    accountHandle: input.accountHandle,
    creativeVariantId: input.candidateId,
    xPostId: input.xPostId,
    postIntent: "work_link",
    scheduledSlot: input.slotId ?? null,
    mediaAssetId: input.mediaAssetId ?? null,
    linkStrategy: input.linkStrategy,
    creativeGenome: manualPostCreativeGenome(input),
  };
}

export function buildXGrowthPostLogInput(input: {
  opportunity: Record<string, unknown>;
  persistedPick: SerializedTopPick | null;
  accountHandle: string;
  postDate: string;
}): XPostLogInput {
  const { opportunity, persistedPick, accountHandle, postDate } = input;
  const postText = String(opportunity.post_text);
  const opportunityKey = String(opportunity.opportunity_key);
  return {
    postKey: xPostKeyFromText(postText) ?? opportunityKey,
    workId: Number(opportunity.work_id),
    category: "score",
    title: String(opportunity.topic).slice(0, 300),
    postText,
    postDate,
    accountHandle,
    postIntent: "work_link",
    scheduledSlot: persistedPick?.slotId ?? null,
    plannedAt: null,
    ...xGrowthCreativeLogFields(persistedPick, opportunityKey),
  };
}
