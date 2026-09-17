export const DEFAULT_CREATOR_COOLDOWN_DAYS = 3;
export const MIN_CREATOR_COOLDOWN_DAYS = 1;

export type QuoteRotationCreator = {
  id: number;
  display_name: string;
  creator_x_url: string;
};

export type CreatorVisit = {
  creator_id: number;
  processed_at: string | null;
};

export type QuoteRotationResult = {
  creators: QuoteRotationCreator[];
  eligibleCreators: number;
  cooldownExcludedCreators: number;
  selectionMode: "strict" | "relaxed" | "empty";
  cooldownDays: number;
  minimumCooldownDays: number;
};

function validTimestamp(value: string | null) {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function selectCreatorRotation(
  creators: QuoteRotationCreator[],
  visits: CreatorVisit[],
  requestedLimit: number | null,
  cooldownDays = DEFAULT_CREATOR_COOLDOWN_DAYS,
): QuoteRotationResult {
  const limit = requestedLimit && requestedLimit > 0 ? Math.round(requestedLimit) : creators.length;
  const normalizedCooldownDays = Math.max(MIN_CREATOR_COOLDOWN_DAYS, Math.min(30, Math.round(cooldownDays)));
  const now = Date.now();
  const strictCutoff = now - normalizedCooldownDays * 86_400_000;
  const minimumCutoff = now - MIN_CREATOR_COOLDOWN_DAYS * 86_400_000;
  const lastVisited = new Map<number, number>();

  for (const visit of visits) {
    const timestamp = validTimestamp(visit.processed_at);
    if (timestamp > (lastVisited.get(visit.creator_id) ?? 0)) lastVisited.set(visit.creator_id, timestamp);
  }

  const neverVisited = (creator: QuoteRotationCreator) => !(lastVisited.get(creator.id) ?? 0);
  const oldestFirst = (a: QuoteRotationCreator, b: QuoteRotationCreator) =>
    (lastVisited.get(a.id) ?? 0) - (lastVisited.get(b.id) ?? 0) || a.id - b.id;
  const strict = creators
    .filter((creator) => neverVisited(creator) || (lastVisited.get(creator.id) ?? 0) <= strictCutoff)
    .sort(oldestFirst);

  let selected = strict.slice(0, limit);
  let selectionMode: QuoteRotationResult["selectionMode"] = selected.length ? "strict" : "empty";

  // If every creator is inside the preferred cooldown, relax only to creators
  // older than the one-day hard floor. Never reuse a creator from the previous day.
  if (!selected.length) {
    selected = creators
      .filter((creator) => neverVisited(creator) || (lastVisited.get(creator.id) ?? 0) <= minimumCutoff)
      .sort(oldestFirst)
      .slice(0, limit);
    selectionMode = selected.length ? "relaxed" : "empty";
  }

  return {
    creators: selected,
    eligibleCreators: strict.length,
    cooldownExcludedCreators: creators.length - strict.length,
    selectionMode,
    cooldownDays: normalizedCooldownDays,
    minimumCooldownDays: MIN_CREATOR_COOLDOWN_DAYS,
  };
}
