import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { scoreMyfansQuoteCandidate, type MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(cleanText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function cleanAffiliateUrl(value: unknown) {
  const url = cleanText(value);
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/.test(url) ? url : "";
}

function cleanXStatusUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

function cleanXMediaPermalink(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)\/(photo|video)\/([1-9]\d*)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}/${match[3]}/${match[4]}` : "";
}

function cleanValidationStatus(value: unknown) {
  return cleanText(value).replace(/[^a-z0-9_:-]/gi, "").slice(0, 80);
}

const RESERVED_X_HANDLES = new Set(["home", "explore", "search", "intent", "share", "i", "notifications", "messages", "settings", "login", "signup"]);

function cleanXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/?$/);
  if (!match) return "";
  const handle = match[1];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || RESERVED_X_HANDLES.has(handle.toLowerCase())) return "";
  return `https://x.com/${handle}`;
}

type VisibleCreator = {
  displayName?: unknown;
  myfansUrl?: unknown;
  creatorXUrl?: unknown;
  sourceXHandle?: unknown;
  followerCount?: unknown;
  postsCount?: unknown;
  singleRewardRate?: unknown;
  planSignupRewardRate?: unknown;
  xUrlSource?: unknown;
  genre?: unknown;
};

type VisibleProduct = {
  productTitle?: unknown;
  productUrl?: unknown;
  affiliateUrl?: unknown;
  price?: unknown;
  rewardRate?: unknown;
  likesCount?: unknown;
  publishedAt?: unknown;
};

type QuoteScanPayload = {
  type?: unknown;
  productId?: unknown;
  creatorId?: unknown;
  creatorXUrl?: unknown;
  sourceXHandle?: unknown;
  refreshJobId?: unknown;
  refreshJobItemId?: unknown;
  failureReason?: unknown;
  quoteCandidates?: MyfansQuoteScanCandidate[];
};

