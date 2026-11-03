export type PushSubscriptionBody = {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  mediaType?: "regular" | "amateur";
  contentId?: string;
  workId?: number;
  priceAlert?: boolean;
  actressAlerts?: string[];
  makerAlerts?: string[];
};

type SharedSubscriptionPayload = {
  body: PushSubscriptionBody;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ValidatedPushSubscriptionPayload =
  | (SharedSubscriptionPayload & { kind: "amateur"; contentId: string })
  | (SharedSubscriptionPayload & { kind: "work"; workId: number });

export type PushSubscriptionPayloadResult =
  | { ok: true; value: ValidatedPushSubscriptionPayload }
  | { ok: false; message: string };

function normalizeEndpoint(value: string | undefined) {
  const endpoint = value?.trim() ?? "";
  if (!endpoint || endpoint.length > 2048) return null;
  try {
    return new URL(endpoint).protocol === "https:" ? endpoint : null;
  } catch {
    return null;
  }
}

function normalizeKey(value: string | undefined) {
  const key = value?.trim();
  return key && key.length <= 512 ? key : null;
}

function validateSharedPayload(body: PushSubscriptionBody) {
  const endpoint = normalizeEndpoint(body.subscription?.endpoint);
  const p256dh = normalizeKey(body.subscription?.keys?.p256dh);
  const auth = normalizeKey(body.subscription?.keys?.auth);
  if (!endpoint || !p256dh || !auth) {
    return { ok: false as const, message: "通知購読情報が不足しています" };
  }
  return { ok: true as const, value: { body, endpoint, p256dh, auth } };
}

function validateAmateurPayload(
  body: PushSubscriptionBody,
  shared: Extract<ReturnType<typeof validateSharedPayload>, { ok: true }>["value"],
): PushSubscriptionPayloadResult {
  const contentId = body.contentId?.trim() ?? "";
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(contentId)) {
    return { ok: false, message: "通知対象の作品IDが不正です。" };
  }
  return { ok: true, value: { ...shared, kind: "amateur", contentId } };
}

function validateWorkPayload(
  body: PushSubscriptionBody,
  shared: Extract<ReturnType<typeof validateSharedPayload>, { ok: true }>["value"],
): PushSubscriptionPayloadResult {
  const workId = Number(body.workId);
  if (!Number.isSafeInteger(workId) || workId <= 0) {
    return { ok: false, message: "通知購読情報が不足しています" };
  }
  return { ok: true, value: { ...shared, kind: "work", workId } };
}

export function validatePushSubscriptionPayload(
  body: PushSubscriptionBody,
): PushSubscriptionPayloadResult {
  const shared = validateSharedPayload(body);
  if (!shared.ok) return shared;
  const mediaType = body.mediaType ?? "regular";
  if (mediaType !== "regular" && mediaType !== "amateur") {
    return { ok: false, message: "通知対象の種類が不正です。" };
  }
  return mediaType === "amateur"
    ? validateAmateurPayload(body, shared.value)
    : validateWorkPayload(body, shared.value);
}
