import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_MAX_MEDIA_BYTES = 64 * 1024 * 1024;

function storageBucket() {
  const bucket = process.env.SOCIAL_PUBLISHING_MEDIA_BUCKET?.trim();
  if (!bucket) throw new Error("Social publishing media bucket is not configured.");
  return bucket;
}

export async function assertPrivateSocialPublishingBucket() {
  const bucketName = storageBucket();
  const { data, error } = await supabaseAdmin.storage.getBucket(bucketName);
  if (error || !data || data.public !== false) {
    throw new Error("Social publishing requires a verified private media bucket.");
  }
  return bucketName;
}

export function socialPublishingMediaMaxBytes() {
  const configured = Number(process.env.SOCIAL_PUBLISHING_MAX_MEDIA_BYTES);
  if (!Number.isSafeInteger(configured) || configured < 1) return DEFAULT_MAX_MEDIA_BYTES;
  return Math.min(configured, 256 * 1024 * 1024);
}

export async function loadSocialPublishingMedia(storageKey: string) {
  if (!storageKey || storageKey.startsWith("/") || storageKey.includes("..") || storageKey.startsWith("http")) {
    throw new Error("Invalid private social media storage key.");
  }
  const bucket = await assertPrivateSocialPublishingBucket();
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(storageKey);
  if (error || !data) throw new Error("Could not read the private social media asset.");
  if (data.size > socialPublishingMediaMaxBytes()) throw new Error("Social media asset exceeds the configured size limit.");
  const bytes = Buffer.from(await data.arrayBuffer());
  const mimeType = data.type || "application/octet-stream";
  if (mimeType !== "video/mp4" || bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") {
    throw new Error("Cross-channel publishing accepts valid MP4 video assets only.");
  }
  return { bytes, mimeType, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function createSocialPublishingPreviewUrl(storageKey: string, expiresInSeconds = 300) {
  const bucket = await assertPrivateSocialPublishingBucket();
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storageKey, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error("Could not create a private media preview URL.");
  return data.signedUrl;
}