function xHandleFromUrl(value: string) {
  const match = cleanXProfileUrl(value).match(/^https:\/\/x\.com\/([^/?#]+)/);
  return match?.[1] ? `@${match[1]}` : "";
}

async function updateRefreshProgress(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status")
    .eq("job_id", jobId);
  if (error) throw error;
  const processed = (items ?? []).filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const success = (items ?? []).filter((item) => item.status === "success").length;
  const failed = (items ?? []).filter((item) => item.status === "failed").length;
  const hasRemaining = (items ?? []).some((item) => ["pending", "running"].includes(item.status));
  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      status: hasRemaining ? "running" : "completed",
      processed_creators: processed,
      success_creators: success,
      failed_creators: failed,
      completed_at: hasRemaining ? null : new Date().toISOString(),
    })
    .eq("id", jobId);
  if (updateError) throw updateError;
}

const NON_RETRYABLE_QUOTE_REFRESH_ERRORS = new Set(["LOGIN_OR_CHALLENGE", "PROFILE_NOT_FOUND/SUSPENDED", "SENSITIVE_CONTENT_GATE"]);

function quoteRefreshErrorCode(error: string | undefined) {
  return cleanText(error).match(/^([A-Z_/]+):\s*/)?.[1] || "";
}

async function markRefreshItem(payload: QuoteScanPayload, status: "success" | "failed", detail: { collectedCount?: number; topScore?: number | null; error?: string }) {
  const jobId = Number(payload.refreshJobId);
  const itemId = Number(payload.refreshJobItemId);
  if (!Number.isFinite(jobId) || jobId <= 0 || !Number.isFinite(itemId) || itemId <= 0) return;
  const finalStatus =
    status === "failed" && NON_RETRYABLE_QUOTE_REFRESH_ERRORS.has(quoteRefreshErrorCode(detail.error))
      ? "skipped"
      : status;
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({
      status: finalStatus,
      collected_count: detail.collectedCount ?? 0,
      top_score: detail.topScore ?? null,
      error: detail.error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("job_id", jobId);
  if (error) throw error;
  await updateRefreshProgress(jobId);
}

async function updateGlobalQuoteRanks(approvedMediaId: number | null) {
  let query = supabaseAdmin
    .from("myfans_quote_candidates")
    .select("id,creator_id,creator_x_url,score,creator_rank,collected_at,cooldown_until,last_used_at,use_count,is_repost,x_post_url,media_type,media_permalink,quote_visual_ready,media_permalink_validation_status,visual_score")
    .lte("creator_rank", 3)
    .gte("score", 55)
    .order("score", { ascending: false })
    .limit(500);
  if (approvedMediaId) query = query.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;

  const now = new Date().toISOString();
  const rows = (data ?? [])
    .filter((row) => !row.is_repost && !row.last_used_at && (!row.cooldown_until || row.cooldown_until <= now))
    .map((row) => {
      const ageDays = row.collected_at ? Math.max(0, (Date.now() - new Date(row.collected_at).getTime()) / 86_400_000) : 7;
      const visualBoost = row.quote_visual_ready && row.media_permalink
        ? row.media_type === "video" ? 18 : row.media_type === "image" ? 12 : 0
        : row.visual_score ? -12 : 0;
      const renderStatus = row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink")
        ? "browser_visible"
        : /not_rendered/i.test(row.media_permalink_validation_status ?? "")
          ? "app_only"
          : "blocked";
      const visualStatusPenalty = renderStatus === "browser_visible" ? 0 : renderStatus === "app_only" ? 30 : 45;
      const globalScore = Math.round(Math.max(0, Math.min(120, row.score + visualBoost + Math.max(0, 10 - ageDays) - ((row.creator_rank ?? 3) - 1) * 4 - (row.use_count ?? 0) * 12)));
      return { ...row, globalScore: Math.max(0, globalScore - visualStatusPenalty) };
    })
    .sort((a, b) => b.globalScore - a.globalScore || b.score - a.score);

  await supabaseAdmin
    .from("myfans_quote_candidates")
    .update({ global_rank: null, selected_for_today: false })
    .or(approvedMediaId ? `approved_media_id.eq.${approvedMediaId},approved_media_id.is.null` : "approved_media_id.is.null,approved_media_id.not.is.null");

  const selectedCreators = new Set<string>();
  let selectedCount = 0;
  for (const [index, row] of rows.entries()) {
    const key = row.creator_id ? `creator:${row.creator_id}` : `x:${String(row.creator_x_url).toLowerCase()}`;
    const isVisualReady = Boolean(row.quote_visual_ready && row.media_permalink && (row.media_type === "image" || row.media_permalink_validation_status === "verified_video_permalink"));
    const selectedForToday = isVisualReady && !selectedCreators.has(key) && (selectedCount === 0 || row.globalScore >= 78) && selectedCount < 2;
    if (selectedForToday) {
      selectedCreators.add(key);
      selectedCount += 1;
    }
    const { error: updateError } = await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({ global_score: row.globalScore, global_rank: index + 1, selected_for_today: selectedForToday })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
}

async function saveQuoteCandidate(record: Record<string, unknown>, productId: number | null, creatorId: number) {
  const postUrl = cleanXStatusUrl(record.x_post_url);
  const query = productId
    ? supabaseAdmin.from("myfans_quote_candidates").select("id").eq("product_id", productId).eq("x_post_url", postUrl).maybeSingle()
    : supabaseAdmin.from("myfans_quote_candidates").select("id").eq("creator_id", creatorId).eq("x_post_url", postUrl).maybeSingle();
  const { data: existing, error: findError } = await query;
  if (findError) throw findError;
  if (existing?.id) {
    const { error } = await supabaseAdmin.from("myfans_quote_candidates").update(record).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabaseAdmin.from("myfans_quote_candidates").insert(record);
  if (error) throw error;
}

async function saveCompanionImport(record: Record<string, unknown>, payloadHash: string) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("myfans_companion_imports")
    .select("id")
    .eq("payload_hash", payloadHash)
    .maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("myfans_companion_imports").update(record).eq("id", existing.id);
    if (error) throw error;
    return existing.id as number;
  }

  const { data, error } = await supabaseAdmin.from("myfans_companion_imports").insert(record).select("id").single();
  if (error) throw error;
  return data.id as number;
}

async function saveCreator(record: { display_name: string; myfans_url: string; creator_x_url?: string; source_x_handle?: string; latest_quote_x_url?: string; genre?: string; activity_note?: string; x_url_source?: string }) {
  const creatorXUrl = cleanXProfileUrl(record.creator_x_url);
  const sourceXHandle = creatorXUrl ? xHandleFromUrl(creatorXUrl) : "";
  const normalized = { ...record, creator_x_url: creatorXUrl, source_x_handle: sourceXHandle };
  if (record.myfans_url) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("myfans_creators")
      .select("id,creator_x_url,source_x_handle")
      .eq("myfans_url", record.myfans_url)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const existingXUrl = cleanXProfileUrl(existing.creator_x_url);
      if (creatorXUrl && existingXUrl && creatorXUrl.toLowerCase() !== existingXUrl.toLowerCase()) {
        const conflict = { existingXUrl, incomingXUrl: creatorXUrl, source: record.x_url_source || "chrome_companion", detectedAt: new Date().toISOString() };
        await supabaseAdmin.from("myfans_audit_logs").insert({
          entity_type: "creator",
          entity_id: existing.id,
          action: "creator_x_url_conflict",
          summary: record.display_name,
          metadata: conflict,
        });
        const { data, error } = await supabaseAdmin
          .from("myfans_creators")
          .update({ display_name: record.display_name, genre: record.genre ?? "", activity_note: `${record.activity_note ?? ""} X URL不一致のため既存URLを維持。`, x_url_conflict: conflict, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as number;
      }
      const updateRecord = Object.fromEntries(Object.entries({
        ...normalized,
        creator_x_url: existingXUrl || creatorXUrl || undefined,
        source_x_handle: existing.source_x_handle || sourceXHandle || undefined,
        x_url_source: existingXUrl ? undefined : normalized.x_url_source,
        updated_at: new Date().toISOString(),
      }).filter(([, value]) => value !== undefined));
      const { data, error } = await supabaseAdmin
        .from("myfans_creators")
        .update(updateRecord)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      if (!existingXUrl && creatorXUrl) {
        await supabaseAdmin
          .from("myfans_products")
          .update({ creator_x_url: creatorXUrl, updated_at: new Date().toISOString() })
          .eq("creator_id", existing.id)
          .or("creator_x_url.is.null,creator_x_url.eq.");
      }
      return data.id as number;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("myfans_creators")
    .insert({ ...normalized, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

async function saveProduct(record: Record<string, unknown>, productUrl: string) {
  if (productUrl) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("myfans_products")
      .select("id")
      .eq("product_url", productUrl)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("myfans_products")
        .update(record)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as number;
    }
  }

  const { data, error } = await supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  if (error) throw error;
  return data.id as number;
}

async function saveQuoteScan(payload: QuoteScanPayload, approvedMediaId: number | null) {
  const parsedProductId = Number(payload.productId);
  const parsedCreatorId = Number(payload.creatorId);
  const productId = Number.isFinite(parsedProductId) && parsedProductId > 0 ? parsedProductId : null;
  const creatorId = Number.isFinite(parsedCreatorId) && parsedCreatorId > 0 ? parsedCreatorId : null;
  const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
  const sourceXHandle = cleanText(payload.sourceXHandle).replace(/^@/, "");
  const failureReason = cleanText(payload.failureReason);
  const candidates = Array.isArray(payload.quoteCandidates) ? payload.quoteCandidates.slice(0, 20) : [];
  if (!creatorXUrl || !sourceXHandle || candidates.length === 0) {
    const message = failureReason || "Xプロフィール上の投稿候補を取得できませんでした。";
    await markRefreshItem(payload, "failed", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const productQuery = productId
    ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("id", productId).maybeSingle()
    : creatorId
      ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("creator_id", creatorId).order("selection_score", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null });
  const { data: product, error: productError } = await productQuery;
  if (productError) throw productError;

  const resolvedCreatorId = creatorId ?? product?.creator_id;
  if (!resolvedCreatorId) {
    await markRefreshItem(payload, "failed", { error: "Daily Pageの対象creatorを取得できませんでした。" });
    return NextResponse.json({ error: "Daily Pageの対象creatorを取得できませんでした。" }, { status: 400 });
  }

  const normalized = candidates
    .map((candidate) => {
      const mediaType = cleanText(candidate.mediaType);
      return {
        ...candidate,
        xPostUrl: cleanXStatusUrl(candidate.xPostUrl),
        mediaPermalink: cleanXMediaPermalink(candidate.mediaPermalink),
        verifiedVideoPermalink: cleanXMediaPermalink(candidate.verifiedVideoPermalink),
        generatedVideoPermalink: cleanXMediaPermalink(candidate.generatedVideoPermalink),
        validationStatus: cleanValidationStatus(candidate.validationStatus),
        mediaType: (mediaType === "image" || mediaType === "video" ? mediaType : "none") as "image" | "video" | "none",
        mediaCount: Math.max(0, Math.round(Number(candidate.mediaCount ?? 0) || 0)),
        sourceXHandle: cleanText(candidate.sourceXHandle).replace(/^@/, ""),
        text: cleanText(candidate.text).slice(0, 180),
      };
    })
    .filter((candidate) => candidate.xPostUrl && candidate.sourceXHandle.toLowerCase() === sourceXHandle.toLowerCase());

  if (normalized.length === 0) {
    await markRefreshItem(payload, "failed", { error: "creator本人の表示中投稿が見つかりませんでした。" });
    return NextResponse.json({ error: "creator本人の表示中投稿が見つかりませんでした。" }, { status: 400 });
  }

  const scored = normalized
    .map((candidate) => ({ candidate, result: scoreMyfansQuoteCandidate(candidate) }))
    .sort((a, b) => b.result.score - a.result.score);
  const ranked = scored.map((item, index) => ({ ...item, creatorRank: index + 1 }));
  const top = ranked.filter((item) => item.result.eligible && item.creatorRank <= 3);
  const best = top[0] ?? null;

  if (best && product?.id) {
    const { error } = await supabaseAdmin.from("myfans_quote_candidates").update({ selected: false }).eq("creator_id", resolvedCreatorId);
    if (error) throw error;
  }

  for (const item of ranked) {
    const isVerifiedVideo = item.candidate.mediaType === "video" && item.candidate.validationStatus === "verified_video_permalink" && item.candidate.verifiedVideoPermalink === item.candidate.mediaPermalink;
    const isVerifiedImage = item.candidate.mediaType === "image" && Boolean(item.candidate.mediaPermalink && item.candidate.quoteVisualReady);
    const quoteVisualReady = Boolean(item.candidate.mediaPermalink && (isVerifiedVideo || isVerifiedImage));
    const record = {
      approved_media_id: approvedMediaId ?? product?.approved_media_id ?? null,
      creator_id: resolvedCreatorId,
      product_id: product?.id ?? null,
      creator_x_url: creatorXUrl,
      source_x_handle: sourceXHandle,
      x_post_url: item.candidate.xPostUrl,
      media_permalink: item.candidate.mediaPermalink || null,
      media_type: item.candidate.mediaType || "none",
      media_count: item.candidate.mediaCount ?? 0,
      quote_visual_ready: quoteVisualReady,
      media_permalink_verified_at: quoteVisualReady ? new Date().toISOString() : null,
      media_permalink_validation_status: item.candidate.validationStatus || null,
      visual_score: quoteVisualReady
        ? item.candidate.mediaType === "video" ? 100 : item.candidate.mediaType === "image" ? 85 : 0
        : item.candidate.hasVideo || item.candidate.hasImage ? 25 : 0,
      posted_at: item.candidate.postedAt || null,
      text_excerpt: item.candidate.text || "",
      views: item.candidate.views ?? null,
      likes: item.candidate.likes ?? null,
      reposts: item.candidate.reposts ?? null,
      replies: item.candidate.replies ?? null,
      bookmarks: item.candidate.bookmarks ?? null,
      has_image: Boolean(item.candidate.hasImage),
      has_video: Boolean(item.candidate.hasVideo),
      is_pinned: Boolean(item.candidate.isPinned),
      is_reply: Boolean(item.candidate.isReply),
      is_repost: Boolean(item.candidate.isRepost),
      is_quote: Boolean(item.candidate.isQuote),
      score: item.result.score,
      score_reason: item.result.reason,
      selected: best?.candidate.xPostUrl === item.candidate.xPostUrl,
      creator_rank: item.creatorRank <= 3 && item.result.eligible ? item.creatorRank : null,
      global_score: item.result.score,
      collected_at: new Date().toISOString(),
    };
    await saveQuoteCandidate(record, product?.id ?? null, resolvedCreatorId);
  }

  if (best && product?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("myfans_products")
      .update({ quote_candidate_x_url: best.candidate.mediaPermalink || best.candidate.xPostUrl, updated_at: new Date().toISOString() })
      .eq("creator_id", resolvedCreatorId);
    if (updateError) throw updateError;
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "creator",
      entity_id: resolvedCreatorId,
      action: "quote_candidate_auto_select",
      summary: product.title,
      metadata: { quoteUrl: best.candidate.mediaPermalink || best.candidate.xPostUrl, statusUrl: best.candidate.xPostUrl, mediaPermalink: best.candidate.mediaPermalink || null, mediaType: best.candidate.mediaType || "none", quoteVisualReady: Boolean(best.candidate.quoteVisualReady), validationStatus: best.candidate.validationStatus || null, score: best.result.score, creatorRank: best.creatorRank, reason: best.result.reason },
    });
  }

  await updateGlobalQuoteRanks(approvedMediaId ?? product?.approved_media_id ?? null);
  await markRefreshItem(payload, "success", { collectedCount: scored.length, topScore: best?.result.score ?? null });

  return NextResponse.json({
    ok: true,
    importedType: "quote_candidates",
    candidatesCount: scored.length,
    selected: best ? { xPostUrl: best.candidate.xPostUrl, mediaPermalink: best.candidate.mediaPermalink || null, mediaType: best.candidate.mediaType || "none", quoteVisualReady: Boolean(best.candidate.quoteVisualReady), validationStatus: best.candidate.validationStatus || null, score: best.result.score, creatorRank: best.creatorRank, reason: best.result.reason } : null,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const approvedMediaName = cleanText(payload.approvedMediaName) || "@lumi_reviw";
    let approvedMediaId = Number.isFinite(Number(payload.approvedMediaId)) ? Number(payload.approvedMediaId) : null;
    if (!approvedMediaId) {
      const { data: media } = await supabaseAdmin
        .from("myfans_approved_media")
        .select("id")
        .eq("media_name", approvedMediaName)
        .maybeSingle();
      approvedMediaId = media?.id ?? null;
    }
    if (payload.type === "x_quote_scan") return await saveQuoteScan(payload, approvedMediaId);

    const creatorName = cleanText(payload.creatorName);
    const productTitle = cleanText(payload.productTitle || payload.title);
    const productUrl = cleanText(payload.productUrl || payload.pageUrl);
    const affiliateUrl = cleanAffiliateUrl(payload.affiliateUrl);
    const price = Math.round(numberValue(payload.price));
    const rewardRate = cleanText(payload.rewardRate).includes("売上の全額") ? 100 : numberValue(payload.rewardRate);
    const planSignupReward = Math.round(numberValue(payload.planSignupReward));
    const recurringRewardRate = numberValue(payload.recurringRewardRate);
    const likesCount = Math.round(numberValue(payload.likesCount));

    const visibleCreators = Array.isArray(payload.creators) ? (payload.creators as VisibleCreator[]) : [];
    if (!productTitle && !productUrl && visibleCreators.length === 0) {
      return NextResponse.json({ error: "商品名、URL、クリエイター一覧のいずれも取得できませんでした。" }, { status: 400 });
    }
    const payloadHash = createHash("sha256").update([approvedMediaId ?? approvedMediaName, productUrl, affiliateUrl, productTitle].join("|")).digest("hex");

    await saveCompanionImport({
      page_url: cleanText(payload.pageUrl),
      creator_name: creatorName,
      product_title: productTitle,
      product_url: productUrl,
      affiliate_url: affiliateUrl,
      price,
      reward_rate: rewardRate,
      plan_signup_reward: planSignupReward,
      recurring_reward_rate: recurringRewardRate,
      likes_count: likesCount,
      published_at: cleanText(payload.publishedAt),
      raw_payload: payload,
      approved_media_id: approvedMediaId,
      import_source: "chrome_companion",
      payload_hash: payloadHash,
    }, payloadHash);

    if (visibleCreators.length > 0 && !productUrl.includes("/posts/")) {
      let savedCreators = 0;
      let xUrlCount = 0;
      for (const creator of visibleCreators) {
        const displayName = cleanText(creator.displayName);
        if (!displayName) continue;
        const creatorXUrl = cleanXProfileUrl(creator.creatorXUrl);
        await saveCreator({
          display_name: displayName,
          myfans_url: cleanText(creator.myfansUrl),
          creator_x_url: creatorXUrl,
          source_x_handle: xHandleFromUrl(creatorXUrl),
          genre: cleanText(creator.genre),
          x_url_source: cleanText(creator.xUrlSource) || "creator_list_href",
          activity_note: [
            "Chrome Companionでmyfansクリエイター一覧から登録。",
            `フォロワー:${cleanText(creator.followerCount) || "不明"}`,
            `投稿:${cleanText(creator.postsCount) || "不明"}`,
            `単品:${cleanText(creator.singleRewardRate) || "不明"}%`,
            `プラン:${cleanText(creator.planSignupRewardRate) || "不明"}%`,
          ].join(" "),
        });
        if (creatorXUrl) xUrlCount += 1;
        savedCreators += 1;
      }
      return NextResponse.json({ ok: true, importedType: "creators", creatorsCount: savedCreators, xUrlCount, approvedMediaId });
    }

    let creatorId: number | null = null;
    if (creatorName) {
      const creatorUrl = cleanText(payload.creatorUrl);
      const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
      creatorId = await saveCreator({
        display_name: creatorName,
        myfans_url: creatorUrl,
        creator_x_url: creatorXUrl,
        source_x_handle: xHandleFromUrl(creatorXUrl),
        latest_quote_x_url: cleanXStatusUrl(payload.quoteCandidateXUrl),
        x_url_source: "creator_detail_href",
      });
    }

    const visibleProducts = Array.isArray(payload.products) ? (payload.products as VisibleProduct[]) : [];
    if (visibleProducts.length > 1) {
      let savedProducts = 0;
      for (const visibleProduct of visibleProducts.slice(0, 50)) {
        const visibleProductUrl = cleanText(visibleProduct.productUrl);
        const visibleProductTitle = cleanText(visibleProduct.productTitle) || visibleProductUrl;
        if (!visibleProductUrl || !visibleProductTitle) continue;
        const visiblePrice = Math.round(numberValue(visibleProduct.price));
        const visibleRewardRate = cleanText(visibleProduct.rewardRate).includes("売上の全額")
          ? 100
          : numberValue(visibleProduct.rewardRate);
        const visibleAffiliateUrl = cleanAffiliateUrl(visibleProduct.affiliateUrl) || affiliateUrl;
        const visibleLikesCount = Math.round(numberValue(visibleProduct.likesCount));
        const visibleSelectionScore = calculateMyfansSelectionScore({
          price: visiblePrice,
          rewardRate: visibleRewardRate,
          planSignupReward,
          recurringRewardRate,
          popularityRank: null,
          likesCount: visibleLikesCount,
          savesCount: 0,
          isNew: Boolean(cleanText(visibleProduct.publishedAt)),
          hasAffiliateUrl: Boolean(visibleAffiliateUrl),
          hasApprovedMedia: true,
          source_x_url: cleanText(payload.sourceXUrl),
        });
        await saveProduct({
          creator_id: creatorId,
          approved_media_id: approvedMediaId,
          title: visibleProductTitle,
          product_url: visibleProductUrl,
          affiliate_url: visibleAffiliateUrl,
          ...(visibleAffiliateUrl ? {
            affiliate_url_generated_at: new Date().toISOString(),
            affiliate_url_expires_at: null,
            affiliate_url_source: "chrome_companion",
          } : {}),
          source_x_url: cleanText(payload.sourceXUrl),
          creator_x_url: cleanXProfileUrl(payload.creatorXUrl),
          quote_candidate_x_url: cleanText(payload.quoteCandidateXUrl) || cleanText(payload.sourceXUrl),
          media_permission_status: "unknown",
          genre: cleanText(payload.genre),
          product_type: "single",
          status: "candidate",
          price: visiblePrice,
          reward_rate: visibleRewardRate,
          estimated_reward: Math.round(visiblePrice * (visibleRewardRate / 100)),
          plan_signup_reward: planSignupReward,
          recurring_reward_rate: recurringRewardRate,
          likes_count: visibleLikesCount,
          is_new: Boolean(cleanText(visibleProduct.publishedAt)),
          approved_media_name: approvedMediaName,
          selection_reason: "Chrome Companionからページ内の商品候補を登録。正規アフィURLが画面にある場合のみ保存。",
          selection_score: visibleSelectionScore,
          launch_priority: myfansLaunchPriority(visibleSelectionScore),
          last_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, visibleProductUrl);
        savedProducts += 1;
      }
      return NextResponse.json({ ok: true, importedType: "products", productsCount: savedProducts, approvedMediaId });
    }

    const selectionScore = calculateMyfansSelectionScore({
      price,
      rewardRate,
      planSignupReward,
      recurringRewardRate,
      popularityRank: null,
      likesCount,
      savesCount: 0,
      isNew: Boolean(cleanText(payload.publishedAt)),
      hasAffiliateUrl: Boolean(affiliateUrl),
      hasApprovedMedia: true,
      source_x_url: cleanText(payload.sourceXUrl),
    });
    const record = {
      creator_id: creatorId,
      approved_media_id: approvedMediaId,
      title: productTitle || productUrl,
      product_url: productUrl,
      affiliate_url: affiliateUrl,
      ...(affiliateUrl ? {
        affiliate_url_generated_at: new Date().toISOString(),
        affiliate_url_expires_at: null,
        affiliate_url_source: "chrome_companion",
      } : {}),
      source_x_url: cleanText(payload.sourceXUrl),
      creator_x_url: cleanXProfileUrl(payload.creatorXUrl),
      quote_candidate_x_url: cleanText(payload.quoteCandidateXUrl) || cleanText(payload.sourceXUrl),
      media_permission_status: "unknown",
      genre: cleanText(payload.genre),
      product_type: "single",
      status: "candidate",
      price,
      reward_rate: rewardRate,
      estimated_reward: Math.round(price * (rewardRate / 100)),
      plan_signup_reward: planSignupReward,
      recurring_reward_rate: recurringRewardRate,
      likes_count: likesCount,
      is_new: Boolean(cleanText(payload.publishedAt)),
      approved_media_name: approvedMediaName,
      selection_reason: "Chrome Companionから登録。ユーザーが通常Chromeで閲覧中のmyfansページ情報を保存。",
      selection_score: selectionScore,
      launch_priority: myfansLaunchPriority(selectionScore),
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const productId = await saveProduct(record, productUrl);

    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: productId,
      action: "companion_import",
      summary: record.title,
      metadata: { selectionScore },
    });

    return NextResponse.json({ ok: true, importedType: "product", id: productId, selectionScore, approvedMediaId });
  } catch (error) {
    console.error("myfans companion import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Companion取込に失敗しました。" }, { status: 500 });
  }
}
