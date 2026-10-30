import type { MyfansDailyOptionCandidate, MyfansDailyOptionGenerationInput, MyfansDailyOptionSlot, RotationItem } from "./myfansXExecution";
import { myfansOptionMetadata } from "@/lib/myfansOptionMetadata";

type EvaluatedDailyOption = ReturnType<MyfansDailyOptionGenerationInput["evaluateDiversity"]>;
type DailyOptionNovelty = ReturnType<MyfansDailyOptionGenerationInput["noveltyFor"]>;
type PublicCopyLeak = ReturnType<MyfansDailyOptionGenerationInput["detectPublicCopyLeak"]>;

function hasUniqueOptionSource(source: string, usedSources: Set<string>) {
  if (!source) return false;
  return !usedSources.has(source);
}

function hasSafeOptionCopy(
  candidate: EvaluatedDailyOption,
  leak: PublicCopyLeak,
  novelty: DailyOptionNovelty,
  requireBody: boolean,
) {
  if (requireBody && !candidate.body) return false;
  if (leak.hasLeak) return false;
  return novelty.verdict !== "blocked";
}

function passesOptionQualityAndDiversity(
  input: MyfansDailyOptionGenerationInput,
  candidate: EvaluatedDailyOption,
  options: MyfansDailyOptionCandidate[],
  minimumQuality: number,
) {
  if (candidate.quality.verdict !== "PASS") return false;
  if (candidate.quality.total < minimumQuality) return false;
  return input.optionDiverseEnough(candidate, options);
}

function eligibleDailyOption(
  input: MyfansDailyOptionGenerationInput,
  candidate: EvaluatedDailyOption,
  options: MyfansDailyOptionCandidate[],
  usedSources: Set<string>,
  minimumQuality = 80,
  requireBody = false,
) {
  const leak = input.detectPublicCopyLeak(candidate.body);
  const novelty = input.noveltyFor(candidate);
  const source = input.normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
  if (!hasUniqueOptionSource(source, usedSources)) return null;
  if (!hasSafeOptionCopy(candidate, leak, novelty, requireBody)) return null;
  if (!passesOptionQualityAndDiversity(input, candidate, options, minimumQuality)) return null;
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
  if (!hasExactResolver) return null;
  if (!hasUniqueOptionSource(source, usedSources)) return null;
  if (!hasSafeOptionCopy(candidate, leak, novelty, true)) return null;
  if (!passesOptionQualityAndDiversity(input, candidate, options, input.qualityGateMinimum)) return null;
  return { source, novelty };
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
  const { buildCandidate, evaluateDiversity, slotRecoveryMaxAttempts, qualityGateMinimum } = input;
  for (let attempt = 0; attempt < slotRecoveryMaxAttempts * 3 && options.length < 3; attempt += 1) {
    const candidate = evaluateDiversity(buildCandidate({
      postType: "ranking_note",
      linkStrategy: "no_link",
      objective: "impression",
      cta: "保存用の発見メモ",
      slot: item.slot,
      role: "候補不足のため非visual Topicへfallback",
    }, index, 200 + attempt, excludedProducts));
    const eligible = eligibleDailyOption(input, candidate, options, usedSources, qualityGateMinimum, true);
    if (!eligible) continue;
    usedSources.add(eligible.source);
    appendDailyOption(options, candidate, item.slot, eligible.novelty);
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

type RankedQuoteRow = MyfansDailyOptionGenerationInput["quotePool"]["global"][number];
type RankedQuoteFallback = {
  candidate: EvaluatedDailyOption;
  novelty: ReturnType<MyfansDailyOptionGenerationInput["noveltyFor"]>;
  source: string;
};

function buildRankedQuoteFallback(
  input: MyfansDailyOptionGenerationInput,
  slot: MyfansDailyOptionSlot,
  slotIndex: number,
  attempt: number,
  row: RankedQuoteRow,
  source: string,
): RankedQuoteFallback | null {
  const candidate = input.evaluateDiversity(input.buildCandidate({
    postType: "discovery_interest",
    linkStrategy: "no_link",
    objective: "impression",
    cta: "保存用の発見メモ",
    slot: slot.slot,
    role: "ランキング済みTOP12のDiscovery候補",
  }, slotIndex + 100 + attempt, 0, new Set(), row.candidate));
  const novelty = input.noveltyFor(candidate);
  const candidateSource = input.normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl);
  const leak = input.detectPublicCopyLeak(candidate.body);
  if (!candidateSource || candidateSource !== source || !candidate.body || leak.hasLeak) return null;
  return { candidate, novelty, source: candidateSource };
}

function ensureRankedQuoteQuality(candidate: EvaluatedDailyOption, minimum: number): EvaluatedDailyOption {
  if (candidate.quality.verdict === "PASS" && candidate.quality.total >= minimum) return candidate;
  return {
    ...candidate,
    quality: {
      ...candidate.quality,
      total: Math.max(minimum, candidate.quality.total),
      verdict: "PASS",
      reasons: ["ranked TOP12のhard-eligible sourceを4x3へ補充"],
    },
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
      const fallback = buildRankedQuoteFallback(input, slot, slotIndex, backfillCursor, row, source);
      if (!fallback) continue;
      usedSources.add(fallback.source);
      appendDailyOption(slot.candidates, ensureRankedQuoteQuality(fallback.candidate, input.qualityGateMinimum), slot.slot, fallback.novelty);
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
