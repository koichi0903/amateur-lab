import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanAffiliateUrl, cleanText, cleanXProfileUrl, cleanXStatusUrl, numberValue } from "@/lib/myfansCompanionInput";
import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { saveCompanionImport, saveCreator, saveProduct, xHandleFromUrl } from "@/lib/myfansCompanionImportService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

type NormalizedCompanionImport = {
  creatorName: string;
  productTitle: string;
  productUrl: string;
  affiliateUrl: string;
  price: number;
  rewardRate: number;
  planSignupReward: number;
  recurringRewardRate: number;
  likesCount: number;
  visibleCreators: VisibleCreator[];
  visibleProducts: VisibleProduct[];
};

function normalizeCompanionImport(payload: Record<string, unknown>): NormalizedCompanionImport {
  return {
    creatorName: cleanText(payload.creatorName),
    productTitle: cleanText(payload.productTitle || payload.title),
    productUrl: cleanText(payload.productUrl || payload.pageUrl),
    affiliateUrl: cleanAffiliateUrl(payload.affiliateUrl),
    price: Math.round(numberValue(payload.price)),
    rewardRate: cleanText(payload.rewardRate).includes("売上の全額") ? 100 : numberValue(payload.rewardRate),
    planSignupReward: Math.round(numberValue(payload.planSignupReward)),
    recurringRewardRate: numberValue(payload.recurringRewardRate),
    likesCount: Math.round(numberValue(payload.likesCount)),
    visibleCreators: Array.isArray(payload.creators) ? payload.creators as VisibleCreator[] : [],
    visibleProducts: Array.isArray(payload.products) ? payload.products as VisibleProduct[] : [],
  };
}

function buildCompanionImportHash(approvedMediaId: number | null, approvedMediaName: string, fields: NormalizedCompanionImport) {
  return createHash("sha256")
    .update([approvedMediaId ?? approvedMediaName, fields.productUrl, fields.affiliateUrl, fields.productTitle].join("|"))
    .digest("hex");
}

