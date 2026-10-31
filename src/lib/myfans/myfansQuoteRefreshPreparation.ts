import { MAX_MYFANS_ACCOUNTS_PER_RUN, selectCollectionAccounts } from "@/lib/myfansCollectionRotation";
import { normalizeXProfileUrl } from "@/lib/myfans/myfansTargetedCreatorRecommendations";

type CreatorRow = {
  id: number;
  creator_x_url: unknown;
};

export type NormalizedQuoteRefreshCreator<T extends CreatorRow = CreatorRow> = T & {
  creator_x_url: string;
};

export type QuoteRefreshCreatorState = {
  creator_id: number;
  rotation_order: number | null;
  collection_enabled: boolean | null;
  state?: string;
};

export type QuoteRefreshCursor = {
  cursor_order: number | null;
  cycle_no: number | null;
} | null;

export function orderQuoteRefreshCreators<T extends CreatorRow>(creators: readonly T[], targetedCreatorIds: readonly number[]) {
  return creators
    .map((creator) => ({ ...creator, creator_x_url: normalizeXProfileUrl(creator.creator_x_url) }))
    .filter((creator) => creator.creator_x_url)
    .filter((creator) => !targetedCreatorIds.length || targetedCreatorIds.includes(creator.id))
    .sort((a, b) => a.id - b.id) as Array<NormalizedQuoteRefreshCreator<T>>;
}

export function buildQuoteRefreshCreatorStates(
  orderedCreators: readonly NormalizedQuoteRefreshCreator[],
  existingStates: readonly QuoteRefreshCreatorState[],
) {
  const stateByCreator = new Map(existingStates.map((state) => [Number(state.creator_id), state]));
  const missingStates = orderedCreators
    .filter((creator) => !stateByCreator.has(creator.id))
    .map((creator) => ({ creator_id: creator.id, rotation_order: orderedCreators.findIndex((row) => row.id === creator.id) + 1, collection_enabled: true, state: "ELIGIBLE" }));
  return { stateByCreator, missingStates };
}

export function buildQuoteRefreshCollectionSelection(input: {
  creators: readonly NormalizedQuoteRefreshCreator[];
  stateByCreator: ReadonlyMap<number, QuoteRefreshCreatorState>;
  cursor: QuoteRefreshCursor;
  targetedCreatorCount: number;
  queueLimit: number;
}) {
  const collectionAccounts = input.creators.map((creator) => {
    const state = input.stateByCreator.get(creator.id);
    return { creatorId: creator.id, rotationOrder: Number(state?.rotation_order ?? creator.id), collectionEnabled: state?.collection_enabled !== false };
  });
  const collectionRotation = selectCollectionAccounts(
    collectionAccounts,
    { cursorOrder: Number(input.cursor?.cursor_order ?? 0), cycleNo: Number(input.cursor?.cycle_no ?? 1) },
    input.targetedCreatorCount ? Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, input.targetedCreatorCount) : input.queueLimit,
  );
  const selectedIds = new Set(collectionRotation.selected.map((account) => account.creatorId));
  const prioritized = input.creators.filter((creator) => selectedIds.has(creator.id));
  return { collectionRotation, prioritized };
}
