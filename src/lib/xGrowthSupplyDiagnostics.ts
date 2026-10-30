import type { XDailyTopPick, XGrowthOpportunity, XSemanticHookCategory } from "@/lib/xGrowthOS";
import { isVideoCandidate } from "@/lib/xVideoCandidate";
import { isSoftQualityEligible, officialSampleVideoAllowed, videoEligibilityReasons } from "./xGrowthEligibility";
import { assignSemanticHook, SEMANTIC_CATEGORY_QUOTA } from "./xGrowthSemantic";
import { endingPhrase, firstLine, sentenceStructure } from "./xGrowthCopyShape";

export type MediaSupplyStageDiagnostics = {
  rawWorks: number;
  postedExcludedWorks: number;
  afterPostedWorks: number;
  usableFetchableWorks: number;
  generatedVariants: number;
  generatedVariantWorks: number;
  creativeQualityVariants: number;
  creativeQualityWorks: number;
  nativeXVoiceVariants: number;
  nativeXVoiceWorks: number;
  videoHookFactWorks: number;
  technicalGateRejectedWorks: number;
  finalEligibleWorks: number;
  firstDropReasonCounts: Record<string, number>;
};

export function buildMediaSupplyStageDiagnostics(
  opportunities: XGrowthOpportunity[],
  mediaType: "sample_movie" | "existing_link_image",
  postedWorkIds: ReadonlySet<number>,
  recentDailyPickWorkIds: ReadonlySet<number>,
) : MediaSupplyStageDiagnostics {
  const raw = opportunities.filter((item) => isVideoCandidate({ ...item, mediaType }) || (mediaType === "existing_link_image" && Boolean(item.imageUrl)));
  const byWork = new Map<number, XGrowthOpportunity[]>();
  for (const item of raw) byWork.set(item.workId, [...(byWork.get(item.workId) ?? []), item]);
  const active = raw.filter((item) => !postedWorkIds.has(item.workId) && !recentDailyPickWorkIds.has(item.workId));
  const activeByWork = new Map<number, XGrowthOpportunity[]>();
  for (const item of active) activeByWork.set(item.workId, [...(activeByWork.get(item.workId) ?? []), item]);
  const variantsFor = (items: XGrowthOpportunity[]) => items.flatMap((item) => item.creativeVariants.filter((variant) => variant.intent !== "CONVERSATION" && variant.mediaType === mediaType));
  const usable = (items: XGrowthOpportunity[]) => items.some((item) => mediaType === "sample_movie" ? officialSampleVideoAllowed(item) : Boolean(item.imageUrl));
  const firstDropReasonCounts: Record<string, number> = {};
  const addDrop = (reason: string) => { firstDropReasonCounts[reason] = (firstDropReasonCounts[reason] ?? 0) + 1; };
  let usableFetchableWorks = 0;
  let generatedVariantWorks = 0;
  let creativeQualityWorks = 0;
  let nativeXVoiceWorks = 0;
  let videoHookFactWorks = 0;
  let technicalGateRejectedWorks = 0;
  let finalEligibleWorks = 0;
  let generatedVariants = 0;
  let creativeQualityVariants = 0;
  let nativeXVoiceVariants = 0;
  for (const [workId, items] of activeByWork) {
    if (!usable(items)) { technicalGateRejectedWorks += 1; addDrop("official_sample_fetchability_or_media_unusable"); continue; }
    usableFetchableWorks += 1;
    const variants = variantsFor(items);
    generatedVariants += variants.length;
    if (!variants.length) { addDrop("generated_variants"); continue; }
    generatedVariantWorks += 1;
    const qualityVariants = variants.filter((variant) => variant.quality.passed);
    creativeQualityVariants += qualityVariants.length;
    if (!qualityVariants.length) { addDrop("creative_quality_gate"); continue; }
    creativeQualityWorks += 1;
    const nativeVariants = variants.filter((variant) => variant.quality.lastMile.nativeXVoice.passed);
    nativeXVoiceVariants += nativeVariants.length;
    if (!nativeVariants.length) { addDrop("native_x_voice_gate"); continue; }
    nativeXVoiceWorks += 1;
    if (mediaType === "sample_movie") {
      const hookWorks = items.some((item) => videoEligibilityReasons({ ...item, mediaType }, variants[0]).every((reason) => !reason.includes("video hook / fact strength")));
      if (!hookWorks) { addDrop("video_hook_fact_gate"); continue; }
      videoHookFactWorks += 1;
    }
    const finalVariants = variants.filter((variant) => isSoftQualityEligible(variant)
      && (mediaType !== "sample_movie" || (variant.quality.passed && variant.quality.dimensions.adSmell <= 30)));
    if (!finalVariants.length) { addDrop("soft_quality_or_ad_smell_gate"); continue; }
    finalEligibleWorks += 1;
    void workId;
  }
  for (const workId of byWork.keys()) {
    if (postedWorkIds.has(workId) || recentDailyPickWorkIds.has(workId)) addDrop("posted_or_recently_selected");
  }
  return {
    rawWorks: byWork.size,
    postedExcludedWorks: byWork.size - activeByWork.size,
    afterPostedWorks: activeByWork.size,
    usableFetchableWorks,
    generatedVariants,
    generatedVariantWorks,
    creativeQualityVariants,
    creativeQualityWorks,
    nativeXVoiceVariants,
    nativeXVoiceWorks,
    videoHookFactWorks,
    technicalGateRejectedWorks,
    finalEligibleWorks,
    firstDropReasonCounts,
  };
}