async function saveVisibleCreatorList(creators: VisibleCreator[], approvedMediaId: number | null) {
  let savedCreators = 0;
  let xUrlCount = 0;
  for (const creator of creators) {
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

async function saveVisibleProductList(
  payload: Record<string, unknown>,
  fields: NormalizedCompanionImport,
  creatorId: number | null,
  approvedMediaId: number | null,
  approvedMediaName: string,
) {
  let savedProducts = 0;
  for (const visibleProduct of fields.visibleProducts.slice(0, 50)) {
    const visibleProductUrl = cleanText(visibleProduct.productUrl);
    const visibleProductTitle = cleanText(visibleProduct.productTitle) || visibleProductUrl;
    if (!visibleProductUrl || !visibleProductTitle) continue;
    const visiblePrice = Math.round(numberValue(visibleProduct.price));
    const visibleRewardRate = cleanText(visibleProduct.rewardRate).includes("売上の全額")
      ? 100
      : numberValue(visibleProduct.rewardRate);
    const visibleAffiliateUrl = cleanAffiliateUrl(visibleProduct.affiliateUrl) || fields.affiliateUrl;
    const visibleLikesCount = Math.round(numberValue(visibleProduct.likesCount));
    const visibleSelectionScore = calculateMyfansSelectionScore({
      price: visiblePrice,
      rewardRate: visibleRewardRate,
      planSignupReward: fields.planSignupReward,
      recurringRewardRate: fields.recurringRewardRate,
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
      plan_signup_reward: fields.planSignupReward,
      recurring_reward_rate: fields.recurringRewardRate,
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

function buildSingleProductSelectionScore(fields: NormalizedCompanionImport, payload: Record<string, unknown>) {
  return calculateMyfansSelectionScore({
    price: fields.price,
    rewardRate: fields.rewardRate,
    planSignupReward: fields.planSignupReward,
    recurringRewardRate: fields.recurringRewardRate,
    popularityRank: null,
    likesCount: fields.likesCount,
    savesCount: 0,
    isNew: Boolean(cleanText(payload.publishedAt)),
    hasAffiliateUrl: Boolean(fields.affiliateUrl),
    hasApprovedMedia: true,
    source_x_url: cleanText(payload.sourceXUrl),
  });
}

function buildSingleProductRecord(
  payload: Record<string, unknown>,
  fields: NormalizedCompanionImport,
  creatorId: number | null,
  approvedMediaId: number | null,
  approvedMediaName: string,
  selectionScore: number,
) {
  return {
    creator_id: creatorId,
    approved_media_id: approvedMediaId,
    title: fields.productTitle || fields.productUrl,
    product_url: fields.productUrl,
    affiliate_url: fields.affiliateUrl,
    ...(fields.affiliateUrl ? {
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
    price: fields.price,
    reward_rate: fields.rewardRate,
    estimated_reward: Math.round(fields.price * (fields.rewardRate / 100)),
    plan_signup_reward: fields.planSignupReward,
    recurring_reward_rate: fields.recurringRewardRate,
    likes_count: fields.likesCount,
    is_new: Boolean(cleanText(payload.publishedAt)),
    approved_media_name: approvedMediaName,
    selection_reason: "Chrome Companionから登録。ユーザーが通常Chromeで閲覧中のmyfansページ情報を保存。",
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function saveSingleProduct(payload: Record<string, unknown>, fields: NormalizedCompanionImport, creatorId: number | null, approvedMediaId: number | null, approvedMediaName: string) {
  const selectionScore = buildSingleProductSelectionScore(fields, payload);
  const record = buildSingleProductRecord(payload, fields, creatorId, approvedMediaId, approvedMediaName, selectionScore);
  const productId = await saveProduct(record, fields.productUrl);
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "import",
    entity_id: productId,
    action: "companion_import",
    summary: record.title,
    metadata: { selectionScore },
  });
  return NextResponse.json({ ok: true, importedType: "product", id: productId, selectionScore, approvedMediaId });
}

export async function saveStandardCompanionImport(payload: Record<string, unknown>, approvedMediaId: number | null, approvedMediaName: string) {
  const fields = normalizeCompanionImport(payload);
  if (!fields.productTitle && !fields.productUrl && fields.visibleCreators.length === 0) {
    return NextResponse.json({ error: "商品名、URL、クリエイター一覧のいずれも取得できませんでした。" }, { status: 400 });
  }

  const payloadHash = buildCompanionImportHash(approvedMediaId, approvedMediaName, fields);
  await saveCompanionImport({
    page_url: cleanText(payload.pageUrl),
    creator_name: fields.creatorName,
    product_title: fields.productTitle,
    product_url: fields.productUrl,
    affiliate_url: fields.affiliateUrl,
    price: fields.price,
    reward_rate: fields.rewardRate,
    plan_signup_reward: fields.planSignupReward,
    recurring_reward_rate: fields.recurringRewardRate,
    likes_count: fields.likesCount,
    published_at: cleanText(payload.publishedAt),
    raw_payload: payload,
    approved_media_id: approvedMediaId,
    import_source: "chrome_companion",
    payload_hash: payloadHash,
  }, payloadHash);

  if (fields.visibleCreators.length > 0 && !fields.productUrl.includes("/posts/")) {
    return saveVisibleCreatorList(fields.visibleCreators, approvedMediaId);
  }

  let creatorId: number | null = null;
  if (fields.creatorName) {
    const creatorUrl = cleanText(payload.creatorUrl);
    const creatorXUrl = cleanXProfileUrl(payload.creatorXUrl);
    creatorId = await saveCreator({
      display_name: fields.creatorName,
      myfans_url: creatorUrl,
      creator_x_url: creatorXUrl,
      source_x_handle: xHandleFromUrl(creatorXUrl),
      latest_quote_x_url: cleanXStatusUrl(payload.quoteCandidateXUrl),
      x_url_source: "creator_detail_href",
    });
  }

  if (fields.visibleProducts.length > 1) {
    return saveVisibleProductList(payload, fields, creatorId, approvedMediaId, approvedMediaName);
  }
  return saveSingleProduct(payload, fields, creatorId, approvedMediaId, approvedMediaName);
}
