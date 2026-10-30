import { auditCandidateUniqueness } from "@/lib/xGrowthCandidateIdentity";
import { isVideoCandidate } from "@/lib/xVideoCandidate";
import type { XDailyTopPick } from "@/lib/xGrowthTypes";

type FinalMediaMixInput = {
  targetVideos: number;
  selectedVideos: number;
  unmetReason: string | null;
};

export function finalizeXGrowthMediaMix<T extends FinalMediaMixInput>(
  mediaMix: T,
  picks: XDailyTopPick[],
  postedWorkIds: Set<number>,
) {
  const selectedVideos = picks.filter(isVideoCandidate);
  const selectedVideosBySlot = selectedVideos.reduce((counts, pick) => {
    const slot = pick.slotId ?? "unassigned";
    counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  return {
    ...mediaMix,
    uniqueAudit: auditCandidateUniqueness(picks, postedWorkIds),
    selectedVideos: selectedVideos.length,
    selectedVideosBySlot,
    selectedVideosAfterReplenishment: selectedVideos.length,
    unmetReason: mediaMix.targetVideos > selectedVideos.length
      ? mediaMix.unmetReason ?? "最終Diversity Gate後に目標未達。安全性・semantic・重複制約を優先"
      : mediaMix.unmetReason,
  };
}
