import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { saveMyfansAffiliateTextImport } from "@/lib/myfansAffiliateTextImport";
import { parseMyfansReportCsv } from "@/lib/myfansCsv";
import { calculateMyfansSelectionScore, myfansLaunchPriority } from "@/lib/myfansScore";
import { MYFANS_AFFILIATE_URL_SOURCE_MANUAL, normalizeMyfansAffiliateUrl } from "@/lib/myfansAffiliateLink";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").normalize("NFKC").trim();
}

function intValue(formData: FormData, name: string) {
  const value = Number(text(formData, name).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function numberValue(formData: FormData, name: string) {
  const value = Number(text(formData, name).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function nullableId(formData: FormData, name: string) {
  const value = intValue(formData, name);
  return value > 0 ? value : null;
}

function rowKey(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

async function audit(entityType: string, entityId: number | null, action: string, summary: string, metadata = {}) {
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    metadata,
  });
}

async function saveCreator(formData: FormData) {
  const id = nullableId(formData, "id");
  const record = {
    display_name: text(formData, "display_name"),
    myfans_url: text(formData, "myfans_url"),
    x_url: text(formData, "x_url"),
    creator_x_url: text(formData, "creator_x_url") || text(formData, "x_url"),
    source_x_handle: text(formData, "source_x_handle"),
    latest_quote_x_url: text(formData, "latest_quote_x_url"),
    genre: text(formData, "genre"),
    activity_note: text(formData, "activity_note"),
    is_active: text(formData, "is_active") !== "false",
    updated_at: new Date().toISOString(),
  };
  if (!record.display_name) throw new Error("クリエイター名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_creators").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_creators").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("creator", data.id, id ? "update" : "create", record.display_name);
  return { id: data.id };
}

async function saveMedia(formData: FormData) {
  const id = nullableId(formData, "id");
  const record = {
    media_name: text(formData, "media_name"),
    media_url: text(formData, "media_url"),
    affiliate_media_id: text(formData, "affiliate_media_id"),
    status: text(formData, "status") || "active",
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
  if (!record.media_name) throw new Error("メディア名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_approved_media").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_approved_media").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("media", data.id, id ? "update" : "create", record.media_name);
  return { id: data.id };
}

async function saveProduct(formData: FormData) {
  const id = nullableId(formData, "id");
  const price = intValue(formData, "price");
  const rewardRate = numberValue(formData, "reward_rate");
  const planSignupReward = intValue(formData, "plan_signup_reward");
  const recurringRewardRate = numberValue(formData, "recurring_reward_rate");
  const approvedMediaName = text(formData, "approved_media_name");
  let approvedMediaId = nullableId(formData, "approved_media_id");
  if (!approvedMediaId && approvedMediaName) {
    const { data: media } = await supabaseAdmin
      .from("myfans_approved_media")
      .select("id")
      .eq("media_name", approvedMediaName)
      .maybeSingle();
    approvedMediaId = media?.id ?? null;
  }
  const affiliateUrl = text(formData, "affiliate_url");
  const selectionScore = calculateMyfansSelectionScore({
    price,
    rewardRate,
    planSignupReward,
    recurringRewardRate,
    popularityRank: nullableId(formData, "popularity_rank"),
    likesCount: intValue(formData, "likes_count"),
    savesCount: intValue(formData, "saves_count"),
    isNew: text(formData, "is_new") === "true",
    hasAffiliateUrl: Boolean(affiliateUrl),
    hasApprovedMedia: Boolean(approvedMediaName || text(formData, "affiliate_media_id")),
    source_x_url: text(formData, "source_x_url"),
  });
  const record = {
    creator_id: nullableId(formData, "creator_id"),
    approved_media_id: approvedMediaId,
    title: text(formData, "title"),
    product_url: text(formData, "product_url"),
    affiliate_url: affiliateUrl,
    ...(affiliateUrl ? {
      affiliate_url_generated_at: text(formData, "affiliate_url_generated_at") || new Date().toISOString(),
      affiliate_url_expires_at: text(formData, "affiliate_url_expires_at") || null,
      affiliate_url_source: text(formData, "affiliate_url_source") || "manual_form",
    } : {}),
    source_x_url: text(formData, "source_x_url"),
    creator_x_url: text(formData, "creator_x_url"),
    quote_candidate_x_url: text(formData, "quote_candidate_x_url") || text(formData, "source_x_url"),
    media_permission_status: text(formData, "media_permission_status") || "unknown",
    media_permission_note: text(formData, "media_permission_note"),
    genre: text(formData, "genre"),
    product_type: text(formData, "product_type") || "single",
    status: text(formData, "status") || "candidate",
    price,
    reward_rate: rewardRate,
    estimated_reward: Math.round(price * (rewardRate / 100)),
    plan_signup_reward: planSignupReward,
    recurring_reward_rate: recurringRewardRate,
    popularity_rank: nullableId(formData, "popularity_rank"),
    likes_count: intValue(formData, "likes_count"),
    saves_count: intValue(formData, "saves_count"),
    is_new: text(formData, "is_new") === "true",
    selection_reason: text(formData, "selection_reason"),
    notes: text(formData, "notes"),
    approved_media_name: approvedMediaName,
    approved_media_url: text(formData, "approved_media_url"),
    affiliate_media_id: text(formData, "affiliate_media_id"),
    selection_score: selectionScore,
    launch_priority: myfansLaunchPriority(selectionScore),
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!record.title) throw new Error("商品名を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_products").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  await audit("product", data.id, id ? "update" : "create", record.title, { selectionScore });
  return { id: data.id, selectionScore };
}

function parseBulkProducts(textValue: string) {
  const lines = textValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine || !rows.length) return [];
  const headers = headerLine.split(",").map((header) => header.normalize("NFKC").trim());
  return rows.map((line) => {
    const cells = line.split(",").map((cell) => cell.normalize("NFKC").trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

async function importProducts(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSVファイルを選択してください。");
  if (file.size > MAX_FILE_SIZE) throw new Error("CSVは10MB以内にしてください。");

  const rows = parseBulkProducts(new TextDecoder("utf-8").decode(await file.arrayBuffer()));
  if (!rows.length) throw new Error("登録できる商品行がありません。");

  const records = rows.map((row) => {
    const price = Number(row.price ?? row["価格"] ?? 0) || 0;
    const rewardRate = Number(row.reward_rate ?? row["報酬率"] ?? 0) || 0;
    const planSignupReward = Number(row.plan_signup_reward ?? row["プラン加入報酬"] ?? 0) || 0;
    const recurringRewardRate = Number(row.recurring_reward_rate ?? row["継続報酬率"] ?? 0) || 0;
    const affiliateUrl = String(row.affiliate_url ?? row["アフィリンク"] ?? "");
    const approvedMediaName = String(row.approved_media_name ?? row["承認済みメディア"] ?? "");
    const selectionScore = calculateMyfansSelectionScore({
      price,
      rewardRate,
      planSignupReward,
      recurringRewardRate,
      popularityRank: row.popularity_rank || row["人気順位"] ? Number(row.popularity_rank ?? row["人気順位"]) : null,
      likesCount: Number(row.likes_count ?? row["いいね"] ?? 0) || 0,
      savesCount: Number(row.saves_count ?? row["保存"] ?? 0) || 0,
      isNew: String(row.is_new ?? row["新着"] ?? "") === "true" || row["新着"] === "はい",
      hasAffiliateUrl: Boolean(affiliateUrl),
      hasApprovedMedia: Boolean(approvedMediaName || row.affiliate_media_id),
      source_x_url: String(row.source_x_url ?? row["引用元X URL"] ?? ""),
    });
    return {
      title: String(row.title ?? row["商品名"] ?? ""),
      product_url: String(row.product_url ?? row["商品URL"] ?? ""),
      affiliate_url: affiliateUrl,
      ...(affiliateUrl ? {
        affiliate_url_generated_at: new Date().toISOString(),
        affiliate_url_expires_at: null,
        affiliate_url_source: "csv_import",
      } : {}),
      source_x_url: String(row.source_x_url ?? row["引用元X URL"] ?? ""),
      creator_x_url: String(row.creator_x_url ?? row["creator X URL"] ?? row["クリエイターX URL"] ?? ""),
      quote_candidate_x_url: String(row.quote_candidate_x_url ?? row["引用候補X URL"] ?? row.source_x_url ?? row["引用元X URL"] ?? ""),
      media_permission_status: String(row.media_permission_status ?? row["素材許諾"] ?? "unknown") || "unknown",
      media_permission_note: String(row.media_permission_note ?? row["素材許諾メモ"] ?? ""),
      genre: String(row.genre ?? row["ジャンル"] ?? ""),
      product_type: String(row.product_type ?? row["商品種別"] ?? "single") || "single",
      status: String(row.status ?? row["状態"] ?? "candidate") || "candidate",
      price,
      reward_rate: rewardRate,
      estimated_reward: Math.round(price * (rewardRate / 100)),
      plan_signup_reward: planSignupReward,
      recurring_reward_rate: recurringRewardRate,
      popularity_rank: row.popularity_rank || row["人気順位"] ? Number(row.popularity_rank ?? row["人気順位"]) : null,
      likes_count: Number(row.likes_count ?? row["いいね"] ?? 0) || 0,
      saves_count: Number(row.saves_count ?? row["保存"] ?? 0) || 0,
      is_new: String(row.is_new ?? row["新着"] ?? "") === "true" || row["新着"] === "はい",
      selection_reason: String(row.selection_reason ?? row["選定理由"] ?? ""),
      notes: String(row.notes ?? row["メモ"] ?? ""),
      approved_media_name: approvedMediaName,
      approved_media_url: String(row.approved_media_url ?? row["承認メディアURL"] ?? ""),
      affiliate_media_id: String(row.affiliate_media_id ?? row["メディアID"] ?? ""),
      selection_score: selectionScore,
      launch_priority: myfansLaunchPriority(selectionScore),
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }).filter((row) => row.title);

  if (!records.length) throw new Error("商品名が入った行がありません。");
  const { error } = await supabaseAdmin
    .from("myfans_products")
    .upsert(records, { onConflict: "product_url", ignoreDuplicates: false });
  if (error) throw error;
  await audit("import", null, "product_csv_import", file.name, { rows: records.length });
  return { imported: records.length };
}

async function importAffiliateText(formData: FormData) {
  const affiliateText = text(formData, "affiliate_text");
  if (!affiliateText) throw new Error("myfans管理画面からコピーしたテキストを貼り付けてください。");
  return saveMyfansAffiliateTextImport(affiliateText);
}

async function updateAffiliateLink(formData: FormData) {
  const productId = nullableId(formData, "product_id");
  if (!productId) throw new Error("商品IDがありません。");
  const affiliateUrl = normalizeMyfansAffiliateUrl(text(formData, "affiliate_url"));
  if (!affiliateUrl) throw new Error("正規のmyfansアフィリンク（https://mfco.link/r/...）だけ保存できます。");
  const expiresAt = text(formData, "affiliate_url_expires_at");
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) throw new Error("期限日時の形式を確認してください。");

  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("商品が見つかりません。");

  const generatedAt = text(formData, "affiliate_url_generated_at") || new Date().toISOString();
  const record = {
    affiliate_url: affiliateUrl,
    affiliate_url_generated_at: generatedAt,
    affiliate_url_expires_at: expiresAt || null,
    affiliate_url_source: text(formData, "affiliate_url_source") || MYFANS_AFFILIATE_URL_SOURCE_MANUAL,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from("myfans_products").update(record).eq("id", productId);
  if (error) throw error;
  await audit("product", productId, "affiliate_link_update", product.title, record);
  return { id: productId, affiliateUrl };
}

async function savePost(formData: FormData) {
  const id = nullableId(formData, "id");
  const productId = nullableId(formData, "product_id");
  let approvedMediaId = nullableId(formData, "approved_media_id");
  let approvedMediaName = text(formData, "approved_media_name");
  if (productId && !approvedMediaId) {
    const { data: product } = await supabaseAdmin
      .from("myfans_products")
      .select("approved_media_id,approved_media_name")
      .eq("id", productId)
      .maybeSingle();
    approvedMediaId = product?.approved_media_id ?? null;
    approvedMediaName = approvedMediaName || product?.approved_media_name || "";
  }
  const growthScore = intValue(formData, "growth_score");
  const revenueScore = intValue(formData, "revenue_score");
  const creatorLtvScore = intValue(formData, "creator_ltv_score");
  const expectedRewardPer1000 = intValue(formData, "expected_reward_per_1000_impressions");
  const record = {
    product_id: productId,
    post_type: text(formData, "post_type") || "discovery",
    status: text(formData, "status") || "draft",
    body: text(formData, "body"),
    self_reply: text(formData, "self_reply"),
    includes_pr: text(formData, "includes_pr") !== "false",
    source_x_url: text(formData, "source_x_url"),
    affiliate_url: text(formData, "affiliate_url"),
    selection_reason: text(formData, "selection_reason"),
    scheduled_at: text(formData, "scheduled_at") || null,
    posted_at: text(formData, "posted_at") || null,
    x_post_url: text(formData, "x_post_url"),
    actual_posted_by: text(formData, "actual_posted_by"),
    impressions: intValue(formData, "impressions"),
    likes_count: intValue(formData, "likes_count"),
    reposts_count: intValue(formData, "reposts_count"),
    replies_count: intValue(formData, "replies_count"),
    clicks: intValue(formData, "clicks"),
    growth_stage: text(formData, "growth_stage"),
    link_strategy: text(formData, "link_strategy") || "no_link",
    cta_strategy: text(formData, "cta_strategy"),
    creative_variant_id: text(formData, "creative_variant_id"),
    creative_strategy: text(formData, "creative_strategy") || "text_only",
    creative_reason: text(formData, "creative_reason"),
    card_payload: (() => {
      const raw = text(formData, "card_payload");
      if (!raw) return {};
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
    ogp_check_required: text(formData, "ogp_check_required") === "true",
    quote_x_url: text(formData, "quote_x_url"),
    media_permission_status: text(formData, "media_permission_status") || "unknown",
    planned_slot: text(formData, "planned_slot"),
    objective: text(formData, "objective") || "impression",
    approved_media_name: approvedMediaName,
    approved_media_id: approvedMediaId,
    growth_score_snapshot: growthScore,
    revenue_score_snapshot: revenueScore,
    creator_ltv_score_snapshot: creatorLtvScore,
    expected_reward_per_1000_impressions_snapshot: expectedRewardPer1000,
    external_metrics_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!record.body) throw new Error("投稿本文を入力してください。");

  const query = id
    ? supabaseAdmin.from("myfans_x_posts").update(record).eq("id", id).select("id").single()
    : supabaseAdmin.from("myfans_x_posts").insert(record).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  if (record.creative_strategy === "quote_post" && record.quote_x_url) {
    const cooldown = new Date();
    cooldown.setDate(cooldown.getDate() + 30);
    await supabaseAdmin
      .from("myfans_quote_candidates")
      .update({
        selected_for_today: true,
        last_used_at: new Date().toISOString(),
        cooldown_until: cooldown.toISOString(),
        use_count: 1,
      })
      .eq("x_post_url", record.quote_x_url);
  }
  await audit("x_post", data.id, id ? "update" : "create", record.body.slice(0, 80));
  return { id: data.id };
}

async function updatePostExecution(formData: FormData) {
  const id = nullableId(formData, "id");
  if (!id) throw new Error("投稿IDがありません。");
  const mode = text(formData, "mode");
  const record =
    mode === "posted"
      ? {
          status: "posted",
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : mode === "url"
        ? {
            x_post_url: text(formData, "x_post_url"),
            status: "posted",
            posted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : mode === "metrics"
          ? {
              impressions: intValue(formData, "impressions"),
              likes_count: intValue(formData, "likes_count"),
              reposts_count: intValue(formData, "reposts_count"),
              replies_count: intValue(formData, "replies_count"),
              clicks: intValue(formData, "clicks"),
              external_metrics_checked_at: new Date().toISOString(),
              metrics_recorded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : null;
  if (!record) throw new Error("未対応の更新です。");
  if (mode === "url" && !text(formData, "x_post_url")) throw new Error("投稿URLを入力してください。");
  const { error } = await supabaseAdmin.from("myfans_x_posts").update(record).eq("id", id);
  if (error) throw error;
  await audit("x_post", id, `execution_${mode}`, "投稿実行ボードから更新", record);
  return { id };
}

async function updateQuoteCandidate(formData: FormData) {
  const productId = nullableId(formData, "product_id");
  const quoteUrl = text(formData, "quote_candidate_x_url");
  if (!productId) throw new Error("商品IDがありません。");
  if (!/^https:\/\/(x\.com|twitter\.com)\/[^/\s]+\/status\/\d+/.test(quoteUrl)) {
    throw new Error("creator本人のX投稿URLを入力してください。");
  }
  const { data: product, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title,creator_x_url")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("商品が見つかりません。");
  if (product.creator_x_url) {
    const creatorHandle = String(product.creator_x_url).match(/(?:x\.com|twitter\.com)\/([^/?#]+)/)?.[1]?.toLowerCase();
    const quoteHandle = quoteUrl.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/)?.[1]?.toLowerCase();
    if (creatorHandle && quoteHandle && creatorHandle !== quoteHandle) {
      throw new Error("creator本人のX投稿URLだけ登録できます。");
    }
  }
  const { error } = await supabaseAdmin
    .from("myfans_products")
    .update({ quote_candidate_x_url: quoteUrl, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
  await audit("product", productId, "quote_candidate_update", product.title, { quoteUrl });
  return { id: productId };
}

async function saveClick(formData: FormData) {
  const record = {
    product_id: nullableId(formData, "product_id"),
    x_post_id: nullableId(formData, "x_post_id"),
    clicked_at: text(formData, "clicked_at") || new Date().toISOString(),
    source: text(formData, "source") || "x",
    placement: text(formData, "placement") || "self_reply",
    note: text(formData, "note"),
  };
  const { data, error } = await supabaseAdmin.from("myfans_affiliate_clicks").insert(record).select("id").single();
  if (error) throw error;
  await audit("click", data.id, "create", "クリック実績を追加", record);
  return { id: data.id };
}

async function saveXAccountMetric(formData: FormData) {
  const approvedMediaId = nullableId(formData, "approved_media_id");
  const metricDate = text(formData, "metric_date");
  if (!approvedMediaId) throw new Error("承認済みメディアを選択してください。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) throw new Error("週の終了日を選択してください。");

  const followingInput = text(formData, "following_count");
  const record = {
    metric_date: metricDate,
    approved_media_id: approvedMediaId,
    followers_count: intValue(formData, "followers_count"),
    following_count: followingInput ? intValue(formData, "following_count") : null,
    profile_visits: intValue(formData, "profile_visits"),
    total_impressions: intValue(formData, "total_impressions"),
    posts_count: intValue(formData, "posts_count"),
    likes: intValue(formData, "likes"),
    reposts: intValue(formData, "reposts"),
    replies: intValue(formData, "replies"),
    affiliate_clicks: intValue(formData, "affiliate_clicks"),
    conversions: intValue(formData, "conversions"),
    reward_amount: intValue(formData, "reward_amount"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("myfans_x_account_metrics")
    .upsert(record, { onConflict: "approved_media_id,metric_date", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw error;
  await audit("media", approvedMediaId, "x_account_weekly_metric_upsert", metricDate, record);
  return { id: data.id };
}

async function importRevenue(formData: FormData) {
  const file = formData.get("file");
  const reportMonthInput = text(formData, "reportMonth");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSVファイルを選択してください。");
  if (file.size > MAX_FILE_SIZE) throw new Error("CSVは10MB以内にしてください。");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonthInput)) throw new Error("対象月を選択してください。");

  const csv = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  const rows = parseMyfansReportCsv(csv);
  if (!rows.length) throw new Error("取込可能な明細がありません。");

  const { data: products, error: productError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,product_url,title");
  if (productError) throw productError;
  const productByUrl = new Map((products ?? []).map((product) => [product.product_url, product.id]));
  const productByTitle = new Map((products ?? []).map((product) => [product.title, product.id]));
  const sourceFile = file.name.slice(0, 255);
  const records = rows.map((row) => ({
    product_id: productByUrl.get(row.productUrl) ?? productByTitle.get(row.title) ?? null,
    conversion_type: row.conversionType,
    occurred_at: new Date(row.occurredAt).toISOString(),
    sale_amount: row.saleAmount,
    reward_amount: row.rewardAmount,
    reward_rate: row.rewardRate,
    source_file: sourceFile,
    row_key: rowKey(reportMonthInput, sourceFile, row.occurredAt, row.productUrl, row.title, String(row.rewardAmount)),
    note: "",
  }));

  const { error } = await supabaseAdmin
    .from("myfans_conversions")
    .upsert(records, { onConflict: "row_key", ignoreDuplicates: false });
  if (error) throw error;

  const totalSalesAmount = records.reduce((sum, row) => sum + row.sale_amount, 0);
  const totalRewardAmount = records.reduce((sum, row) => sum + row.reward_amount, 0);
  await supabaseAdmin.from("myfans_revenue_imports").upsert({
    report_month: `${reportMonthInput}-01`,
    source_file: sourceFile,
    rows_count: records.length,
    total_sales_amount: totalSalesAmount,
    total_reward_amount: totalRewardAmount,
  }, { onConflict: "report_month,source_file" });
  await audit("import", null, "csv_import", sourceFile, { rows: records.length, totalRewardAmount });

  return {
    imported: records.length,
    matched: records.filter((row) => row.product_id !== null).length,
    totalRewardAmount,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const action = text(formData, "action");
    const result =
      action === "creator" ? await saveCreator(formData) :
      action === "media" ? await saveMedia(formData) :
      action === "product" ? await saveProduct(formData) :
      action === "product_import" ? await importProducts(formData) :
      action === "affiliate_text_import" ? await importAffiliateText(formData) :
      action === "affiliate_link_update" ? await updateAffiliateLink(formData) :
      action === "post" ? await savePost(formData) :
      action === "post_execution_update" ? await updatePostExecution(formData) :
      action === "quote_candidate_update" ? await updateQuoteCandidate(formData) :
      action === "click" ? await saveClick(formData) :
      action === "x_account_metric" ? await saveXAccountMetric(formData) :
      action === "revenue_import" ? await importRevenue(formData) :
      null;

    if (!result) return NextResponse.json({ error: "未対応の操作です。" }, { status: 400 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("myfans admin action failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "myfans操作に失敗しました。" },
      { status: 500 },
    );
  }
}
