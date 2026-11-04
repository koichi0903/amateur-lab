import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSocialTokenEncryptionConfigured } from "@/lib/socialPublishingReadiness";
import { getMissingSocialPublishingScopes, isSocialPlatform } from "@/lib/socialPublishingOAuth";
import { assertPrivateSocialPublishingBucket } from "@/lib/socialPublishingMedia";

export const dynamic = "force-dynamic";

const CHANNELS = [
  { key: "youtube_shorts", label: "YouTube Shorts", appKeys: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"] },
  { key: "instagram_reels", label: "Instagram Reels", appKeys: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_REDIRECT_URI"] },
  { key: "threads", label: "Threads", appKeys: ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI"] },
  { key: "tiktok", label: "TikTok（手動投稿準備）", appKeys: [] },
] as const;

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokenEncryptionConfigured = isSocialTokenEncryptionConfigured();
  let privateMediaBucketVerified = false;
  try {
    await assertPrivateSocialPublishingBucket();
    privateMediaBucketVerified = true;
  } catch {
    privateMediaBucketVerified = false;
  }
  const results = CHANNELS.map((channel) => ({
    key: channel.key,
    label: channel.label,
    appConfigured: channel.key !== "tiktok" && channel.appKeys.length > 0 && channel.appKeys.every((key) => Boolean(process.env[key])),
    missingAppKeys: channel.key === "tiktok" ? [] : channel.appKeys.filter((key) => !process.env[key]),
    connected: false,
    accountLabel: null as string | null,
    channelId: null as string | null,
    enabled: false,
    missingScopes: [] as string[],
    canConnect: false,
  }));

  let schemaReady = false;
  let channels: Array<{ id: string; platform: string; account_label: string; enabled: boolean; scopes: string[] }> = [];
  let databaseError: string | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from("social_publishing_channels")
      .select("id, platform, account_label, enabled, scopes")
      .order("created_at", { ascending: true });
    if (error) throw error;
    schemaReady = true;
    channels = data ?? [];
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Social publishing storage is unavailable.";
  }

  for (const channel of results) {
    const connected = channels.find((row) => row.platform === channel.key);
    channel.connected = Boolean(connected);
    channel.accountLabel = connected?.account_label ?? null;
    channel.channelId = connected?.id ?? null;
    channel.enabled = connected?.enabled ?? false;
    channel.missingScopes = connected && isSocialPlatform(connected.platform)
      ? getMissingSocialPublishingScopes(connected.platform, connected.scopes ?? [])
      : [];
    // TikTok is intentionally manual-only in this internal publishing tool.
    channel.canConnect = channel.key !== "tiktok" && channel.appConfigured && schemaReady && tokenEncryptionConfigured;
  }

  return NextResponse.json({
    channels: results,
    schemaReady,
    tokenEncryptionConfigured,
    privateMediaBucketVerified,
    databaseError,
    // Shared readiness for the three supported automatic destinations. TikTok's
    // separate manual-preparation path must not disable these destinations.
    publicPostingGate: schemaReady && tokenEncryptionConfigured && privateMediaBucketVerified,
    workerEnabled: process.env.SOCIAL_PUBLISHING_WORKER_ENABLED === "true",
    tiktokAdapterReady: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
