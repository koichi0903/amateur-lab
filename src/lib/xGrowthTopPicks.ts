export type CanonicalTopPick = Record<string, unknown> & {
  workId: number;
  slotId: "slot_1" | "slot_2" | "slot_3";
  candidateRank: "A" | "B" | "C";
  candidateId: string;
  isSelected: boolean;
};

const slots = ["slot_1", "slot_2", "slot_3"] as const;
const ranks = ["A", "B", "C"] as const;

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function slotValue(value: unknown, index: number, pickOrder: unknown): CanonicalTopPick["slotId"] {
  if (typeof value === "string" && slots.includes(value as CanonicalTopPick["slotId"])) return value as CanonicalTopPick["slotId"];
  const order = numberValue(pickOrder);
  return slots[Math.min(slots.length - 1, Math.max(0, (order ?? index + 1) - 1))];
}

export function normalizeTopPickCandidates(input: unknown, postedWorkIds: ReadonlySet<number> = new Set()) {
  if (!Array.isArray(input)) return [] as CanonicalTopPick[];
  const slotCounts = new Map<string, number>();
  const workIds = new Set<number>();
  const mediaIds = new Set<number>();
  const movieUrls = new Set<string>();
  return input.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const raw = value as Record<string, unknown>;
    const workId = numberValue(raw.workId ?? raw.work_id);
    if (!workId || postedWorkIds.has(workId)) return [];
    const rawAsset = raw.mediaAsset;
    const mediaId = rawAsset && typeof rawAsset === "object" && !Array.isArray(rawAsset)
      ? numberValue((rawAsset as Record<string, unknown>).id)
      : null;
    const movieUrl = typeof raw.sampleMovieUrl === "string" ? raw.sampleMovieUrl.trim()
      : typeof raw.recommendedMediaUrl === "string" && raw.mediaType === "sample_movie" ? raw.recommendedMediaUrl.trim() : "";
    if (workIds.has(workId) || (mediaId && mediaIds.has(mediaId)) || (movieUrl && movieUrls.has(movieUrl))) return [];
    workIds.add(workId);
    if (mediaId) mediaIds.add(mediaId);
    if (movieUrl) movieUrls.add(movieUrl);
    const slotId = slotValue(raw.slotId ?? raw.slot_id, index, raw.pickOrder ?? raw.pick_order);
    const count = slotCounts.get(slotId) ?? 0;
    slotCounts.set(slotId, count + 1);
    const rankValue = raw.candidateRank ?? raw.candidate_rank;
    const candidateRank = typeof rankValue === "string" && ranks.includes(rankValue as CanonicalTopPick["candidateRank"])
      ? rankValue as CanonicalTopPick["candidateRank"]
      : ranks[Math.min(ranks.length - 1, count)];
    const candidateId = typeof raw.candidateId === "string" && raw.candidateId.trim()
      ? raw.candidateId
      : typeof raw.candidate_id === "string" && raw.candidate_id.trim()
        ? raw.candidate_id
        : `${slotId}-${candidateRank}-${workId}-${index}`;
    const isSelected = typeof raw.isSelected === "boolean" ? raw.isSelected : typeof raw.selected === "boolean" ? raw.selected : candidateRank === "A";
    return [{ ...raw, workId, slotId, candidateRank, candidateId, isSelected } as CanonicalTopPick];
  });
}

export function buildTopPickSlotsViewModel<T extends { slotId?: string }>(candidates: readonly T[]) {
  return slots.map((slotId) => ({ slotId, candidates: candidates.filter((candidate) => candidate.slotId === slotId) }));
}
