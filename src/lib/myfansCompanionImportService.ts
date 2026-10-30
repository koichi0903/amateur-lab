import { NextResponse } from "next/server";
import {
  cleanMyfansUrl,
  cleanText,
  cleanXProfileUrl,
  numberValue,
} from "@/lib/myfansCompanionInput";
import { normalizeMyfansPostUrl } from "@/lib/myfansProductResolver";
import { companionPersistenceError } from "@/lib/myfansCompanionErrors";
import { buildMyfansCreatorSavePlan, type MyfansCreatorSaveRecord } from "@/lib/myfansCreatorSavePlan";
import { buildObservedProductRecords, type ExistingObservedMyfansProduct } from "@/lib/myfansObservedPostImport";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";
export function xHandleFromUrl(value: string) {
  const match = cleanXProfileUrl(value).match(/^https:\/\/x\.com\/([^/?#]+)/);
  return match?.[1] ? `@${match[1]}` : "";
}


let resolverProductsCache: Awaited<ReturnType<typeof fetchResolverProductsFromDb>> | null = null;

async function fetchResolverProductsFromDb() {
  const { data, error } = await supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,approved_media_id,title,product_url,genre,product_type,status,price,reward_rate,estimated_reward,plan_signup_reward,recurring_reward_rate,popularity_rank,likes_count,saves_count,is_new,source_x_url,creator_x_url,quote_candidate_x_url,affiliate_url,media_permission_status,media_permission_note,selection_reason,approved_media_name,approved_media_url,affiliate_media_id,selection_score,launch_priority,created_at")
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

export async function fetchResolverProducts() {
  resolverProductsCache ??= await fetchResolverProductsFromDb();
  return resolverProductsCache;
}

export async function saveCompanionImport(record: Record<string, unknown>, payloadHash: string) {
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

export async function saveCreator(record: MyfansCreatorSaveRecord) {
  const creatorXUrl = cleanXProfileUrl(record.creator_x_url);
  const sourceXHandle = creatorXUrl ? xHandleFromUrl(creatorXUrl) : "";
  let existing: { id: number; creator_x_url: string | null; source_x_handle: string | null } | null = null;
  if (record.myfans_url) {
    const { data, error: findError } = await supabaseAdmin
      .from("myfans_creators")
      .select("id,creator_x_url,source_x_handle")
      .eq("myfans_url", record.myfans_url)
      .maybeSingle();
    if (findError) throw findError;
    existing = data;
  }

  const plan = buildMyfansCreatorSavePlan({
    record,
    existing,
    existingXUrl: cleanXProfileUrl(existing?.creator_x_url),
    creatorXUrl,
    sourceXHandle,
  });
  if (plan.kind === "x_url_conflict") {
    const conflict = {
      existingXUrl: plan.existingXUrl,
      incomingXUrl: plan.incomingXUrl,
      source: plan.source,
      detectedAt: new Date().toISOString(),
    };
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "creator",
      entity_id: plan.creatorId,
      action: "creator_x_url_conflict",
      summary: plan.displayName,
      metadata: conflict,
    });
    const { data, error } = await supabaseAdmin
      .from("myfans_creators")
      .update({
        display_name: plan.displayName,
        genre: plan.genre,
        activity_note: plan.activityNote,
        x_url_conflict: conflict,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.creatorId)
      .select("id")
      .single();
    if (error) throw error;
    return data.id as number;
  }
  if (plan.kind === "update") {
    const { data, error } = await supabaseAdmin
      .from("myfans_creators")
      .update({ ...plan.record, updated_at: new Date().toISOString() })
      .eq("id", plan.creatorId)
      .select("id")
      .single();
    if (error) throw error;
    if (plan.syncProductsCreatorXUrl) {
      await supabaseAdmin
        .from("myfans_products")
        .update({ creator_x_url: plan.syncProductsCreatorXUrl, updated_at: new Date().toISOString() })
        .eq("creator_id", plan.creatorId)
        .or("creator_x_url.is.null,creator_x_url.eq.");
    }
    return data.id as number;
  }

  const { data, error } = await supabaseAdmin
    .from("myfans_creators")
    .insert({ ...plan.record, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function saveProduct(record: Record<string, unknown>, productUrl: string) {
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

function parseObservedPrice(value: unknown) {
  const parsed = Number(cleanText(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function isMissingSupplyColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && /column .* does not exist|schema cache/i.test(error.message));
}

type SupplyEvidenceRow = {
  id: number;
  source_status_url: string;
  discovered_myfans_url: string;
  final_myfans_url: string | null;
  product_id: number | null;
  resolution_method: string;
  confidence: string;
  evidence_source: string;
  metadata: Record<string, unknown> | null;
  verified_at: string;
  resolution_history?: unknown;
};

async function findObservedProduct(productUrl: string): Promise<ExistingObservedMyfansProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("myfans_products")
    .select("id,title,creator_id,affiliate_url,price,status,likes_count")
    .eq("product_url", productUrl)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveObservedProduct(
  existing: ExistingObservedMyfansProduct | null,
  record: Record<string, unknown>,
  legacyRecord: Record<string, unknown>,
) {
  const query = existing
    ? supabaseAdmin.from("myfans_products").update(record).eq("id", existing.id).select("id").single()
    : supabaseAdmin.from("myfans_products").insert(record).select("id").single();
  let { data: saved, error: saveError } = await query;
  if (isMissingSupplyColumn(saveError)) {
    const legacyQuery = existing
      ? supabaseAdmin.from("myfans_products").update(legacyRecord).eq("id", existing.id).select("id").single()
      : supabaseAdmin.from("myfans_products").insert(legacyRecord).select("id").single();
    ({ data: saved, error: saveError } = await legacyQuery);
  }
  if (saveError) throw companionPersistenceError(saveError, "myfans_product_import");
  if (!saved) throw new Error("myfans商品の保存結果を取得できませんでした。");
  return Number(saved.id);
}

async function findObservedProductEvidence(productUrl: string): Promise<SupplyEvidenceRow[]> {
  const evidenceQuery = await supabaseAdmin
    .from("myfans_post_product_linkage_evidence")
    .select("id,source_status_url,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,metadata,verified_at,resolution_history")
    .or(`final_myfans_url.eq.${productUrl},discovered_myfans_url.eq.${productUrl}`);
  let evidenceSelectError = evidenceQuery.error;
  let evidenceRows = (evidenceQuery.data ?? []) as SupplyEvidenceRow[];
  if (isMissingSupplyColumn(evidenceSelectError)) {
    const fallbackEvidence = await supabaseAdmin
      .from("myfans_post_product_linkage_evidence")
      .select("id,source_status_url,discovered_myfans_url,final_myfans_url,product_id,resolution_method,confidence,evidence_source,metadata,verified_at")
      .or(`final_myfans_url.eq.${productUrl},discovered_myfans_url.eq.${productUrl}`);
    evidenceRows = (fallbackEvidence.data ?? []) as SupplyEvidenceRow[];
    evidenceSelectError = fallbackEvidence.error;
  }
  if (evidenceSelectError) throw companionPersistenceError(evidenceSelectError, "myfans_evidence_lookup");
  return evidenceRows;
}

async function promoteObservedProductEvidence(evidenceRows: SupplyEvidenceRow[], productId: number, productUrl: string, now: string) {
  let promotedEvidence = 0;
  for (const evidence of evidenceRows) {
    if (evidence.confidence === "exact" && evidence.product_id === productId) continue;
    const history = Array.isArray(evidence.resolution_history) ? evidence.resolution_history : [];
    const nextHistory = [...history, {
      at: now,
      from: { product_id: evidence.product_id, confidence: evidence.confidence, resolution_method: evidence.resolution_method, final_myfans_url: evidence.final_myfans_url },
      reason: "canonical myfans post product upsert",
    }].slice(-20);
    const promotion = {
      final_myfans_url: productUrl,
      product_id: productId,
      resolution_method: "exact_product_url",
      confidence: "exact",
      metadata: { ...(evidence.metadata && typeof evidence.metadata === "object" ? evidence.metadata : {}), promoted_from_supply_import: true, promoted_at: now },
      resolution_history: nextHistory,
      updated_at: now,
    };
    let { error: promoteError } = await supabaseAdmin
      .from("myfans_post_product_linkage_evidence")
      .update(promotion)
      .eq("id", evidence.id);
    if (isMissingSupplyColumn(promoteError)) {
      const legacyPromotion = Object.fromEntries(Object.entries(promotion).filter(([key]) => key !== "resolution_history"));
      ({ error: promoteError } = await supabaseAdmin.from("myfans_post_product_linkage_evidence").update(legacyPromotion).eq("id", evidence.id));
    }
    if (promoteError) throw companionPersistenceError(promoteError, "myfans_evidence_promotion");
    promotedEvidence += 1;
    await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "evidence",
      entity_id: evidence.id,
      action: "resolver_exact_promotion",
      summary: productUrl,
      metadata: { productId, previousConfidence: evidence.confidence, previousProductId: evidence.product_id, source: "myfans_post_supply_import" },
    });
  }
  return promotedEvidence;
}

export async function importObservedMyfansPost(payload: Record<string, unknown>, approvedMediaId: number | null) {
  const productUrl = normalizeMyfansPostUrl(cleanText(payload.productUrl || payload.pageUrl));
  const title = cleanText(payload.productTitle || payload.title);
  if (!productUrl || !title) {
    return NextResponse.json({ error: "myfans投稿のcanonical URLと表示タイトルが必要です。" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const price = parseObservedPrice(payload.price);
  const likesCount = Math.round(numberValue(payload.likesCount));
  const existing = await findObservedProduct(productUrl);
  const { sourceMetadata, record, legacyRecord } = buildObservedProductRecords({
    payload,
    approvedMediaId,
    existing,
    productUrl,
    title,
    now,
    price,
    likesCount,
  });
  const productId = await saveObservedProduct(existing, record, legacyRecord);
  const evidenceRows = await findObservedProductEvidence(productUrl);
  const promotedEvidence = await promoteObservedProductEvidence(evidenceRows, productId, productUrl, now);
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "product",
    entity_id: productId,
    action: existing ? "myfans_post_supply_refresh" : "myfans_post_supply_import",
    summary: title,
    metadata: sourceMetadata,
  });
  return NextResponse.json({ ok: true, importedType: "post_product", id: productId, productUrl, promotedEvidence, affiliateReady: Boolean(existing?.affiliate_url) });
}

type ExactProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

export function extractFinalMyfansUrl(candidate: QuoteScanPayload["statusCandidate"]) {
  const direct = Array.isArray(candidate?.myfansUrls) ? candidate.myfansUrls : [];
  const evidence = Array.isArray(candidate?.resolvedProductEvidence) ? candidate.resolvedProductEvidence : [];
  return [...direct, ...evidence.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).finalMyfansUrl : "")]
    .map((url) => normalizeMyfansPostUrl(cleanMyfansUrl(url)))
    .find(Boolean) || "";
}

function htmlMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

async function observeMyfansPostForImport(finalMyfansUrl: string) {
  try {
    const response = await fetch(finalMyfansUrl, { signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!response.ok) return { title: "", price: 0, reason: `MYFANS_PAGE_HTTP_${response.status}` };
    const html = await response.text();
    const title = htmlMeta(html, ["og:title", "twitter:title"]) || cleanText(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]);
    const price = htmlMeta(html, ["product:price:amount", "og:price:amount"]);
    return { title, price: price ? parseObservedPrice(price) : 0, reason: title ? "og_metadata" : "TITLE_NOT_OBSERVED" };
  } catch (error) {
    return { title: "", price: 0, reason: error instanceof Error ? error.message.slice(0, 180) : "MYFANS_PAGE_FETCH_FAILED" };
  }
}

export async function ensureExactProductForCreator(finalMyfansUrl: string, creatorId: number, approvedMediaId: number | null): Promise<ExactProductResolution> {
  const canonicalUrl = normalizeMyfansPostUrl(finalMyfansUrl);
  if (!canonicalUrl) return { product: null, status: "blocked", method: "invalid_final_myfans_url", missing: ["canonical MyFans post URL"] };
  const { data: matches, error: findError } = await supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price")
    .eq("product_url", canonicalUrl);
  if (findError) throw findError;
  if ((matches ?? []).length > 1) return { product: null, status: "ambiguous", method: "exact_canonical_url_duplicate", missing: [] };
  if ((matches ?? []).length === 1) {
    const existing = matches[0] as Record<string, unknown>;
    if (existing.creator_id != null && Number(existing.creator_id) !== creatorId) {
      return { product: null, status: "ambiguous", method: "exact_url_creator_conflict", missing: [] };
    }
    const { data: updated, error } = await supabaseAdmin.from("myfans_products")
      .update({ creator_id: creatorId, ...(approvedMediaId ? { approved_media_id: approvedMediaId } : {}), updated_at: new Date().toISOString() })
      .eq("id", existing.id).select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price").single();
    if (error) throw error;
    return { product: updated as Record<string, unknown>, status: "exact", method: "existing_canonical_url_then_creator_exact", missing: [] };
  }

  const observed = await observeMyfansPostForImport(canonicalUrl);
  if (!observed.title) return { product: null, status: "blocked", method: "canonical_url_observed_title_missing", missing: ["MyFans表示タイトル", observed.reason] };
  const imported = await importObservedMyfansPost({ productUrl: canonicalUrl, productTitle: observed.title, price: observed.price, pageUrl: canonicalUrl }, approvedMediaId);
  const importedBody = await imported.json().catch(() => ({}));
  if (!imported.ok || !importedBody?.id) throw new Error(`MYFANS_PRODUCT_IMPORT_FAILED: ${String(importedBody?.error || imported.status)}`);
  const { data: linked, error: linkError } = await supabaseAdmin.from("myfans_products")
    .update({ creator_id: creatorId, updated_at: new Date().toISOString() }).eq("id", Number(importedBody.id))
    .select("id,creator_id,approved_media_id,title,product_url,creator_x_url,affiliate_url,price").single();
  if (linkError) throw linkError;
  return { product: linked as Record<string, unknown>, status: "exact", method: "canonical_url_observed_import_then_creator_exact", missing: [] };
}

