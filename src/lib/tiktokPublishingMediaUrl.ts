import { createHmac, timingSafeEqual } from "node:crypto";

// TikTok recommends at least 30 minutes for video_url availability.
const TOKEN_TTL_SECONDS = 45 * 60;

function mediaBaseUrl() {
  const raw = process.env.TIKTOK_MEDIA_PUBLIC_BASE_URL?.trim();
  if (!raw) throw new Error("TikTok verified media base URL is not configured.");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("TikTok media base URL must be a clean HTTPS origin or path.");
  }
  return url.toString().replace(/\/$/, "");
}

function signingSecret() {
  const secret = process.env.TIKTOK_MEDIA_URL_SIGNING_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("TikTok media URL signing secret must contain at least 32 bytes.");
  }
  return secret;
}

function signature(jobId: string, expires: number, revision: number, sha256: string) {
  return createHmac("sha256", signingSecret())
    .update(`${jobId}.${expires}.${revision}.${sha256}`)
    .digest("base64url");
}

export function createTikTokPublishingMediaUrl(job: {
  id: string;
  content_revision: number;
  media_sha256: string;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(job.id) || !Number.isInteger(job.content_revision) || !/^[a-f0-9]{64}$/i.test(job.media_sha256)) {
    throw new Error("TikTok media URL requires a job id, revision, and verified media checksum.");
  }

  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const url = new URL(`${mediaBaseUrl()}/api/social-publishing/media/tiktok/${job.id}`);
  url.searchParams.set("exp", String(expires));
  url.searchParams.set("rev", String(job.content_revision));
  url.searchParams.set("sha", job.media_sha256.toLowerCase());
  url.searchParams.set("sig", signature(job.id, expires, job.content_revision, job.media_sha256.toLowerCase()));
  return url.toString();
}

export function isValidTikTokPublishingMediaSignature(input: {
  jobId: string;
  expires: number;
  revision: number;
  sha256: string;
  suppliedSignature: string;
}) {
  if (!Number.isSafeInteger(input.expires) || input.expires <= Math.floor(Date.now() / 1000)
    || input.expires > Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    || !Number.isSafeInteger(input.revision) || input.revision < 1
    || !/^[a-f0-9]{64}$/i.test(input.sha256)
    || !/^[A-Za-z0-9_-]{43}$/.test(input.suppliedSignature)) return false;

  try {
    const expected = Buffer.from(signature(input.jobId, input.expires, input.revision, input.sha256.toLowerCase()), "base64url");
    const supplied = Buffer.from(input.suppliedSignature, "base64url");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
