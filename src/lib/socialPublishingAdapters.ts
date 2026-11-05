import { randomUUID } from "node:crypto";
import { createSocialPublishingPreviewUrl } from "@/lib/socialPublishingMedia";
import type { SocialPlatform } from "@/lib/socialPublishingOAuth";

type VideoJob = {
  id: string;
  caption: string;
  media_storage_key: string;
  youtube_privacy_status?: "public" | "unlisted" | "private" | null;

};

type Channel = {
  provider_account_id: string;
  platform: string;
};

export type SocialPublishResult =
  | { state: "published"; providerPostId: string }
  | { state: "processing"; providerRequestId: string };

async function responseJson(response: Response) {
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data) throw new Error("provider_request_failed");
  if (data.error) throw new Error("provider_rejected_post");
  return data;
}

function graphVersion() {
  const version = process.env.SOCIAL_GRAPH_API_VERSION?.trim() || "v24.0";
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("invalid_meta_api_version");
  return version;
}

function firstLine(caption: string) {
  return caption.split(/\r?\n/, 1)[0].trim();
}

async function publishYoutube(channel: Channel, token: string, job: VideoJob, media: Buffer, mimeType: string): Promise<SocialPublishResult> {
  const title = firstLine(job.caption);
  if (!title || [...title].length > 100 || Buffer.byteLength(job.caption, "utf8") > 5000) throw new Error("youtube_caption_out_of_range");
  if (!job.youtube_privacy_status || !["public", "unlisted", "private"].includes(job.youtube_privacy_status)) throw new Error("youtube_privacy_status_required");
  const boundary = `hakkutsu_${randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    snippet: { title, description: job.caption, categoryId: "24" },
    status: { privacyStatus: job.youtube_privacy_status, selfDeclaredMadeForKids: false },
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    media,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const url = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("part", "snippet,status");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(45_000),
  });
  const data = await responseJson(response) as { id?: string; snippet?: { channelId?: string } };
  if (!data.id || (data.snippet?.channelId && data.snippet.channelId !== channel.provider_account_id)) throw new Error("youtube_upload_response_invalid");
  return { state: "processing", providerRequestId: data.id };
}

export async function getYoutubePublishingStatus(token: string, videoId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status,processingDetails");
  url.searchParams.set("id", videoId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await responseJson(response) as { items?: Array<{ id?: string; status?: { uploadStatus?: string }; processingDetails?: { processingStatus?: string } }> };
  const video = data.items?.find((item) => item.id === videoId);
  if (!video) return { state: "missing" as const };
  const uploadStatus = video.status?.uploadStatus;
  const processingStatus = video.processingDetails?.processingStatus;
  if (["failed", "rejected", "deleted"].includes(uploadStatus ?? "") || ["failed", "terminated"].includes(processingStatus ?? "")) return { state: "failed" as const };
  if (uploadStatus === "processed" && processingStatus === "succeeded") return { state: "published" as const };
  return { state: "processing" as const };
}

async function graphPost(url: URL, token: string) {
  return responseJson(await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(25_000),
  }));
}

async function graphGet(url: URL, token: string) {
  return responseJson(await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  }));
}

async function publishMetaVideo(platform: "instagram_reels" | "threads", channel: Channel, token: string, job: VideoJob): Promise<SocialPublishResult> {
  const root = platform === "instagram_reels" ? "https://graph.facebook.com" : "https://graph.threads.net";
  const version = platform === "instagram_reels" ? graphVersion() : "v1.0";
  const mediaUrl = await createSocialPublishingPreviewUrl(job.media_storage_key, 6 * 60 * 60);
  const createUrl = new URL(`${root}/${version}/${encodeURIComponent(channel.provider_account_id)}/${platform === "instagram_reels" ? "media" : "threads"}`);
  createUrl.searchParams.set("media_type", platform === "instagram_reels" ? "REELS" : "VIDEO");
  createUrl.searchParams.set("video_url", mediaUrl);
  createUrl.searchParams.set(platform === "instagram_reels" ? "caption" : "text", job.caption);
  if (platform === "instagram_reels") createUrl.searchParams.set("share_to_feed", "true");
  const container = await graphPost(createUrl, token) as { id?: string };
  if (!container.id) throw new Error("meta_container_id_missing");

  const statusUrl = new URL(`${root}/${version}/${encodeURIComponent(container.id)}`);
  const statusField = platform === "threads" ? "status" : "status_code";
  statusUrl.searchParams.set("fields", statusField);
  let ready = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await graphGet(statusUrl, token) as { status?: string; status_code?: string };
    const state = platform === "threads" ? result.status : result.status_code;
    if (state === "FINISHED") { ready = true; break; }
    if (state === "ERROR" || state === "EXPIRED") throw new Error("meta_container_processing_failed");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!ready) throw new Error("meta_container_processing_timeout");

  const publishUrl = new URL(`${root}/${version}/${encodeURIComponent(channel.provider_account_id)}/${platform === "instagram_reels" ? "media_publish" : "threads_publish"}`);
  publishUrl.searchParams.set("creation_id", container.id);
  const published = await graphPost(publishUrl, token) as { id?: string };
  if (!published.id) throw new Error("meta_published_id_missing");
  return { state: "published", providerPostId: published.id };
}

export async function publishSocialVideo(channel: Channel, token: string, job: VideoJob & { content_revision?: number; media_sha256?: string }, media: Buffer, mimeType: string): Promise<SocialPublishResult> {
  if (channel.platform === "youtube_shorts") return publishYoutube(channel, token, job, media, mimeType);
  if (channel.platform === "instagram_reels" || channel.platform === "threads") return publishMetaVideo(channel.platform, channel, token, job);
  throw new Error("unsupported_social_platform");
}

export function isSocialPlatformValue(platform: string): platform is SocialPlatform {
  return platform === "youtube_shorts" || platform === "instagram_reels" || platform === "threads";
}
