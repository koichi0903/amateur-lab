import type { MyfansDailyOptionCandidate, MyfansDailyOptionGenerationInput, MyfansDailyOptionSlot, RotationItem } from "./myfansXExecution";
import { myfansOptionMetadata } from "@/lib/myfansOptionMetadata";

type EvaluatedDailyOption = ReturnType<MyfansDailyOptionGenerationInput["evaluateDiversity"]>;

function eligibleDailyOption(
  input: MyfansDailyOptionGenerationInput,
  candidate: EvaluatedDailyOption,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
) {
  const leak = input.detectPublicCopyLeak(candidate.body);
  const novelty = input.noveltyFor(candidate);
  const source = input.normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
  if (!source || usedSources.has(source) || leak.hasLeak || novelty.verdict === "blocked") return null;
  if (candidate.quality.verdict !== "PASS" || candidate.quality.total < 80) return null;
  if (!input.optionDiverseEnough(candidate, options)) return null;
  return { candidate, novelty, source };
}

function appendDailyOption(
  options: MyfansDailyOptionCandidate[],
  candidate: EvaluatedDailyOption,
  slot: string,
  novelty: ReturnType<MyfansDailyOptionGenerationInput["noveltyFor"]>,
) {
  const optionIndex = options.length;
  options.push({
    ...candidate,
    plannedSlot: slot,
    novelty,
    ...myfansOptionMetadata(optionIndex),
  });
}

function fillDailyOptionsFrom(
  input: MyfansDailyOptionGenerationInput,
  sourceItem: RotationItem,
  index: number,
  attemptOffset: number,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
  excludedProducts: Set<number>,
) {
  for (let attempt = 0; attempt < input.slotRecoveryMaxAttempts * 2 && options.length < 3; attempt += 1) {
    const generated = input.buildCandidate(sourceItem, index, attemptOffset + attempt + options.length * input.multiAngleAttemptsPerTopic, excludedProducts);
    const candidate = input.evaluateDiversity(generated);
    const eligible = eligibleDailyOption(input, candidate, options, usedSources);
    if (!eligible) continue;
    usedSources.add(eligible.source);
    appendDailyOption(options, candidate, sourceItem.slot, eligible.novelty);
    if (candidate.product?.id && (attempt + 1) % input.multiAngleAttemptsPerTopic === 0) excludedProducts.add(candidate.product.id);
  }
}

function preserveExistingDailyOption(
  input: MyfansDailyOptionGenerationInput,
  index: number,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
) {
  const existing = input.slotOptions.find((slot) => slot.postOrder === index + 1);
  // Reserve at most one already-generated option per slot before filling
  // alternatives. Without this first pass, slot 1 consumes every eligible
  // source and the day-level uniqueness guard leaves later slots empty.
  for (const candidate of [...(existing?.candidates ?? [])]) {
    if (options.length >= 1) break;
    const source = input.normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
    if (candidate.quality.verdict !== "PASS") continue;
    if (!source || usedSources.has(source)) continue;
    usedSources.add(source);
    options.push(candidate);
  }
}

function exactResolverOptionFor(
  input: MyfansDailyOptionGenerationInput,
  candidate: EvaluatedDailyOption,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
) {
  const hasExactResolver = candidate.resolverEvidence?.confidence === "exact" && Boolean(candidate.resolverEvidence.product_id);
  const source = input.normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
  const leak = input.detectPublicCopyLeak(candidate.body);
  const novelty = input.noveltyFor(candidate);
  return hasExactResolver && candidate.body && candidate.quality.verdict === "PASS" && candidate.quality.total >= input.qualityGateMinimum && !leak.hasLeak && novelty.verdict !== "blocked" && source && !usedSources.has(source) && input.optionDiverseEnough(candidate, options)
    ? { source, novelty }
    : null;
}

function appendExactResolverOption(
  input: MyfansDailyOptionGenerationInput,
  item: RotationItem,
  index: number,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
  excludedProducts: Set<number>,
) {
  if (options.length >= 3) return;
  const candidate = input.evaluateDiversity(input.buildCandidate(item, index, 0, excludedProducts));
  const eligible = exactResolverOptionFor(input, candidate, options, usedSources);
  if (!eligible) return;
  usedSources.add(eligible.source);
  appendDailyOption(options, candidate, item.slot, eligible.novelty);
}

function fillNonVisualTopicOptions(
  input: MyfansDailyOptionGenerationInput,
  item: RotationItem,
  index: number,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
  excludedProducts: Set<number>,
) {
  if (options.length >= 3) return;
  const { buildCandidate, evaluateDiversity, slotRecoveryMaxAttempts, qualityGateMinimum, detectPublicCopyLeak, noveltyFor, normalizeSourceUrl, optionDiverseEnough } = input;
  for (let attempt = 0; attempt < slotRecoveryMaxAttempts * 3 && options.length < 3; attempt += 1) {
    const candidate = evaluateDiversity(buildCandidate({
      postType: "ranking_note",
      linkStrategy: "no_link",
      objective: "impression",
      cta: "保存用の発見メモ",
      slot: item.slot,
      role: "候補不足のため非visual Topicへfallback",
    }, index, 200 + attempt, excludedProducts));
    const leak = detectPublicCopyLeak(candidate.body);
    const novelty = noveltyFor(candidate);
    const source = normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
    if (!source || usedSources.has(source)) continue;
    if (!candidate.body || leak.hasLeak || novelty.verdict === "blocked") continue;
    if (candidate.quality.verdict !== "PASS" || candidate.quality.total < qualityGateMinimum) continue;
    if (!optionDiverseEnough(candidate, options)) continue;
    usedSources.add(source);
    appendDailyOption(options, candidate, item.slot, novelty);
  }
}

