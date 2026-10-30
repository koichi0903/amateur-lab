export type MyfansCreatorSaveRecord = {
  display_name: string;
  myfans_url: string;
  creator_x_url?: string;
  source_x_handle?: string;
  latest_quote_x_url?: string;
  genre?: string;
  activity_note?: string;
  x_url_source?: string;
};

export type ExistingMyfansCreatorIdentity = {
  id: number;
  creator_x_url: string | null;
  source_x_handle: string | null;
};

export type MyfansCreatorSavePlan =
  | { kind: "insert"; record: Record<string, unknown> }
  | {
      kind: "update";
      creatorId: number;
      record: Record<string, unknown>;
      syncProductsCreatorXUrl: string | null;
    }
  | {
      kind: "x_url_conflict";
      creatorId: number;
      source: string;
      existingXUrl: string;
      incomingXUrl: string;
      displayName: string;
      genre: string;
      activityNote: string;
    };

export function buildMyfansCreatorSavePlan(input: {
  record: MyfansCreatorSaveRecord;
  existing: ExistingMyfansCreatorIdentity | null;
  existingXUrl: string;
  creatorXUrl: string;
  sourceXHandle: string;
}): MyfansCreatorSavePlan {
  const { record, existing, existingXUrl, creatorXUrl, sourceXHandle } = input;
  const normalized = { ...record, creator_x_url: creatorXUrl, source_x_handle: sourceXHandle };

  if (!existing?.id) {
    return { kind: "insert", record: normalized };
  }
  if (creatorXUrl && existingXUrl && creatorXUrl.toLowerCase() !== existingXUrl.toLowerCase()) {
    return {
      kind: "x_url_conflict",
      creatorId: existing.id,
      source: record.x_url_source || "chrome_companion",
      existingXUrl,
      incomingXUrl: creatorXUrl,
      displayName: record.display_name,
      genre: record.genre ?? "",
      activityNote: `${record.activity_note ?? ""} X URL不一致のため既存URLを維持。`,
    };
  }

  const updateRecord = Object.fromEntries(Object.entries({
    ...normalized,
    creator_x_url: existingXUrl || creatorXUrl || undefined,
    source_x_handle: existing.source_x_handle || sourceXHandle || undefined,
    x_url_source: existingXUrl ? undefined : normalized.x_url_source,
  }).filter(([, value]) => value !== undefined));
  return {
    kind: "update",
    creatorId: existing.id,
    record: updateRecord,
    syncProductsCreatorXUrl: !existingXUrl && creatorXUrl ? creatorXUrl : null,
  };
}
