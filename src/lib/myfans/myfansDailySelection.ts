export type MyfansFinalDailyCandidate = {
  id: string;
  plannedSlot: string;
  optionLabel?: "A" | "B" | "C";
  quality: { total: number };
  monetizableStatus: string;
  sourceAuthorHandle?: string | null;
  sourceCreator?: { handle?: string | null } | null;
};

export type MyfansFinalDailySlot<TCandidate extends MyfansFinalDailyCandidate> = {
  slot: string;
  postOrder: number;
  recommendedOption: string;
  candidates: TCandidate[];
};

function needsMonetizableCandidate<TCandidate extends MyfansFinalDailyCandidate>(
  slot: MyfansFinalDailySlot<TCandidate>,
  dailyOptions: MyfansFinalDailySlot<TCandidate>[],
) {
  return slot.postOrder >= 3 && !dailyOptions
    .slice(0, slot.postOrder - 1)
    .some((previous) => previous.candidates.some((candidate) => candidate.optionLabel === previous.recommendedOption && candidate.monetizableStatus !== "unlinked"));
}

function compareDailyCandidates<TCandidate extends MyfansFinalDailyCandidate>(
  a: TCandidate,
  b: TCandidate,
  recommendedOption: string,
  prioritizeMonetizable: boolean,
) {
  const aMonetizable = a.monetizableStatus !== "unlinked" ? 1 : 0;
  const bMonetizable = b.monetizableStatus !== "unlinked" ? 1 : 0;
  if (prioritizeMonetizable && aMonetizable !== bMonetizable) return bMonetizable - aMonetizable;
  if ((a.optionLabel === recommendedOption) !== (b.optionLabel === recommendedOption)) return a.optionLabel === recommendedOption ? -1 : 1;
  return b.quality.total - a.quality.total;
}

function rankDailySlotCandidates<TCandidate extends MyfansFinalDailyCandidate>(
  slot: MyfansFinalDailySlot<TCandidate>,
  dailyOptions: MyfansFinalDailySlot<TCandidate>[],
) {
  const prioritizeMonetizable = needsMonetizableCandidate(slot, dailyOptions);
  return [...slot.candidates].sort((a, b) => compareDailyCandidates(a, b, slot.recommendedOption, prioritizeMonetizable));
}

function authorHandleFor<TCandidate extends MyfansFinalDailyCandidate>(candidate: TCandidate | null) {
  return (candidate?.sourceAuthorHandle || candidate?.sourceCreator?.handle || "").toLowerCase();
}

function selectCandidateForSlot<TCandidate extends MyfansFinalDailyCandidate>(
  slot: MyfansFinalDailySlot<TCandidate>,
  dailyOptions: MyfansFinalDailySlot<TCandidate>[],
  usedAuthors: Set<string>,
) {
  const ranked = rankDailySlotCandidates(slot, dailyOptions);
  const picked = ranked.find((candidate) => {
    const author = authorHandleFor(candidate);
    return !author || !usedAuthors.has(author);
  }) ?? ranked[0] ?? null;
  const author = authorHandleFor(picked);
  if (author) usedAuthors.add(author);
  return picked;
}

export function selectMyfansFinalDailyCandidates<TCandidate extends MyfansFinalDailyCandidate>(
  dailyOptions: MyfansFinalDailySlot<TCandidate>[],
  minimum: number,
  maximum: number,
) {
  const usedAuthors = new Set<string>();
  const selectedPerSlot = dailyOptions
    .map((slot) => selectCandidateForSlot(slot, dailyOptions, usedAuthors))
    .filter((candidate): candidate is TCandidate => Boolean(candidate));
  const rankedSelectedCandidates = [...selectedPerSlot]
    .sort((a, b) => b.quality.total - a.quality.total || a.plannedSlot.localeCompare(b.plannedSlot));
  const selectedCount = rankedSelectedCandidates.length >= minimum
    ? Math.min(maximum, rankedSelectedCandidates.length)
    : rankedSelectedCandidates.length;
  const finalCandidates = rankedSelectedCandidates.slice(0, selectedCount);
  const selectedOptions = Object.fromEntries(finalCandidates.map((candidate) => {
    const postOrder = dailyOptions.find((slot) => slot.candidates.some((option) => option.id === candidate.id))?.postOrder;
    return postOrder ? [String(postOrder), candidate.optionLabel ?? "A"] : null;
  }).filter((entry): entry is [string, string] => Boolean(entry)));
  return { finalCandidates, selectedOptions };
}
