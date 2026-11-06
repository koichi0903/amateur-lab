import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { isOfficialFanzaDmmSampleUrl, sourceDomain } from "@/lib/xMediaAssets";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertPrivateSocialPublishingBucket, createSocialPublishingPreviewUrl, loadSocialPublishingMedia, socialPublishingMediaMaxBytes } from "@/lib/socialPublishingMedia";
import { readAndCleanupTrimmedVideo, TrimVideoDiagnosticError, trimVideoForX } from "@/lib/xVideoTrim";
import { captureFanzaSampleMovieUrl } from "@/lib/playwright/captureFanzaSampleMovie";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function getSampleCandidates() {
  const [{ data, error }, { data: usedJobs, error: jobsError }] = await Promise.all([
    supabaseAdmin
    .from("works")
    .select("id, product_id, title, maker, price, sale_price, discount_rate, ranking, ranking_score, review_average, review_count, release_date, image_url, sample_movie_url, is_on_sale, sale_end_at")
    .not("sample_movie_url", "is", null)
    .neq("sample_movie_url", "")
    .order("ranking_score", { ascending: false, nullsFirst: false })
    .limit(100),
    supabaseAdmin.from("social_publishing_jobs").select("source_work_id, channel_id").not("source_work_id", "is", null).limit(5000),
  ]);
  if (error) return NextResponse.json({ error: "作品候補を取得できませんでした。" }, { status: 503 });
  if (jobsError) return NextResponse.json({ error: "投稿履歴を確認できないため、重複除外付きの候補を作れません。" }, { status: 503 });
  const usedByWork = new Map<number, Set<string>>();
  for (const job of usedJobs ?? []) {
    if (!Number.isSafeInteger(job.source_work_id) || typeof job.channel_id !== "string") continue;
    const channels = usedByWork.get(job.source_work_id) ?? new Set<string>();
    channels.add(job.channel_id);
    usedByWork.set(job.source_work_id, channels);
  }
  const candidates = (data ?? [])
    .filter((work) => Number.isSafeInteger(work.id) && work.id > 0 && isOfficialFanzaDmmSampleUrl(work.sample_movie_url))
    .slice(0, 20)
    .map((work) => ({
      key: `works:${work.id}`, sourceWorkId: work.id, sourceCatalogContentId: null,
      id: work.id, productId: work.product_id, title: work.title, maker: work.maker, price: work.price, salePrice: work.sale_price,
      discountRate: work.discount_rate, ranking: work.ranking, rankingScore: work.ranking_score,
      reviewAverage: work.review_average, reviewCount: work.review_count, releaseDate: work.release_date,
      imageUrl: work.image_url, sampleMovieUrl: work.sample_movie_url, isOnSale: work.is_on_sale, saleEndAt: work.sale_end_at,
      usedChannelIds: [...(usedByWork.get(work.id) ?? [])],
    }));
  return NextResponse.json({ candidates, fetchedAt: new Date().toISOString(), source: "works table; stored facts may be stale; verify current official terms before approval" }, {
    headers: { "Cache-Control": "no-store" },
  });
}

