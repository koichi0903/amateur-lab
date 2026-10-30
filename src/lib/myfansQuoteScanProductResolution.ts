import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { resolveExactMyfansProductByFinalUrl } from "@/lib/myfansProductResolver";
import { companionPersistenceError, normalizeCompanionError } from "@/lib/myfansCompanionErrors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { QuoteScanProduct } from "@/lib/myfansQuoteScanTypes";

export type ExactQuoteProductResolution = {
  product: Record<string, unknown> | null;
  status: "exact" | "not_registered" | "ambiguous" | "blocked";
  method: string;
  missing: string[];
};

type BatchProductResolverInput = {
  approvedMediaId: number | null;
  collectorMethod: string;
  creatorId: number;
  ensureExactProductForCreator: (finalMyfansUrl: string, creatorId: number, approvedMediaId: number | null) => Promise<ExactQuoteProductResolution>;
  resolverProducts: MyfansProduct[];
};

export async function fetchQuoteScanProduct(productId: number | null, creatorId: number | null): Promise<QuoteScanProduct | null> {
  const productQuery = productId
    ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("id", productId).maybeSingle()
    : creatorId
      ? supabaseAdmin.from("myfans_products").select("id,creator_id,approved_media_id,title,creator_x_url").eq("creator_id", creatorId).order("selection_score", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null });
  const { data: product, error } = await productQuery;
  if (error) throw error;
  return product as QuoteScanProduct | null;
}

export function createBatchProductResolver(input: BatchProductResolverInput) {
  const productResolutions = new Map<string, ExactQuoteProductResolution>();
  return async function resolveBatchProduct(finalMyfansUrl: string) {
    if (!finalMyfansUrl) return blockedQuoteProductResolution();
    const cached = productResolutions.get(finalMyfansUrl);
    if (cached) return cached;
    const resolution = await resolveBatchProductOrReportError(input, finalMyfansUrl);
    productResolutions.set(finalMyfansUrl, resolution);
    return resolution;
  };
}

function blockedQuoteProductResolution(): ExactQuoteProductResolution {
  return { product: null, status: "blocked", method: "no_final_myfans_url", missing: ["final MyFans post URL"] };
}

async function resolveBatchProductOrReportError(input: BatchProductResolverInput, finalMyfansUrl: string): Promise<ExactQuoteProductResolution> {
  try {
    const dbResolution = resolveExactMyfansProductByFinalUrl(finalMyfansUrl, input.resolverProducts, input.creatorId);
    if (dbResolution.product?.id) {
      return { product: dbResolution.product as Record<string, unknown>, status: "exact", method: "existing_canonical_url", missing: [] };
    }
    if (dbResolution.status === "ambiguous") {
      return { product: null, status: "ambiguous", method: "exact_canonical_url_duplicate", missing: [] };
    }
    return await input.ensureExactProductForCreator(finalMyfansUrl, input.creatorId, input.approvedMediaId);
  } catch (error) {
    await reportBatchProductResolutionFailure(input, finalMyfansUrl, error);
    throw error;
  }
}

async function reportBatchProductResolutionFailure(input: BatchProductResolverInput, finalMyfansUrl: string, error: unknown) {
  const normalizedError = normalizeCompanionError(error, "batch_product_resolution");
  const { error: auditError } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "creator",
    entity_id: input.creatorId,
    action: "batch_product_resolution_failed",
    summary: finalMyfansUrl,
    metadata: { collectorMethod: input.collectorMethod, finalMyfansUrl, error: normalizedError },
  });
  if (auditError) console.error("batch product resolution audit failed", auditError);
  throw companionPersistenceError(normalizedError, normalizedError.errorStage, "batch_product_resolution_failed");
}
