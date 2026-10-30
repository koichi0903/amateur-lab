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

type WorkMediaStageCounts = Pick<
  MediaSupplyStageDiagnostics,
  | "usableFetchableWorks"
  | "generatedVariants"
  | "generatedVariantWorks"
  | "creativeQualityVariants"
  | "creativeQualityWorks"
  | "nativeXVoiceVariants"
  | "nativeXVoiceWorks"
  | "videoHookFactWorks"
  | "technicalGateRejectedWorks"
  | "finalEligibleWorks"
> & { firstDropReason: string | null };

function groupOpportunitiesByWork(opportunities: XGrowthOpportunity[]) {
  const grouped = new Map<number, XGrowthOpportunity[]>();
  for (const item of opportunities) {
    const items = grouped.get(item.workId) ?? [];
    items.push(item);
    grouped.set(item.workId, items);
  }
  return grouped;
}

function hasUsableMedia(items: XGrowthOpportunity[], mediaType: "sample_movie" | "existing_link_image") {
  return items.some((item) => mediaType === "sample_movie"
    ? officialSampleVideoAllowed(item)
    : Boolean(item.imageUrl));
}

function mediaTypeVariants(items: XGrowthOpportunity[], mediaType: "sample_movie" | "existing_link_image") {
  return items.flatMap((item) => item.creativeVariants.filter((variant) =>
    variant.intent !== "CONVERSATION" && variant.mediaType === mediaType,
  ));
}

function hasVideoHookFact(items: XGrowthOpportunity[], variants: ReturnType<typeof mediaTypeVariants>, mediaType: "sample_movie" | "existing_link_image") {
  return items.some((item) => videoEligibilityReasons({ ...item, mediaType }, variants[0])
    .every((reason) => !reason.includes("video hook / fact strength")));
}

function emptyWorkMediaStageCounts(): WorkMediaStageCounts {
  return {
    usableFetchableWorks: 0,
    generatedVariants: 0,
    generatedVariantWorks: 0,
    creativeQualityVariants: 0,
    creativeQualityWorks: 0,
    nativeXVoiceVariants: 0,
    nativeXVoiceWorks: 0,
    videoHookFactWorks: 0,
    technicalGateRejectedWorks: 0,
    finalEligibleWorks: 0,
    firstDropReason: null,
  };
}

function assessWorkMediaStages(
  items: XGrowthOpportunity[],
  mediaType: "sample_movie" | "existing_link_image",
): WorkMediaStageCounts {
  const counts = emptyWorkMediaStageCounts();
  if (!hasUsableMedia(items, mediaType)) {
    counts.technicalGateRejectedWorks = 1;
    counts.firstDropReason = "official_sample_fetchability_or_media_unusable";
    return counts;
  }
  counts.usableFetchableWorks = 1;

  const variants = mediaTypeVariants(items, mediaType);
  counts.generatedVariants = variants.length;
  if (!variants.length) {
    counts.firstDropReason = "generated_variants";
    return counts;
  }
  counts.generatedVariantWorks = 1;

  const qualityVariants = variants.filter((variant) => variant.quality.passed);
  counts.creativeQualityVariants = qualityVariants.length;
  if (!qualityVariants.length) {
    counts.firstDropReason = "creative_quality_gate";
    return counts;
  }
  counts.creativeQualityWorks = 1;

  const nativeVariants = variants.filter((variant) => variant.quality.lastMile.nativeXVoice.passed);
  counts.nativeXVoiceVariants = nativeVariants.length;
  if (!nativeVariants.length) {
    counts.firstDropReason = "native_x_voice_gate";
    return counts;
  }
  counts.nativeXVoiceWorks = 1;

  if (mediaType === "sample_movie") {
    if (!hasVideoHookFact(items, variants, mediaType)) {
      counts.firstDropReason = "video_hook_fact_gate";
      return counts;
    }
    counts.videoHookFactWorks = 1;
  }

  const finalVariants = variants.filter((variant) => isSoftQualityEligible(variant)
    && (mediaType !== "sample_movie" || (variant.quality.passed && variant.quality.dimensions.adSmell <= 30)));
  if (!finalVariants.length) {
    counts.firstDropReason = "soft_quality_or_ad_smell_gate";
    return counts;
  }
  counts.finalEligibleWorks = 1;
  return counts;
}

function countFirstDropReason(counts: Record<string, number>, reason: string) {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

export function buildMediaSupplyStageDiagnostics(
  opportunities: XGrowthOpportunity[],
  mediaType: "sample_movie" | "existing_link_image",
  postedWorkIds: ReadonlySet<number>,
  recentDailyPickWorkIds: ReadonlySet<number>,
) : MediaSupplyStageDiagnostics {
  const raw = opportunities.filter((item) => isVideoCandidate({ ...item, mediaType }) || (mediaType === "existing_link_image" && Boolean(item.imageUrl)));
  const byWork = groupOpportunitiesByWork(raw);
  const activeByWork = new Map([...byWork].filter(([workId]) => !postedWorkIds.has(workId) && !recentDailyPickWorkIds.has(workId)));
  const firstDropReasonCounts: Record<string, number> = {};
  const stageCounts = emptyWorkMediaStageCounts();
  for (const items of activeByWork.values()) {
    const workCounts = assessWorkMediaStages(items, mediaType);
    stageCounts.usableFetchableWorks += workCounts.usableFetchableWorks;
    stageCounts.generatedVariants += workCounts.generatedVariants;
    stageCounts.generatedVariantWorks += workCounts.generatedVariantWorks;
    stageCounts.creativeQualityVariants += workCounts.creativeQualityVariants;
    stageCounts.creativeQualityWorks += workCounts.creativeQualityWorks;
    stageCounts.nativeXVoiceVariants += workCounts.nativeXVoiceVariants;
    stageCounts.nativeXVoiceWorks += workCounts.nativeXVoiceWorks;
    stageCounts.videoHookFactWorks += workCounts.videoHookFactWorks;
    stageCounts.technicalGateRejectedWorks += workCounts.technicalGateRejectedWorks;
    stageCounts.finalEligibleWorks += workCounts.finalEligibleWorks;
    if (workCounts.firstDropReason) countFirstDropReason(firstDropReasonCounts, workCounts.firstDropReason);
  }
  for (const workId of byWork.keys()) {
    if (postedWorkIds.has(workId) || recentDailyPickWorkIds.has(workId)) countFirstDropReason(firstDropReasonCounts, "posted_or_recently_selected");
  }
  return {
    rawWorks: byWork.size,
    postedExcludedWorks: byWork.size - activeByWork.size,
    afterPostedWorks: activeByWork.size,
    usableFetchableWorks: stageCounts.usableFetchableWorks,
    generatedVariants: stageCounts.generatedVariants,
    generatedVariantWorks: stageCounts.generatedVariantWorks,
    creativeQualityVariants: stageCounts.creativeQualityVariants,
    creativeQualityWorks: stageCounts.creativeQualityWorks,
    nativeXVoiceVariants: stageCounts.nativeXVoiceVariants,
    nativeXVoiceWorks: stageCounts.nativeXVoiceWorks,
    videoHookFactWorks: stageCounts.videoHookFactWorks,
    technicalGateRejectedWorks: stageCounts.technicalGateRejectedWorks,
    finalEligibleWorks: stageCounts.finalEligibleWorks,
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

