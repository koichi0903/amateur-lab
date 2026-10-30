import type { XPostLogInput, XPostLogIntent } from "./xPostLogs";
import type { XPostCandidate } from "./xPostPlanner";

const categories = new Set<XPostCandidate["category"]>([
  "sales",
  "deal",
  "hidden_gem",
  "score",
  "new",
  "today_buy",
  "today_discovery",
  "actress_best",
  "genre_best",
  "maker_best",
  "series_best",
]);
const hookTypes = new Set<XPostCandidate["hookType"]>([
  "price_anomaly",
  "rating_anomaly",
  "ranking_anomaly",
  "review_proof",
  "discovery_anomaly",
  "buy_timing",
]);
const imageStrategies = new Set<XPostCandidate["imageStrategy"]>(["original_work_image", "branded_data_card"]);
const linkStrategies = new Set<XPostCandidate["linkStrategy"]>(["body_link", "reply_link"]);
const ctaStrategies = new Set<XPostCandidate["ctaStrategy"]>(["price_cta", "reason_cta"]);
const postIntents = new Set<XPostLogIntent>(["work_link", "reply", "quote", "profile", "repost", "normal"]);

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readAllowedValue<T extends string>(value: unknown, allowed: ReadonlySet<T>): T | null {
  return typeof value === "string" && allowed.has(value as T) ? value as T : null;
}

export function isValidPostDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasRequiredPostFields(fields: {
  postKey: string;
  workId: number;
  category: XPostCandidate["category"] | null;
  title: string;
  postText: string;
  postDate: string;
}): boolean {
  return Boolean(fields.postKey) &&
    Number.isSafeInteger(fields.workId) &&
    fields.workId > 0 &&
    Boolean(fields.category) &&
    Boolean(fields.title) &&
    Boolean(fields.postText) &&
    isValidPostDate(fields.postDate);
}

function parseOptionalFields(candidate: Record<string, unknown>) {
  return {
    creativeVariantId: typeof candidate.creativeVariantId === "string" ? candidate.creativeVariantId : null,
    hookType: readAllowedValue(candidate.hookType, hookTypes),
    imageStrategy: readAllowedValue(candidate.imageStrategy, imageStrategies),
    linkStrategy: readAllowedValue(candidate.linkStrategy, linkStrategies),
    ctaStrategy: readAllowedValue(candidate.ctaStrategy, ctaStrategies),
    accountHandle: readString(candidate.accountHandle, "hakkutsu_lab").trim().replace(/^@/, ""),
    postIntent: readAllowedValue(candidate.postIntent, postIntents) ?? "work_link",
    scheduledSlot: typeof candidate.scheduledSlot === "string" ? candidate.scheduledSlot.trim() : null,
    plannedAt: typeof candidate.plannedAt === "string" ? candidate.plannedAt.trim() : null,
  };
}

export function parseXPostLogPayload(payload: unknown): XPostLogInput | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Record<string, unknown>;
  const postKey = readString(candidate.postKey);
  const workId = Number(candidate.workId);
  const category = readAllowedValue(candidate.category, categories);
  const title = readString(candidate.title);
  const postText = readString(candidate.postText);
  const postDate = readString(candidate.postDate);
  const optional = parseOptionalFields(candidate);

  if (!hasRequiredPostFields({ postKey, workId, category, title, postText, postDate })) return null;

  return {
    postKey: postKey.slice(0, 120),
    workId,
    category: category!,
    title: title.slice(0, 300),
    postText: postText.slice(0, 1000),
    postDate,
    creativeVariantId: optional.creativeVariantId?.slice(0, 160) ?? null,
    hookType: optional.hookType,
    imageStrategy: optional.imageStrategy,
    linkStrategy: optional.linkStrategy,
    ctaStrategy: optional.ctaStrategy,
    accountHandle: optional.accountHandle === "hakkutsu_lab" ? "hakkutsu_lab" : "hakkutsu_lab",
    postIntent: optional.postIntent,
    scheduledSlot: optional.scheduledSlot ? optional.scheduledSlot.slice(0, 40) : null,
    plannedAt: optional.plannedAt || null,
  };
}
