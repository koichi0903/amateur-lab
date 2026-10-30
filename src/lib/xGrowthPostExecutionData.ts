import type { XPostLogInput } from "@/lib/xPostLogs";
import { xPostKeyFromText } from "@/lib/xPostTracking";
import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";

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
    creativeVariantId: persistedPick?.candidateId ?? opportunityKey,
    hookType: persistedPick?.selectedVariant?.hookType ?? null,
    linkStrategy: persistedPick?.selectedVariant?.linkStrategy ?? null,
    ctaStrategy: persistedPick?.selectedVariant?.ctaStrategy ?? null,
    creativeGenome: persistedPick ? {
      persisted_top_pick: persistedPick,
      candidate_id: persistedPick.candidateId ?? null,
      slot_role: persistedPick.slotRole ?? null,
      candidate_rank: persistedPick.candidateRank ?? null,
    } : null,
  };
}
