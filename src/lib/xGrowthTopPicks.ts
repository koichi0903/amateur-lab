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
  const state: TopPickNormalizationState = {
    slotCounts: new Map(),
    workIds: new Set(),
    mediaIds: new Set(),
    movieUrls: new Set(),
  };
  return input.flatMap((value, index) => {
    const raw = topPickRecord(value);
    if (!raw) return [];
    const identity = uniqueTopPickIdentity(raw, postedWorkIds, state);
    if (!identity) return [];
    const assignment = topPickAssignment(raw, index, identity.workId, state.slotCounts);
    return [{ ...raw, ...identity, ...assignment } as CanonicalTopPick];
  });
}

type TopPickNormalizationState = {
  slotCounts: Map<string, number>;
  workIds: Set<number>;
  mediaIds: Set<number>;
  movieUrls: Set<string>;
};

function topPickRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function topPickMediaId(raw: Record<string, unknown>) {
  const asset = topPickRecord(raw.mediaAsset);
  return asset ? numberValue(asset.id) : null;
}

function topPickMovieUrl(raw: Record<string, unknown>) {
  if (typeof raw.sampleMovieUrl === "string") return raw.sampleMovieUrl.trim();
  return typeof raw.recommendedMediaUrl === "string" && raw.mediaType === "sample_movie" ? raw.recommendedMediaUrl.trim() : "";
}

function uniqueTopPickIdentity(raw: Record<string, unknown>, postedWorkIds: ReadonlySet<number>, state: TopPickNormalizationState) {
  const workId = numberValue(raw.workId ?? raw.work_id);
  if (!workId || postedWorkIds.has(workId)) return null;
  const mediaId = topPickMediaId(raw);
  const movieUrl = topPickMovieUrl(raw);
  if (state.workIds.has(workId) || (mediaId && state.mediaIds.has(mediaId)) || (movieUrl && state.movieUrls.has(movieUrl))) return null;
  state.workIds.add(workId);
  if (mediaId) state.mediaIds.add(mediaId);
  if (movieUrl) state.movieUrls.add(movieUrl);
  return { workId };
}

function topPickRank(raw: Record<string, unknown>, count: number): CanonicalTopPick["candidateRank"] {
  const value = raw.candidateRank ?? raw.candidate_rank;
  return typeof value === "string" && ranks.includes(value as CanonicalTopPick["candidateRank"])
    ? value as CanonicalTopPick["candidateRank"]
    : ranks[Math.min(ranks.length - 1, count)];
}

function topPickId(raw: Record<string, unknown>, slotId: CanonicalTopPick["slotId"], candidateRank: CanonicalTopPick["candidateRank"], workId: number, index: number) {
  if (typeof raw.candidateId === "string" && raw.candidateId.trim()) return raw.candidateId;
  if (typeof raw.candidate_id === "string" && raw.candidate_id.trim()) return raw.candidate_id;
  return `${slotId}-${candidateRank}-${workId}-${index}`;
}

function topPickSelection(raw: Record<string, unknown>, candidateRank: CanonicalTopPick["candidateRank"]) {
  return typeof raw.isSelected === "boolean" ? raw.isSelected : typeof raw.selected === "boolean" ? raw.selected : candidateRank === "A";
}

function topPickAssignment(raw: Record<string, unknown>, index: number, workId: number, slotCounts: Map<string, number>) {
  const slotId = slotValue(raw.slotId ?? raw.slot_id, index, raw.pickOrder ?? raw.pick_order);
  const count = slotCounts.get(slotId) ?? 0;
  slotCounts.set(slotId, count + 1);
  const candidateRank = topPickRank(raw, count);
  return {
    slotId,
    candidateRank,
    candidateId: topPickId(raw, slotId, candidateRank, workId, index),
    isSelected: topPickSelection(raw, candidateRank),
  };
}

export function buildTopPickSlotsViewModel<T extends { slotId?: string }>(candidates: readonly T[]) {
  return slots.map((slotId) => ({ slotId, candidates: candidates.filter((candidate) => candidate.slotId === slotId) }));
}