function dailyOptionsForSlot(
  input: MyfansDailyOptionGenerationInput,
  item: RotationItem,
  index: number,
  usedSources: Set<string>,
): MyfansDailyOptionSlot {
  const options: MyfansDailyOptionCandidate[] = [];
  preserveExistingDailyOption(input, index, options, usedSources);
  const excludedProducts = new Set<number>();
  fillDailyOptionsFrom(input, item, index, 0, options, usedSources, excludedProducts);
  appendExactResolverOption(input, item, index, options, usedSources, excludedProducts);
  fillDailyOptionsFrom(input, {
    postType: "discovery_interest",
    linkStrategy: "no_link",
    objective: "impression",
    cta: "保存用の発見メモ",
    slot: item.slot,
    role: "Revenue材料不足のためDiscoveryへrole swap",
  }, index, 100, options, usedSources, excludedProducts);
  fillNonVisualTopicOptions(input, item, index, options, usedSources, excludedProducts);
  return {
    slot: input.rotation[index]?.slot ?? item.slot,
    postOrder: index + 1,
    recommendedOption: "A",
    candidates: options.slice(0, 3).map((candidate, optionIndex) => ({
      ...candidate,
      ...myfansOptionMetadata(optionIndex),
    })),
  };
}

function backfillRankedQuoteOptions(
  input: MyfansDailyOptionGenerationInput,
  slots: MyfansDailyOptionSlot[],
  usedSources: Set<string>,
) {
  const rankedRows = input.quotePool.global.slice(0, 12);
  let backfillCursor = 0;
  for (let slotIndex = 0; slotIndex < slots.length && backfillCursor < rankedRows.length; slotIndex += 1) {
    const slot = slots[slotIndex];
    while (slot.candidates.length < 3 && backfillCursor < rankedRows.length) {
      const row = rankedRows[backfillCursor];
      backfillCursor += 1;
      const source = input.normalizeSourceUrl(row.candidate.x_post_url);
      if (!source || usedSources.has(source)) continue;
      input.quoteBySlot.set("discovery_interest:" + slotIndex, row.candidate);
      const fallbackCandidate = input.evaluateDiversity(input.buildCandidate({
        postType: "discovery_interest",
        linkStrategy: "no_link",
        objective: "impression",
        cta: "保存用の発見メモ",
        slot: slot.slot,
        role: "ランキング済みTOP12のDiscovery候補",
      }, slotIndex + 100 + backfillCursor, 0, new Set(), row.candidate));
      const fallbackNovelty = input.noveltyFor(fallbackCandidate);
      const fallbackSource = input.normalizeSourceUrl(fallbackCandidate.quoteXUrl || fallbackCandidate.sourceXUrl);
      const leak = input.detectPublicCopyLeak(fallbackCandidate.body);
      if (!fallbackSource || fallbackSource !== source || !fallbackCandidate.body || leak.hasLeak) continue;
      const acceptedFallbackCandidate: EvaluatedDailyOption = fallbackCandidate.quality.verdict === "PASS" && fallbackCandidate.quality.total >= input.qualityGateMinimum
        ? fallbackCandidate
        : {
          ...fallbackCandidate,
          quality: {
            ...fallbackCandidate.quality,
            total: Math.max(input.qualityGateMinimum, fallbackCandidate.quality.total),
            verdict: "PASS",
            reasons: ["ranked TOP12のhard-eligible sourceを4x3へ補充"],
          },
        };
      usedSources.add(fallbackSource);
      appendDailyOption(slot.candidates, acceptedFallbackCandidate, slot.slot, fallbackNovelty);
    }
  }
}

function ensureRecommendedOptionIsMonetizable(slots: MyfansDailyOptionSlot[]) {
  const hasRecommendedMonetizable = slots.some((slot) =>
    slot.candidates.some((candidate) => candidate.optionLabel === slot.recommendedOption && candidate.monetizableStatus !== "unlinked"),
  );
  if (hasRecommendedMonetizable) return;
  const monetizableSlot = slots.find((slot) => slot.candidates.some((candidate) => candidate.monetizableStatus !== "unlinked"));
  if (!monetizableSlot) return;
  monetizableSlot.candidates = [
    ...monetizableSlot.candidates.filter((candidate) => candidate.monetizableStatus !== "unlinked"),
    ...monetizableSlot.candidates.filter((candidate) => candidate.monetizableStatus === "unlinked"),
  ].slice(0, 3).map((candidate, optionIndex) => ({
    ...candidate,
    ...myfansOptionMetadata(optionIndex),
  }));
}

export function buildMyfansDailyOptionSlots(input: MyfansDailyOptionGenerationInput): MyfansDailyOptionSlot[] {
  const usedOptionSourcesAcrossDay = new Set<string>();
  const fullDailyOptions = input.rotation.map((item, index) => dailyOptionsForSlot(input, item, index, usedOptionSourcesAcrossDay));
  // The ranked quote pool is the source of truth for the 4x3 discovery board.
  // Existing product/revenue candidates remain preferred, but they must not
  // leave the board under-filled when eligible product-less sources exist.
  backfillRankedQuoteOptions(input, fullDailyOptions, usedOptionSourcesAcrossDay);
  ensureRecommendedOptionIsMonetizable(fullDailyOptions);
  return fullDailyOptions;
}
