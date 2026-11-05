import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSocialPublishingMedia } from "@/lib/socialPublishingMedia";

export const dynamic = "force-dynamic";

type ReviewPayload = {
  decision?: unknown;
  contentRevision?: unknown;
  reviewAttested?: unknown;
  sourceUsageAttested?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin review requests are required." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  }
  const payload = await request.json().catch(() => null) as ReviewPayload | null;
  if (!payload || !["approve", "reject"].includes(String(payload.decision)) || !Number.isInteger(payload.contentRevision) || Number(payload.contentRevision) < 1) {
    return NextResponse.json({ error: "A review decision and current content revision are required." }, { status: 400 });
  }
  if (payload.decision === "approve" && payload.reviewAttested !== true) {
    return NextResponse.json({ error: "Confirm the exact media, caption, destination, and schedule before approving." }, { status: 400 });
  }

  const revision = Number(payload.contentRevision);
  const { data: job, error: jobError } = await supabaseAdmin
    .from("social_publishing_jobs")
    .select("id, channel_id, content_kind, youtube_privacy_status, caption, media_storage_key, media_sha256, source_work_id, source_maker, scheduled_at, status, content_revision, review_status")
    .eq("id", id)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: "Could not load post review state." }, { status: 503 });
  if (!job) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (job.source_work_id !== null && (typeof job.source_maker !== "string" || !job.source_maker.trim())) {
    return NextResponse.json({ error: "公式サンプルのメーカーを確認できないため、この投稿は承認できません。" }, { status: 409 });
  }
  if (payload.decision === "approve" && job.source_work_id !== null && payload.sourceUsageAttested !== true) {
    return NextResponse.json({ error: "公式サンプルのメーカー利用条件を確認し、適合を確認してください。" }, { status: 400 });
  }
  if (job.status !== "awaiting_user_review" || job.review_status !== "pending" || job.content_revision !== revision) {
    return NextResponse.json({ error: "This draft changed or is no longer awaiting review. Refresh it before deciding." }, { status: 409 });
  }

  const now = new Date();
  if (payload.decision === "approve") {
    if (new Date(job.scheduled_at).getTime() < now.getTime() + 60_000) {
      return NextResponse.json({ error: "The scheduled time has passed or is too close. Update it and review the new version." }, { status: 409 });
    }
    const { data: channel, error: channelError } = await supabaseAdmin
      .from("social_publishing_channels")
      .select("id, platform, enabled")
      .eq("id", job.channel_id)
      .maybeSingle();
    if (channelError) return NextResponse.json({ error: "Could not verify the destination account." }, { status: 503 });
    if (!channel?.enabled) return NextResponse.json({ error: "The destination account is not enabled." }, { status: 409 });
    if (channel.platform === "tiktok") return NextResponse.json({ error: "TikTok運用は廃止されています。この投稿は承認できません。" }, { status: 409 });
    if (channel.platform === "youtube_shorts" && !["public", "unlisted", "private"].includes(String(job.youtube_privacy_status))) {
      return NextResponse.json({ error: "YouTubeの公開範囲が未選択です。下書きを作り直して確認してください。" }, { status: 409 });
    }
    if (channel.platform !== "youtube_shorts" && job.youtube_privacy_status !== null) {
      return NextResponse.json({ error: "YouTube公開範囲の保存状態が不正です。承認を中止しました。" }, { status: 409 });
    }
    if (job.content_kind !== "text") {
      if (!job.media_storage_key || !job.media_sha256) {
        return NextResponse.json({ error: "The reviewed media asset is missing its verified checksum." }, { status: 409 });
      }
      try {
        const media = await loadSocialPublishingMedia(job.media_storage_key);
        if (media.sha256 !== job.media_sha256) {
          return NextResponse.json({ error: "The media changed after this draft was prepared. Refresh the draft and review it again." }, { status: 409 });
        }
      } catch {
        return NextResponse.json({ error: "The reviewed media can no longer be verified. Refresh the draft before approving." }, { status: 409 });
      }
    }
  }

  const approved = payload.decision === "approve";
  const { data, error } = await supabaseAdmin
    .from("social_publishing_jobs")
    .update({
      status: approved ? "scheduled" : "rejected",
      review_status: approved ? "approved" : "rejected",
      review_attested: approved && payload.reviewAttested === true,
      source_usage_attested: approved && job.source_work_id !== null && payload.sourceUsageAttested === true,
      source_usage_checked_at: approved && job.source_work_id !== null && payload.sourceUsageAttested === true ? now.toISOString() : null,
      approved_revision: approved ? revision : null,
      reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .eq("content_revision", revision)
    .eq("status", "awaiting_user_review")
    .eq("review_status", "pending")
    .select("id, status, review_status, content_revision, approved_revision, reviewed_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save the review decision." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "The draft changed while it was being reviewed. Refresh and review the latest version." }, { status: 409 });
  return NextResponse.json({ job: data }, { headers: { "Cache-Control": "no-store" } });
}
