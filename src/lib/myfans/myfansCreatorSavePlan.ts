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

type CreatorSavePlanInput = {
  record: MyfansCreatorSaveRecord;
  existing: ExistingMyfansCreatorIdentity;
  existingXUrl: string;
  creatorXUrl: string;
  sourceXHandle: string;
};

function hasConflictingXUrl(existingXUrl: string, creatorXUrl: string) {
  return Boolean(creatorXUrl && existingXUrl && creatorXUrl.toLowerCase() !== existingXUrl.toLowerCase());
}

function creatorXUrlConflictPlan(input: CreatorSavePlanInput): Extract<MyfansCreatorSavePlan, { kind: "x_url_conflict" }> {
  const { record, existing, existingXUrl, creatorXUrl } = input;
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

function creatorUpdateRecord(input: CreatorSavePlanInput, normalized: Record<string, unknown>) {
  const { existing, existingXUrl, creatorXUrl, sourceXHandle } = input;
  return Object.fromEntries(Object.entries({
    ...normalized,
    creator_x_url: existingXUrl || creatorXUrl || undefined,
    source_x_handle: existing.source_x_handle || sourceXHandle || undefined,
    x_url_source: existingXUrl ? undefined : normalized.x_url_source,
  }).filter(([, value]) => value !== undefined));
}

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
  const existingPlanInput = { record, existing, existingXUrl, creatorXUrl, sourceXHandle };
  if (hasConflictingXUrl(existingXUrl, creatorXUrl)) return creatorXUrlConflictPlan(existingPlanInput);

  return {
    kind: "update",
    creatorId: existing.id,
    record: creatorUpdateRecord(existingPlanInput, normalized),
    syncProductsCreatorXUrl: !existingXUrl && creatorXUrl ? creatorXUrl : null,
  };
}