function makerFromItemInfo(iteminfo: unknown) {
  if (!iteminfo || typeof iteminfo !== "object" || Array.isArray(iteminfo)) return null;
  const rawMakers = (iteminfo as Record<string, unknown>).maker;
  const makers = Array.isArray(rawMakers) ? rawMakers : rawMakers ? [rawMakers] : [];
  for (const maker of makers) {
    if (!maker || typeof maker !== "object" || Array.isArray(maker)) continue;
    const name = (maker as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

async function getFanzaAmateurSampleCandidates(query: string) {
  const normalizedQuery = query.trim();
  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(normalizedQuery)) {
    return NextResponse.json({ error: "品番は英数字・ハイフン・アンダースコアの3〜120文字で入力してください。" }, { status: 400 });
  }

  const [{ data, error }, { data: usedJobs, error: jobsError }] = await Promise.all([
    supabaseAdmin
      .from("fanza_amateur_works")
      .select("content_id, product_id, title, iteminfo, image_url, api_date, rank, mp4_url, mp4_status")
      .eq("mp4_status", "found")
      .not("mp4_url", "is", null)
      .or(`content_id.ilike.${normalizedQuery},product_id.ilike.${normalizedQuery}`)
      .order("api_date", { ascending: false, nullsFirst: false })
      .limit(20),
    supabaseAdmin
      .from("social_publishing_jobs")
      .select("source_catalog_content_id, channel_id")
      .not("source_catalog_content_id", "is", null)
      .limit(5000),
  ]);
  if (error) return NextResponse.json({ error: "素人作品APIカタログを検索できませんでした。" }, { status: 503 });
  if (jobsError) {
    const migrationMissing = jobsError.code === "42703" || jobsError.code === "PGRST204";
    return NextResponse.json({ error: migrationMissing ? "投稿キューのカタログ作品対応migrationが未適用です。" : "投稿履歴を確認できないため、重複除外付きの候補を作れません。" }, { status: 503 });
  }

  const usedByContentId = new Map<string, Set<string>>();
  for (const job of usedJobs ?? []) {
    if (typeof job.source_catalog_content_id !== "string" || typeof job.channel_id !== "string") continue;
    const channels = usedByContentId.get(job.source_catalog_content_id) ?? new Set<string>();
    channels.add(job.channel_id);
    usedByContentId.set(job.source_catalog_content_id, channels);
  }

  const candidates = (data ?? [])
    .filter((row) => typeof row.content_id === "string" && typeof row.mp4_url === "string" && isOfficialFanzaDmmSampleUrl(row.mp4_url))
    .map((row) => {
      const image = row.image_url && typeof row.image_url === "object" && !Array.isArray(row.image_url)
        ? row.image_url as Record<string, unknown>
        : {};
      return {
        key: `catalog:${row.content_id}`,
        sourceWorkId: null,
        sourceCatalogContentId: row.content_id,
        id: null,
        productId: typeof row.product_id === "string" ? row.product_id : row.content_id,
        title: typeof row.title === "string" && row.title.trim() ? row.title : row.content_id,
        maker: makerFromItemInfo(row.iteminfo),
        price: null,
        salePrice: null,
        discountRate: null,
        ranking: typeof row.rank === "number" ? row.rank : null,
        rankingScore: null,
        reviewAverage: null,
        reviewCount: null,
        releaseDate: typeof row.api_date === "string" ? row.api_date : null,
        imageUrl: typeof image.large === "string" ? image.large : typeof image.small === "string" ? image.small : null,
        sampleMovieUrl: row.mp4_url as string,
        isOnSale: null,
        saleEndAt: null,
        usedChannelIds: [...(usedByContentId.get(row.content_id) ?? [])],
      };
    });
  return NextResponse.json({ candidates, fetchedAt: new Date().toISOString(), source: "fanza_amateur_works; official sample URL and maker must be reviewed before approval" }, {
    headers: { "Cache-Control": "no-store" },
  });
}

function isMissingCatalogSourceColumn(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.nextUrl.searchParams.get("view") === "sample-candidates") {
    const query = request.nextUrl.searchParams.get("q");
    return query === null ? getSampleCandidates() : getFanzaAmateurSampleCandidates(query);
  }
  const { data, error } = await supabaseAdmin
    .from("social_publishing_jobs")
    .select("id, idempotency_key, content_kind, caption, youtube_privacy_status, media_storage_key, media_sha256, source_work_id, source_catalog_content_id, source_sample_url_hash, source_sample_host, source_maker, source_usage_attested, source_usage_checked_at, trim_start_seconds, trim_end_seconds, scheduled_at, status, content_revision, review_status, review_attested, approved_revision, reviewed_at, provider_request_id, provider_post_id, published_at, last_error_code, channel:social_publishing_channels(platform, account_label)")
    .order("scheduled_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: isMissingCatalogSourceColumn(error) ? "投稿キューのカタログ作品対応migrationが未適用です。" : "Could not load the publishing queue." }, { status: 503 });
  const bucket = process.env.SOCIAL_PUBLISHING_MEDIA_BUCKET;
  const jobs = await Promise.all((data ?? []).map(async (job) => {
    if (!bucket || !job.media_storage_key || job.status !== "awaiting_user_review") return { ...job, previewUrl: null };
    try {
      const media = await loadSocialPublishingMedia(job.media_storage_key);
      if (job.media_sha256 && media.sha256 !== job.media_sha256) return { ...job, previewUrl: null, previewError: "asset_changed" };
      return { ...job, previewUrl: await createSocialPublishingPreviewUrl(job.media_storage_key) };
    } catch {
      return { ...job, previewUrl: null, previewError: "preview_unavailable" };
    }
  }));
  return NextResponse.json({ jobs, mediaPreviewConfigured: Boolean(bucket) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin requests are required." }, { status: 403 });
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const channelId = typeof payload?.channelId === "string" ? payload.channelId : "";
  const idempotencyKey = typeof payload?.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";
  const contentKind = payload?.contentKind;
  const caption = typeof payload?.caption === "string" ? payload.caption : "";
  const youtubePrivacyStatus = payload?.youtubePrivacyStatus === "public" || payload?.youtubePrivacyStatus === "unlisted" || payload?.youtubePrivacyStatus === "private" ? payload.youtubePrivacyStatus : null;
  let mediaStorageKey = typeof payload?.mediaStorageKey === "string" ? payload.mediaStorageKey.trim() : null;
  const sourceWorkId = typeof payload?.sourceWorkId === "number" && Number.isSafeInteger(payload.sourceWorkId) ? payload.sourceWorkId : null;
  const sourceCatalogContentId = typeof payload?.sourceCatalogContentId === "string" ? payload.sourceCatalogContentId.trim() : null;
  const trimStartSeconds = typeof payload?.trimStartSeconds === "number" ? payload.trimStartSeconds : null;
  const trimEndSeconds = typeof payload?.trimEndSeconds === "number" ? payload.trimEndSeconds : null;
  const sampleCandidateRequest = sourceWorkId !== null || sourceCatalogContentId !== null || trimStartSeconds !== null || trimEndSeconds !== null;
  const scheduledAt = typeof payload?.scheduledAt === "string" ? new Date(payload.scheduledAt) : null;
  if (!channelId || !/^[a-zA-Z0-9:_-]{8,160}$/.test(idempotencyKey) || !["video", "image", "text"].includes(String(contentKind)) || caption.length > 5000 || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid scheduled post fields." }, { status: 400 });
  }
  if (contentKind === "text" ? mediaStorageKey !== null : (!sampleCandidateRequest && (!mediaStorageKey || mediaStorageKey.startsWith("http") || mediaStorageKey.includes("..")))) {
    return NextResponse.json({ error: "Media must be a private storage key, not a public URL." }, { status: 400 });
  }
  if (sourceCatalogContentId !== null && !/^[a-zA-Z0-9_-]{3,120}$/.test(sourceCatalogContentId)) {
    return NextResponse.json({ error: "APIカタログの作品IDが不正です。候補を検索し直してください。" }, { status: 400 });
  }
  if (sourceWorkId !== null && sourceCatalogContentId !== null) {
    return NextResponse.json({ error: "作品候補の種類が重複しています。候補を選び直してください。" }, { status: 400 });
  }
  if (sampleCandidateRequest && (sourceWorkId === null && sourceCatalogContentId === null || trimStartSeconds === null || trimEndSeconds === null || trimStartSeconds < 0 || trimEndSeconds <= trimStartSeconds || trimEndSeconds - trimStartSeconds > 60)) {
    return NextResponse.json({ error: "公式サンプルの切り抜き範囲は0〜60秒以内で指定してください。" }, { status: 400 });
  }
  const normalizedTrimStart = trimStartSeconds === null ? null : Math.round(trimStartSeconds * 10) / 10;
  const normalizedTrimEnd = trimEndSeconds === null ? null : Math.round(trimEndSeconds * 10) / 10;
  if (sampleCandidateRequest && (normalizedTrimStart === null || normalizedTrimEnd === null || normalizedTrimEnd <= normalizedTrimStart || normalizedTrimEnd - normalizedTrimStart > 60)) {
    return NextResponse.json({ error: "切り抜き範囲は0.1秒単位で開始から60秒以内にしてください。" }, { status: 400 });
  }
  if (scheduledAt.getTime() < Date.now() + 60_000) {
    return NextResponse.json({ error: "Schedule must be at least one minute in the future." }, { status: 400 });
  }
  const { data: channel, error: channelError } = await supabaseAdmin
    .from("social_publishing_channels")
    .select("id, platform, enabled")
    .eq("id", channelId)
    .maybeSingle();
  if (channelError) return NextResponse.json({ error: "Publishing channel storage is unavailable." }, { status: 503 });
  if (channel && !["youtube_shorts", "instagram_reels", "threads"].includes(channel.platform)) {
    return NextResponse.json({ error: "この投稿先は運用対象外です。" }, { status: 410 });
  }
  if (!channel?.enabled) return NextResponse.json({ error: "This channel is not authorized for automatic publishing." }, { status: 409 });
  if (channel.platform === "youtube_shorts" && !youtubePrivacyStatus) return NextResponse.json({ error: "YouTubeの公開範囲を明示的に選択してください。" }, { status: 400 });
  if (channel.platform !== "youtube_shorts" && payload?.youtubePrivacyStatus != null) return NextResponse.json({ error: "YouTube公開範囲はYouTube投稿だけに指定できます。" }, { status: 400 });
  if (channel.platform === "youtube_shorts") {
    const title = caption.split(/\r?\n/, 1)[0].trim();
    if (!title || [...title].length > 100 || Buffer.byteLength(caption, "utf8") > 5000) {
      return NextResponse.json({ error: "YouTubeのタイトルは100文字以内、説明欄はUTF-8で5,000バイト以内にしてください。" }, { status: 400 });
    }
  }
  if (contentKind !== "video") return NextResponse.json({ error: "This first automatic-publishing release accepts reviewed video posts only." }, { status: 400 });
  let sourceSampleUrl: string | null = null;
  let sourceMaker: string | null = null;
  if (sampleCandidateRequest) {
    let previousUseQuery = supabaseAdmin.from("social_publishing_jobs").select("id").eq("channel_id", channelId);
    previousUseQuery = sourceCatalogContentId !== null
      ? previousUseQuery.eq("source_catalog_content_id", sourceCatalogContentId)
      : previousUseQuery.eq("source_work_id", sourceWorkId as number);
    const { data: previousUse, error: previousUseError } = await previousUseQuery.limit(1).maybeSingle();
    if (previousUseError) return NextResponse.json({ error: isMissingCatalogSourceColumn(previousUseError) ? "投稿キューのカタログ作品対応migrationが未適用です。" : "この投稿先の過去利用を確認できません。" }, { status: 503 });
    if (previousUse) return NextResponse.json({ error: "この作品は同じ投稿先で既に使用されています。別の候補を選んでください。" }, { status: 409 });
    let sampleMovieUrl: unknown = null;
    if (sourceCatalogContentId !== null) {
      const { data: catalogWork, error: catalogWorkError } = await supabaseAdmin
        .from("fanza_amateur_works")
        .select("content_id, api_url, mp4_url, iteminfo")
        .eq("content_id", sourceCatalogContentId)
        .eq("mp4_status", "found")
        .maybeSingle();
      if (catalogWorkError) return NextResponse.json({ error: "APIカタログ作品のサンプル情報を取得できませんでした。" }, { status: 503 });
      if (!catalogWork) return NextResponse.json({ error: "選択したAPIカタログ作品が見つかりません。検索し直してください。" }, { status: 404 });
      const productPageUrl = typeof catalogWork.api_url === "string" ? catalogWork.api_url : null;
      if (productPageUrl) {
        let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;
        let refreshedSampleMovieUrl: string | null = null;
        try {
          browser = await createBrowser();
          const refreshed = await captureFanzaSampleMovieUrl(productPageUrl, browser, {
            navigationTimeoutMs: 15_000,
            playerTimeoutMs: 3_000,
            mediaWaitTimeoutMs: 4_000,
          });
          if (refreshed && isOfficialFanzaDmmSampleUrl(refreshed)) refreshedSampleMovieUrl = refreshed;
        } catch {
          console.warn("[social-publishing] official product-page sample refresh failed", {
            contentId: sourceCatalogContentId,
            stage: "official_product_page_capture",
          });
        } finally {
          if (browser) await closeBrowser(browser);
        }
        if (!refreshedSampleMovieUrl) {
          return NextResponse.json({ error: "公式商品ページから新しいサンプルURLを取得できませんでした。候補を再検索してからお試しください。" }, { status: 422 });
        }
        sampleMovieUrl = refreshedSampleMovieUrl;
      } else {
        sampleMovieUrl = catalogWork.mp4_url;
      }
      sourceMaker = makerFromItemInfo(catalogWork.iteminfo);
    } else {
      const { data: work, error: workError } = await supabaseAdmin
        .from("works")
        .select("id, sample_movie_url, maker")
        .eq("id", sourceWorkId as number)
        .maybeSingle();
      if (workError) return NextResponse.json({ error: "作品サンプル情報を取得できませんでした。" }, { status: 503 });
      sampleMovieUrl = work?.sample_movie_url;
      sourceMaker = typeof work?.maker === "string" ? work.maker.trim() : null;
    }
    if (typeof sampleMovieUrl !== "string" || !isOfficialFanzaDmmSampleUrl(sampleMovieUrl)) {
      return NextResponse.json({ error: "HTTPSの公式FANZA/DMMサンプル動画が見つかりません。" }, { status: 400 });
    }
    if (typeof sourceMaker !== "string" || !sourceMaker.trim()) {
      return NextResponse.json({ error: "メーカー名を確認できないため、利用条件を確認できる候補ではありません。" }, { status: 409 });
    }
    sourceMaker = sourceMaker.trim();
    sourceSampleUrl = sampleMovieUrl;
    const sampleStart = normalizedTrimStart as number;
    const sampleEnd = normalizedTrimEnd as number;
    let bucket: string;
    try {
      bucket = await assertPrivateSocialPublishingBucket();
    } catch {
      return NextResponse.json({ error: "非公開メディア保存先が未設定、または非公開であることを確認できません。" }, { status: 503 });
    }
    let trimmed: Awaited<ReturnType<typeof trimVideoForX>>;
    let bytes: Buffer;
    try {
      trimmed = await trimVideoForX({ sourceUrl: sampleMovieUrl, trimStartSeconds: sampleStart, trimEndSeconds: sampleEnd }, {
        maxBytes: socialPublishingMediaMaxBytes(), timeoutMs: 25_000, followOfficialRedirects: true,
      });
      if (channel.platform === "youtube_shorts" && (trimmed.width == null || trimmed.height == null || trimmed.width > trimmed.height)) {
        await readAndCleanupTrimmedVideo(trimmed);
        return NextResponse.json({ error: "YouTube Shorts用は縦長または正方形の動画にしてください。横長サンプルはこの投稿先へ登録できません。" }, { status: 422 });
      }
      bytes = await readAndCleanupTrimmedVideo(trimmed);
    } catch (cause) {
      const diagnostic = cause instanceof TrimVideoDiagnosticError
        ? { stage: cause.stage, httpStatus: cause.httpStatus, redirectCount: cause.redirectCount }
        : { stage: "trim_pipeline", httpStatus: null, redirectCount: null };
      console.error("[social-publishing] sample trim failed", diagnostic);
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "公式サンプルを切り抜けませんでした。" }, { status: 422 });
    }
    if (bytes.length > socialPublishingMediaMaxBytes()) return NextResponse.json({ error: "切り抜き後動画が容量上限を超えています。" }, { status: 413 });
    mediaStorageKey = `trimmed/${randomUUID()}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(mediaStorageKey, bytes, {
      contentType: "video/mp4", upsert: false, cacheControl: "0",
    });
    if (uploadError) return NextResponse.json({ error: "切り抜き動画を非公開領域へ保存できませんでした。" }, { status: 503 });
  }
  let media: Awaited<ReturnType<typeof loadSocialPublishingMedia>>;
  try {
    media = await loadSocialPublishingMedia(mediaStorageKey!);
  } catch (cause) {
    if (sampleCandidateRequest && mediaStorageKey) await supabaseAdmin.storage.from(process.env.SOCIAL_PUBLISHING_MEDIA_BUCKET!.trim()).remove([mediaStorageKey]);
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not verify the video asset." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("social_publishing_jobs").insert({
    channel_id: channelId,
    idempotency_key: idempotencyKey,
    content_kind: contentKind,
    caption,
    youtube_privacy_status: youtubePrivacyStatus,
    media_storage_key: mediaStorageKey,
    media_sha256: media.sha256,
    source_work_id: sourceWorkId,
    source_catalog_content_id: sourceCatalogContentId,
    source_sample_url_hash: sourceSampleUrl ? createHash("sha256").update(sourceSampleUrl).digest("hex") : null,
    source_sample_host: sourceSampleUrl ? sourceDomain(sourceSampleUrl) : null,
    source_maker: sampleCandidateRequest ? sourceMaker : null,
    source_usage_attested: false,
    source_usage_checked_at: null,
    trim_start_seconds: sourceSampleUrl ? normalizedTrimStart : null,
    trim_end_seconds: sourceSampleUrl ? normalizedTrimEnd : null,
    scheduled_at: scheduledAt.toISOString(),
    status: "awaiting_user_review",
    content_revision: 1,
    review_status: "pending",
  }).select("id, idempotency_key, scheduled_at, status, content_revision, review_status").single();
  if (error) {
    if (sampleCandidateRequest && mediaStorageKey) await supabaseAdmin.storage.from(process.env.SOCIAL_PUBLISHING_MEDIA_BUCKET!.trim()).remove([mediaStorageKey]);
    return NextResponse.json({ error: isMissingCatalogSourceColumn(error) ? "投稿キューのカタログ作品対応migrationが未適用です。" : error.code === "23505" ? (sampleCandidateRequest ? "この作品は同じ投稿先で既に使用されています。別の候補を選んでください。" : "Duplicate idempotency key.") : "Could not save post for review." }, { status: error.code === "23505" ? 409 : 503 });
  }
  return NextResponse.json({ job: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
