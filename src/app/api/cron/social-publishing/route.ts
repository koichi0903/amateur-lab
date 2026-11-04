import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertPrivateSocialPublishingBucket, loadSocialPublishingMedia } from "@/lib/socialPublishingMedia";
import { getUsableSocialAccessToken } from "@/lib/socialPublishingOAuth";
import { getTikTokPublishingStatus, getYoutubePublishingStatus, publishSocialVideo } from "@/lib/socialPublishingAdapters";
import { isTikTokAutoPublishingConfigured } from "@/lib/socialPublishingReadiness";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_SELECT = "id, channel_id, content_kind, caption, youtube_privacy_status, media_storage_key, media_sha256, scheduled_at, status, content_revision, review_status, review_attested, approved_revision, attempt_count, max_attempts, provider_request_id, updated_at";

function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown_publish_error";
  return /^[a-z0-9_]{1,64}$/.test(value) ? value : "provider_request_failed";
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (process.env.SOCIAL_PUBLISHING_WORKER_ENABLED !== "true") {
    return NextResponse.json({ workerEnabled: false, claimed: false }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await assertPrivateSocialPublishingBucket();
  } catch {
    return NextResponse.json({ error: "Worker stopped because a private media bucket could not be verified." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date();
  const pollBefore = new Date(now.getTime() - 45_000).toISOString();
  const { data: pendingProvider, error: pendingProviderError } = await supabaseAdmin
    .from("social_publishing_jobs")
    .select(JOB_SELECT)
    .eq("status", "publishing")
    .eq("review_status", "approved")
    .eq("review_attested", true)
    .not("provider_request_id", "is", null)
    .lte("updated_at", pollBefore)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendingProviderError) return NextResponse.json({ error: "Could not load provider publishing status." }, { status: 503 });
  if (pendingProvider?.provider_request_id) {
    const { data: pendingChannel, error: pendingChannelError } = await supabaseAdmin
      .from("social_publishing_channels")
      .select("id, platform, provider_account_id, enabled")
      .eq("id", pendingProvider.channel_id)
      .maybeSingle();
    if (pendingChannelError || !pendingChannel?.enabled || !["tiktok", "youtube_shorts"].includes(pendingChannel.platform)) {
      return NextResponse.json({ error: "The pending provider post no longer has an enabled destination." }, { status: 409 });
    }
    if (pendingProvider.approved_revision !== pendingProvider.content_revision || pendingProvider.attempt_count > pendingProvider.max_attempts) {
      return NextResponse.json({ error: "The pending provider post no longer matches its approved revision." }, { status: 409 });
    }
    try {
      const token = await getUsableSocialAccessToken(pendingChannel.id);
      const checkedAt = new Date().toISOString();
      if (pendingChannel.platform === "youtube_shorts") {
        const result = await getYoutubePublishingStatus(token, pendingProvider.provider_request_id);
        if (result.state === "published") {
          const { data: completed, error } = await supabaseAdmin.from("social_publishing_jobs")
            .update({ status: "published", provider_post_id: pendingProvider.provider_request_id, published_at: checkedAt, updated_at: checkedAt, last_error_code: null, last_error_message: null })
            .eq("id", pendingProvider.id).eq("status", "publishing").eq("content_revision", pendingProvider.content_revision).eq("provider_request_id", pendingProvider.provider_request_id)
            .select("id, status, provider_post_id, provider_request_id, published_at").maybeSingle();
          if (error || !completed) return NextResponse.json({ error: "YouTube reports processing completion, but the result could not be recorded. Reconcile manually before retrying.", jobId: pendingProvider.id }, { status: 503 });
          return NextResponse.json({ job: completed }, { headers: { "Cache-Control": "no-store" } });
        }
        if (result.state === "failed") {
          const { data: failed, error } = await supabaseAdmin.from("social_publishing_jobs")
            .update({ status: "failed", updated_at: checkedAt, last_error_code: "youtube_processing_failed", last_error_message: "YouTube reported a terminal upload or processing failure. Check YouTube Studio before creating a replacement." })
            .eq("id", pendingProvider.id).eq("status", "publishing").eq("content_revision", pendingProvider.content_revision).eq("provider_request_id", pendingProvider.provider_request_id)
            .select("id, status, provider_request_id, last_error_code").maybeSingle();
          if (error || !failed) return NextResponse.json({ error: "YouTube's terminal result could not be recorded.", jobId: pendingProvider.id }, { status: 503 });
          return NextResponse.json({ job: failed }, { headers: { "Cache-Control": "no-store" } });
        }
        const { error } = await supabaseAdmin.from("social_publishing_jobs").update({ updated_at: checkedAt, last_error_code: result.state === "missing" ? "youtube_video_not_indexed" : null, last_error_message: null })
          .eq("id", pendingProvider.id).eq("status", "publishing").eq("content_revision", pendingProvider.content_revision).eq("provider_request_id", pendingProvider.provider_request_id);
        if (error) return NextResponse.json({ error: "Could not record the latest YouTube status check." }, { status: 503 });
        return NextResponse.json({ jobId: pendingProvider.id, status: result.state }, { headers: { "Cache-Control": "no-store" } });
      }
      const result = await getTikTokPublishingStatus(token, pendingProvider.provider_request_id);
      if (result.status === "PUBLISH_COMPLETE" && result.postIds[0]) {
        const { data: completed, error } = await supabaseAdmin
          .from("social_publishing_jobs")
          .update({ status: "published", provider_post_id: result.postIds[0], published_at: checkedAt, updated_at: checkedAt, last_error_code: null, last_error_message: null })
          .eq("id", pendingProvider.id)
          .eq("status", "publishing")
          .eq("content_revision", pendingProvider.content_revision)
          .eq("provider_request_id", pendingProvider.provider_request_id)
          .select("id, status, provider_post_id, provider_request_id, published_at")
          .maybeSingle();
        if (error || !completed) return NextResponse.json({ error: "TikTok reports completion, but the result could not be recorded. Reconcile manually before retrying.", jobId: pendingProvider.id }, { status: 503 });
        return NextResponse.json({ job: completed }, { headers: { "Cache-Control": "no-store" } });
      }
      if (result.status === "FAILED" || result.status === "SEND_TO_USER_INBOX") {
        const failureCode = result.status === "SEND_TO_USER_INBOX" ? "tiktok_manual_finish_required" : `tiktok_${safeErrorCode(new Error(result.reason ?? "publish_failed"))}`;
        const { data: failed, error } = await supabaseAdmin
          .from("social_publishing_jobs")
          .update({ status: "failed", updated_at: checkedAt, last_error_code: failureCode, last_error_message: result.status === "SEND_TO_USER_INBOX" ? "TikTok routed this item to its in-app inbox. Automatic public publication was not confirmed; inspect the account before making another post." : "TikTok reported a terminal publishing failure. Inspect the provider status before creating a replacement." })
          .eq("id", pendingProvider.id)
          .eq("status", "publishing")
          .eq("content_revision", pendingProvider.content_revision)
          .eq("provider_request_id", pendingProvider.provider_request_id)
          .select("id, status, provider_request_id, last_error_code")
          .maybeSingle();
        if (error || !failed) return NextResponse.json({ error: "TikTok's terminal result could not be recorded.", jobId: pendingProvider.id }, { status: 503 });
        return NextResponse.json({ job: failed }, { headers: { "Cache-Control": "no-store" } });
      }
      const { error } = await supabaseAdmin
        .from("social_publishing_jobs")
        .update({ updated_at: checkedAt, last_error_code: result.status === "PUBLISH_COMPLETE" ? "tiktok_post_id_pending" : null, last_error_message: null })
        .eq("id", pendingProvider.id)
        .eq("status", "publishing")
        .eq("provider_request_id", pendingProvider.provider_request_id);
      if (error) return NextResponse.json({ error: "Could not record the latest TikTok status check." }, { status: 503 });
      return NextResponse.json({ jobId: pendingProvider.id, status: result.status ?? "PROCESSING" }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Could not check TikTok publishing status. The provider request will not be resubmitted." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  const { data: due, error: findError } = await supabaseAdmin
    .from("social_publishing_jobs")
    .select(JOB_SELECT)
    .eq("status", "scheduled")
    .eq("review_status", "approved")
    .eq("review_attested", true)
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: "Queue storage is unavailable." }, { status: 503 });
  if (!due) return NextResponse.json({ workerEnabled: true, claimed: false }, { headers: { "Cache-Control": "no-store" } });
  if (due.content_kind !== "video" || !due.media_storage_key || !due.media_sha256) {
    return NextResponse.json({ error: "This job does not contain a verified publishable video." }, { status: 409 });
  }
  if (due.approved_revision !== due.content_revision || due.attempt_count >= due.max_attempts) {
    return NextResponse.json({ error: "The approved revision is stale or the retry limit was reached." }, { status: 409 });
  }

  const { data: destination, error: destinationError } = await supabaseAdmin
    .from("social_publishing_channels")
    .select("id, platform, enabled")
    .eq("id", due.channel_id)
    .maybeSingle();
  if (destinationError || !destination?.enabled) {
    return NextResponse.json({ error: "The approved post destination is unavailable or disabled." }, { status: 409 });
  }
  if (destination.platform === "tiktok" && !isTikTokAutoPublishingConfigured()) {
    return NextResponse.json({ workerEnabled: true, claimed: false, reason: "tiktok_internal_tool_ineligible" }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("social_publishing_jobs")
    .update({ status: "publishing", attempt_count: due.attempt_count + 1, updated_at: now.toISOString() })
    .eq("id", due.id)
    .eq("status", "scheduled")
    .eq("review_status", "approved")
    .eq("review_attested", true)
    .eq("content_revision", due.content_revision)
    .eq("approved_revision", due.content_revision)
    .select(JOB_SELECT)
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: "Could not claim the approved post." }, { status: 503 });
  if (!claimed) return NextResponse.json({ workerEnabled: true, claimed: false, reason: "already_claimed_or_changed" }, { headers: { "Cache-Control": "no-store" } });

  try {
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("social_publishing_channels")
      .select("id, platform, provider_account_id, enabled")
      .eq("id", claimed.channel_id)
      .maybeSingle();
    if (channelError || !channel?.enabled) throw new Error("channel_not_enabled");
    if (!['youtube_shorts', 'instagram_reels', 'threads', 'tiktok'].includes(channel.platform)) throw new Error("unsupported_social_platform");
    if (channel.platform === "tiktok" && !isTikTokAutoPublishingConfigured()) {
      const { error: releaseError } = await supabaseAdmin
        .from("social_publishing_jobs")
        .update({ status: "scheduled", attempt_count: due.attempt_count, updated_at: new Date().toISOString(), last_error_code: "tiktok_internal_tool_ineligible", last_error_message: "TikTok Direct Post is unavailable from this internal-only admin tool. The approved job remains scheduled and was not sent." })
        .eq("id", claimed.id)
        .eq("status", "publishing")
        .eq("content_revision", claimed.content_revision)
        .is("provider_request_id", null);
      if (releaseError) return NextResponse.json({ error: "TikTok setup changed before dispatch and the approved job could not be safely released. Do not retry manually until its queue state is checked.", jobId: claimed.id }, { status: 503 });
      return NextResponse.json({ workerEnabled: true, claimed: false, reason: "tiktok_setup_changed_before_dispatch", jobId: claimed.id }, { headers: { "Cache-Control": "no-store" } });
    }
    const current = await loadSocialPublishingMedia(claimed.media_storage_key);
    if (current.sha256 !== claimed.media_sha256) throw new Error("media_checksum_mismatch");
    const token = await getUsableSocialAccessToken(channel.id);
    const published = await publishSocialVideo(channel, token, claimed, current.bytes, current.mimeType);
    const publishedAt = new Date().toISOString();
    if (published.state === "processing") {
      const { data: processing, error: processingError } = await supabaseAdmin
        .from("social_publishing_jobs")
        .update({ provider_request_id: published.providerRequestId, updated_at: publishedAt, last_error_code: null, last_error_message: null })
        .eq("id", claimed.id)
        .eq("status", "publishing")
        .eq("content_revision", claimed.content_revision)
        .select("id, status, provider_request_id, updated_at")
        .maybeSingle();
      if (processingError || !processing) return NextResponse.json({ error: "The provider accepted the post but its request id could not be saved. Do not retry automatically; reconcile the provider account first.", jobId: claimed.id }, { status: 503, headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ job: processing }, { headers: { "Cache-Control": "no-store" } });
    }
    const { data: finished, error: finishError } = await supabaseAdmin
      .from("social_publishing_jobs")
      .update({ status: "published", provider_post_id: published.providerPostId, published_at: publishedAt, updated_at: publishedAt, last_error_code: null, last_error_message: null })
      .eq("id", claimed.id)
      .eq("status", "publishing")
      .eq("content_revision", claimed.content_revision)
      .select("id, status, provider_post_id, published_at")
      .maybeSingle();
    if (finishError || !finished) {
      return NextResponse.json({ error: "Provider accepted the post but the result could not be recorded. Reconcile manually before retrying.", jobId: claimed.id }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ job: finished }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = safeErrorCode(error);
    const { error: saveError } = await supabaseAdmin
      .from("social_publishing_jobs")
      .update({ status: "failed", last_error_code: code, last_error_message: "Automatic publishing stopped. Review the provider status before creating a replacement job.", updated_at: new Date().toISOString() })
      .eq("id", claimed.id)
      .eq("status", "publishing")
      .eq("content_revision", claimed.content_revision);
    if (saveError) return NextResponse.json({ error: "Publishing stopped, but the job state could not be saved.", jobId: claimed.id }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "Publishing stopped; no automatic retry will occur.", code, jobId: claimed.id }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
