export const AMATEUR_X_SHARED_QUEUE_ACCOUNT = "unassigned" as const;
export const AMATEUR_X_POSTED_COOLDOWN_DAYS = 30;

export function amateurXPostJobTextColumns(texts: { mainText: string; replyText: string }) {
  return { main_text: texts.mainText, reply_text: texts.replyText };
}

export function amateurXPostJobStatusColumns(input: {
  status: "posted" | "skipped";
  xPostUrl?: string;
  postedAt: string;
  mainText?: string;
  replyText?: string;
}) {
  const postUrl = input.xPostUrl?.trim() ?? "";
  const postedAccount = input.status === "posted" && postUrl ? getXPostAccountHandle(postUrl) : null;
  return {
    status: input.status,
    account_handle: postedAccount ?? AMATEUR_X_SHARED_QUEUE_ACCOUNT,
    x_post_url: postUrl || null,
    posted_at: input.status === "posted" ? input.postedAt : null,
    ...(input.status === "posted" ? { main_text: input.mainText, reply_text: input.replyText } : {}),
  };
}

export function buildAmateurXReplyText(title: string, price: number | null, trackedUrl: string) {
  const lines = [
    title.trim() || "FANZA素人作品",
    ...(price && Number.isSafeInteger(price) ? [`💰${price.toLocaleString("ja-JP")}円〜`] : []),
    "✅PayPay払いOK",
    "✅初回は500円OFFクーポンあり",
    "",
    "続きはこちら👇（PR）",
    trackedUrl,
  ];
  const text = lines.join("\n");
  if (text.length <= 280) return text;

  const suffix = `\n${lines.slice(1).join("\n")}`;
  const titleLimit = Math.max(0, 280 - suffix.length);
  return `${lines[0].slice(0, titleLimit).trimEnd()}${suffix}`;
}

export function getLegacyAmateurXReplyTrackingKey(replyText: string, contentId: string) {
  const prefix = `https://hakkutsu-lab.com/amateur/${encodeURIComponent(contentId)}?from=x&x_post=`;
  const lines = replyText.replace(/\r\n/g, "\n").split("\n");
  if (lines.length !== 2 || lines[0] !== "👇作品詳細・価格推移はこちら" || !lines[1].startsWith(prefix)) return null;
  const encodedKey = lines[1].slice(prefix.length);
  if (!encodedKey || /\s/.test(encodedKey)) return null;
  try {
    const trackingKey = decodeURIComponent(encodedKey);
    return encodeURIComponent(trackingKey) === encodedKey ? trackingKey : null;
  } catch {
    return null;
  }
}

export type AmateurXCandidateJobState = {
  id: number;
  content_id: string;
  status: "pending" | "posted" | "skipped";
  posted_at?: string | null;
  created_at?: string | null;
};

export function getRecentlyPostedContentIds(
  postedJobs: Array<Pick<AmateurXCandidateJobState, "content_id" | "posted_at" | "created_at">>,
  now = Date.now(),
) {
  const cutoff = now - AMATEUR_X_POSTED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const recentIds = new Set<string>();
  for (const job of postedJobs) {
    const timestamp = Date.parse(job.posted_at ?? job.created_at ?? "");
    if (Number.isFinite(timestamp) && timestamp > cutoff) recentIds.add(job.content_id);
  }
  return recentIds;
}

export function mergeAmateurXCandidateJobs(
  pendingJobs: AmateurXCandidateJobState[],
  sharedHistory: AmateurXCandidateJobState[],
) {
  const jobs = new Map<string, AmateurXCandidateJobState>();
  for (const job of sharedHistory) jobs.set(job.content_id, job);
  for (const job of pendingJobs) jobs.set(job.content_id, job);
  return jobs;
}

export function withoutSkippedAmateurXCandidates<T extends { content_id: string }>(
  candidates: readonly T[],
  skippedContentIds: ReadonlySet<string>,
) {
  return candidates.filter((candidate) => !skippedContentIds.has(candidate.content_id));
}

export function getXPostAccountHandle(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !["x.com", "twitter.com"].includes(url.hostname.toLowerCase())) return null;
  const match = /^\/([A-Za-z0-9_]{1,15})\/status\/\d+\/?$/.exec(url.pathname);
  return match?.[1]?.toLowerCase() ?? null;
}
