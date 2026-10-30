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

function buildManualXPostInput(payload: Record<string, unknown> | null, xPostId: string): ManualXPostInput {
  const mediaAssetId = Number(payload?.mediaAssetId);
  return {
    workId: Number(payload?.workId),
    candidateId: stringOrNull(payload?.candidateId),
    slotId: stringOrNull(payload?.slotId),
    candidateRank: stringOrNull(payload?.candidateRank),
    slotRole: stringOrNull(payload?.slotRole),
    title: stringOrNull(payload?.title) ?? "FANZA X Growth投稿",
    postText: stringOrNull(payload?.postText) ?? "",
    intent: stringOrNull(payload?.intent),
    xPostId,
    trackingUrl: stringOrNull(payload?.trackingUrl),
    mediaAssetId: Number.isSafeInteger(mediaAssetId) ? mediaAssetId : null,
    linkStrategy: stringOrNull(payload?.linkStrategy),
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
