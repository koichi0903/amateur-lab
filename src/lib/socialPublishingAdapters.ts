import { randomUUID } from "node:crypto";
import { createSocialPublishingPreviewUrl } from "@/lib/socialPublishingMedia";
import { createTikTokPublishingMediaUrl } from "@/lib/tiktokPublishingMediaUrl";
import type { SocialPlatform } from "@/lib/socialPublishingOAuth";

type VideoJob = {
  id: string;
  caption: string;
  media_storage_key: string;
  youtube_privacy_status?: "public" | "unlisted" | "private" | null;
  tiktok_privacy_level?: "PUBLIC_TO_EVERYONE" | "FOLLOWER_OF_CREATOR" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY" | null;
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

async function tiktokJson(response: Response) {
  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: { code?: string; message?: string } } | null;
  if (!response.ok || !body || body.error?.code !== "ok" || !body.data) throw new Error("tiktok_provider_request_failed");
  return body.data;
}

export type TikTokCreatorInfo = {
  creatorUsername: string;
  creatorNickname: string;
  privacyLevelOptions: Array<"PUBLIC_TO_EVERYONE" | "FOLLOWER_OF_CREATOR" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY">;
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
};

export async function getTikTokCreatorInfo(token: string): Promise<TikTokCreatorInfo> {
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: "{}",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await tiktokJson(response) as {
    creator_username?: unknown; creator_nickname?: unknown; privacy_level_options?: unknown;
    comment_disabled?: unknown; duet_disabled?: unknown; stitch_disabled?: unknown; max_video_post_duration_sec?: unknown;
  };
  const options = data.privacy_level_options;
  const allowed = ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];
  if (typeof data.creator_username !== "string" || typeof data.creator_nickname !== "string"
    || !Array.isArray(options) || !options.length || !options.every((value) => allowed.includes(String(value)))
    || typeof data.comment_disabled !== "boolean" || typeof data.duet_disabled !== "boolean"
    || typeof data.stitch_disabled !== "boolean" || !Number.isInteger(data.max_video_post_duration_sec)) {
    throw new Error("TikTok creator settings were incomplete; refresh them before reviewing this post.");
  }
  return {
    creatorUsername: data.creator_username,
    creatorNickname: data.creator_nickname,
    privacyLevelOptions: options as TikTokCreatorInfo["privacyLevelOptions"],
    commentDisabled: data.comment_disabled,
    duetDisabled: data.duet_disabled,
    stitchDisabled: data.stitch_disabled,
    maxVideoPostDurationSec: data.max_video_post_duration_sec as number,
  };
}

async function publishTikTok(channel: Channel, token: string, job: VideoJob & { content_revision: number; media_sha256: string }): Promise<SocialPublishResult> {
  if (!job.tiktok_privacy_level) throw new Error("tiktok_privacy_level_required");
  const creator = await getTikTokCreatorInfo(token);
  if (!creator.privacyLevelOptions.includes(job.tiktok_privacy_level)) throw new Error("tiktok_privacy_level_no_longer_available");
  const videoUrl = createTikTokPublishingMediaUrl(job);
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: {
        title: job.caption,
        privacy_level: job.tiktok_privacy_level,
        disable_comment: creator.commentDisabled,
        disable_duet: creator.duetDisabled,
        disable_stitch: creator.stitchDisabled,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await tiktokJson(response);
  if (typeof data.publish_id !== "string" || !data.publish_id) throw new Error("tiktok_publish_id_missing");
  return { state: "processing", providerRequestId: data.publish_id };
}

export async function getTikTokPublishingStatus(token: string, publishId: string) {
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ publish_id: publishId }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await tiktokJson(response) as { status?: string; publicly_available_post_id?: unknown; publicaly_available_post_id?: unknown; post_ids?: unknown; fail_reason?: string };
  return {
    status: data.status,
    postIds: Array.isArray(data.post_ids) ? data.post_ids.filter((id): id is string => typeof id === "string" && id.length > 0) : typeof data.publicly_available_post_id === "string" ? [data.publicly_available_post_id] : typeof data.publicaly_available_post_id === "string" ? [data.publicaly_available_post_id] : [],
    reason: typeof data.fail_reason === "string" ? data.fail_reason : null,
  };
}

export async function publishSocialVideo(channel: Channel, token: string, job: VideoJob & { content_revision?: number; media_sha256?: string }, media: Buffer, mimeType: string): Promise<SocialPublishResult> {
  if (channel.platform === "youtube_shorts") return publishYoutube(channel, token, job, media, mimeType);
  if (channel.platform === "instagram_reels" || channel.platform === "threads") return publishMetaVideo(channel.platform, channel, token, job);
  if (channel.platform === "tiktok") {
    if (!Number.isInteger(job.content_revision) || !job.media_sha256) throw new Error("tiktok_approved_media_identity_missing");
    return publishTikTok(channel, token, { ...job, content_revision: job.content_revision as number, media_sha256: job.media_sha256 });
  }
  throw new Error("unsupported_social_platform");
}

export function isSocialPlatformValue(platform: string): platform is SocialPlatform {
  return platform === "youtube_shorts" || platform === "instagram_reels" || platform === "threads" || platform === "tiktok";
}
