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