type DiversityAudit = {
  exactText: number;
  opening: number;
  sentencePattern: number;
  ending: number;
};

function dailyDiversityKey(text: string) {
  return {
    exactText: text.trim(),
    opening: normalizedOpening(text),
    sentencePattern: sentenceStructure(text),
    ending: endingPhrase(text),
  };
}

export function auditDailyDiversity(picks: XDailyTopPick[]): DiversityAudit {
  const counts = {
    exactText: new Map<string, number>(),
    opening: new Map<string, number>(),
    sentencePattern: new Map<string, number>(),
    ending: new Map<string, number>(),
  };
  for (const pick of picks) {
    const key = dailyDiversityKey(pick.postText);
    for (const field of Object.keys(counts) as Array<keyof typeof counts>) {
      const value = key[field];
      counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
    }
  }
  return {
    exactText: Math.max(0, ...counts.exactText.values()),
    opening: Math.max(0, ...counts.opening.values()),
    sentencePattern: Math.max(0, ...counts.sentencePattern.values()),
    ending: Math.max(0, ...counts.ending.values()),
  };
}


function emptySemanticCounts() {
  return Object.keys(SEMANTIC_CATEGORY_QUOTA).reduce((counts, category) => {
    counts[category as XSemanticHookCategory] = 0;
    return counts;
  }, {} as Record<XSemanticHookCategory, number>);
}

export function semanticSupplyDiagnostics(opportunities: XGrowthOpportunity[], picks: XDailyTopPick[]) {
  const supply = emptySemanticCounts();
  const mappingReasons: Record<string, number> = {};
  for (const item of opportunities) {
    const categories = new Set(item.creativeVariants
      .filter((variant) => variant.quality.passed)
      .map((variant) => {
        const assignment = assignSemanticHook(item, variant);
        const key = `${assignment.category}: ${assignment.reason}`;
        mappingReasons[key] = (mappingReasons[key] ?? 0) + 1;
        return assignment.category;
      }));
    for (const category of categories) supply[category] += 1;
  }
  const selected = emptySemanticCounts();
  for (const pick of picks) selected[pick.setDiversity.signature.semanticHookCategory] += 1;
  const selectedTotal = Object.values(selected).reduce((sum, count) => sum + count, 0);
  const quotaCapacity = Object.entries(supply).reduce((sum, [category, count]) => {
    const typedCategory = category as XSemanticHookCategory;
    return sum + Math.min(count, SEMANTIC_CATEGORY_QUOTA[typedCategory]);
  }, 0);
  const overflowReasons = Object.entries(selected)
    .filter(([category, count]) => count > SEMANTIC_CATEGORY_QUOTA[category as XSemanticHookCategory])
    .map(([category, count]) => {
      const typedCategory = category as XSemanticHookCategory;
      return supply[typedCategory] < count
        ? `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / supply不足でoverflow`
        : selectedTotal > quotaCapacity
          ? `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / 利用可能categoryのquota容量${quotaCapacity}件/${selectedTotal}件でoverflow（供給不足）`
          : `${typedCategory}: supply ${supply[typedCategory]}件 / required slots ${count}件 / quota ${SEMANTIC_CATEGORY_QUOTA[typedCategory]}件 / quota超過`;
    });
  return { supply, selected, overflowReasons, mappingReasons };
}


export function normalizedOpening(text: string) {
  return firstLine(text).replace(/[0-9０-９]+/g, "#").replace(/\s+/g, "").slice(0, 20);
}

