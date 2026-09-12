import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type XPostCreateResult = {
  id: string;
  text: string;
  mediaId?: string;
};

export type XApiCapabilityStatus = {
  accountPlan: "free";
  hasBearerToken: boolean;
  hasUserAccessToken: boolean;
  postingConfigured: boolean;
  mediaUploadConfigured: boolean;
  metricsConfigured: boolean;
  requiredForPosting: string[];
  notes: string[];
};

export function getXApiCapabilityStatus(): XApiCapabilityStatus {
  const hasBearerToken = Boolean(process.env.X_BEARER_TOKEN);
  const hasUserAccessToken = Boolean(process.env.X_USER_ACCESS_TOKEN);
  const postingConfigured = hasUserAccessToken;
  return {
    accountPlan: "free",
    hasBearerToken,
    hasUserAccessToken,
    postingConfigured,
    mediaUploadConfigured: postingConfigured,
    metricsConfigured: hasBearerToken || hasUserAccessToken,
    requiredForPosting: [
      "Approved X Developer App",
      "User Access Token for @hakkutsu_lab",
      "OAuth scope: tweet.write",
      "OAuth scope: tweet.read",
      "OAuth scope: users.read",
    ],
    notes: [
      "X Premium is not required by this app.",
      "X API Developer access and X account subscription are separate.",
      "Bearer-only app auth is treated as read-only and will not be used for posting.",
    ],
  };
}

function userAccessToken() {
  const value = process.env.X_USER_ACCESS_TOKEN;
  if (!value) {
    throw new Error("X_USER_ACCESS_TOKEN is required for X posting/media upload. X Premium is not required, but a @hakkutsu_lab User Access Token with tweet.write, tweet.read, and users.read scopes is required.");
  }
  return value;
}

function readToken() {
  const value = process.env.X_USER_ACCESS_TOKEN ?? process.env.X_BEARER_TOKEN;
  if (!value) {
    throw new Error("X_USER_ACCESS_TOKEN or X_BEARER_TOKEN is required for X API read-only checks.");
  }
  return value;
}

async function xFetch(path: string, init: RequestInit, tokenValue = userAccessToken()) {
  const response = await fetch(`https://api.x.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenValue}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    throw new Error(`X API ${response.status}: ${text || response.statusText}`);
  }
  return body;
}

async function uploadVideoFile(path: string, contentType = "video/mp4") {
  const bytes = await readFile(path);
  const init = await xFetch("/2/media/upload/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: contentType,
      total_bytes: bytes.byteLength,
      media_category: "tweet_video",
    }),
  }) as { data?: { id?: string; media_id?: string } };
  const mediaId = init.data?.id ?? init.data?.media_id;
  if (!mediaId) throw new Error("X media upload did not return a media id.");

  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0, segment = 0; offset < bytes.byteLength; offset += chunkSize, segment += 1) {
    const form = new FormData();
    form.set("segment_index", String(segment));
    form.set("media", new Blob([bytes.subarray(offset, offset + chunkSize)], { type: contentType }));
    await xFetch(`/2/media/upload/${mediaId}/append`, { method: "POST", body: form });
  }

  const finalized = await xFetch(`/2/media/upload/${mediaId}/finalize`, { method: "POST" }) as {
    data?: { processing_info?: { state?: string; check_after_secs?: number } };
  };
  let processing = finalized.data?.processing_info;
  for (let attempt = 0; processing?.state && processing.state !== "succeeded"; attempt += 1) {
    if (processing.state === "failed") throw new Error("X media processing failed.");
    if (attempt >= 12) throw new Error("X media processing did not finish in time.");
    await new Promise((resolve) => setTimeout(resolve, Math.max(processing?.check_after_secs ?? 2, 1) * 1000));
    const status = await xFetch(`/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, { method: "GET" }) as {
      data?: { processing_info?: { state?: string; check_after_secs?: number } };
    };
    processing = status.data?.processing_info;
  }
  return mediaId;
}

export async function downloadTempVideo(url: string) {
  const dir = await mkdtemp(join(tmpdir(), "x-growth-video-"));
  const file = join(dir, "sample.mp4");
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch sample movie: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(file, buffer);
    return { dir, file, contentType: response.headers.get("content-type") ?? "video/mp4" };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupTempVideo(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

export async function createXPost(input: { text: string; videoFile?: string; videoContentType?: string }): Promise<XPostCreateResult> {
  const mediaId = input.videoFile ? await uploadVideoFile(input.videoFile, input.videoContentType) : undefined;
  const created = await xFetch("/2/tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
  }) as { data?: { id?: string; text?: string } };
  if (!created.data?.id) throw new Error("X post creation did not return a post id.");
  return { id: created.data.id, text: created.data.text ?? input.text, mediaId };
}

export async function verifyXReadOnlyConnection() {
  const body = await xFetch("/2/users/by/username/hakkutsu_lab?user.fields=id,username,name", { method: "GET" }, readToken()) as {
    data?: { id?: string; username?: string; name?: string };
  };
  return {
    id: body.data?.id ?? null,
    username: body.data?.username ?? null,
    name: body.data?.name ?? null,
  };
}

export async function fetchXPostPublicMetrics(ids: string[]) {
  if (!ids.length) return new Map<string, { impressions: number; likes: number; replies: number; reposts: number }>();
  const body = await xFetch(`/2/tweets?ids=${encodeURIComponent(ids.join(","))}&tweet.fields=public_metrics`, {
    method: "GET",
  }, readToken()) as { data?: Array<{ id: string; public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; impression_count?: number } }> };
  return new Map((body.data ?? []).map((row) => [row.id, {
    impressions: row.public_metrics?.impression_count ?? 0,
    likes: row.public_metrics?.like_count ?? 0,
    replies: row.public_metrics?.reply_count ?? 0,
    reposts: row.public_metrics?.retweet_count ?? 0,
  }]));
}
