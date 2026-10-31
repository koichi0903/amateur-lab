export type ManualXPostInput = {
  workId: number;
  candidateId: string | null;
  slotId: string | null;
  candidateRank: string | null;
  slotRole: string | null;
  title: string;
  postText: string;
  intent: string | null;
  xPostId: string;
  trackingUrl: string | null;
  mediaAssetId: number | null;
  linkStrategy: string | null;
};

export type ManualXPostPayloadResult = { input: ManualXPostInput } | { error: string };

function asPayloadRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getXPostId(payload: Record<string, unknown> | null) {
  const xPostUrl = stringOrNull(payload?.xPostUrl)?.trim() ?? "";
  const match = xPostUrl.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)(?:[/?#].*)?$/i);
  return match?.[1] ?? null;
}

function manualPostSlotFields(
  payload: Record<string, unknown> | null,
): Pick<ManualXPostInput, "candidateId" | "slotId" | "candidateRank" | "slotRole" | "intent"> {
  return {
    candidateId: stringOrNull(payload?.candidateId),
    slotId: stringOrNull(payload?.slotId),
    candidateRank: stringOrNull(payload?.candidateRank),
    slotRole: stringOrNull(payload?.slotRole),
    intent: stringOrNull(payload?.intent),
  };
}

function manualPostCopyFields(
  payload: Record<string, unknown> | null,
): Pick<ManualXPostInput, "title" | "postText"> {
  return {
    title: stringOrNull(payload?.title) ?? "FANZA X Growth投稿",
    postText: stringOrNull(payload?.postText) ?? "",
  };
}

function manualPostTrackingFields(
  payload: Record<string, unknown> | null,
  xPostId: string,
): Pick<ManualXPostInput, "xPostId" | "trackingUrl" | "mediaAssetId" | "linkStrategy"> {
  const mediaAssetId = Number(payload?.mediaAssetId);
  return {
    xPostId,
    trackingUrl: stringOrNull(payload?.trackingUrl),
    mediaAssetId: Number.isSafeInteger(mediaAssetId) ? mediaAssetId : null,
    linkStrategy: stringOrNull(payload?.linkStrategy),
  };
}

function buildManualXPostInput(payload: Record<string, unknown> | null, xPostId: string): ManualXPostInput {
  return {
    workId: Number(payload?.workId),
    ...manualPostSlotFields(payload),
    ...manualPostCopyFields(payload),
    ...manualPostTrackingFields(payload, xPostId),
  };
}

export function parseManualXPostPayload(value: unknown): ManualXPostPayloadResult {
  const payload = asPayloadRecord(value);
  const xPostId = getXPostId(payload);
  if (!xPostId) {
    return { error: "作品ページのリンクを含むXポスト（自己リプにリンクした場合は自己リプ）のURLを入力してください。" };
  }
  return { input: buildManualXPostInput(payload, xPostId) };
}
