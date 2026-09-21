import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyfansXPost } from "@/lib/myfansAnalytics";

export type MyfansPermanentExclusionReason = "posted" | "user_skipped";
export type MyfansPermanentExclusionEntity = "product" | "source";

export type MyfansPermanentExclusion = {
  id: number;
  entity_type: MyfansPermanentExclusionEntity;
  entity_key: string;
  product_id: number | null;
  source_status_url: string | null;
  quote_candidate_id: number | null;
  reason: MyfansPermanentExclusionReason;
  context: Record<string, unknown>;
  created_at: string;
};

export function normalizePermanentSourceUrl(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

export function productExclusionKey(productId: number) {
  return `product:${productId}`;
}

export function sourceExclusionKey(sourceUrl: string) {
  const normalized = normalizePermanentSourceUrl(sourceUrl);
  return normalized ? `source:${normalized}` : "";
}

export function buildPermanentExclusionSets(exclusions: readonly MyfansPermanentExclusion[]) {
  return {
    productIds: new Set(exclusions.filter((row) => row.entity_type === "product").map((row) => row.product_id).filter((id): id is number => Number.isSafeInteger(id))),
    sourceKeys: new Set(exclusions.filter((row) => row.entity_type === "source").map((row) => row.entity_key)),
  };
}

export function isPermanentlyExcluded(input: {
  productId?: number | null;
  quoteXUrl?: string | null;
  sourceXUrl?: string | null;
  sets: ReturnType<typeof buildPermanentExclusionSets>;
}) {
  if (input.productId && input.sets.productIds.has(input.productId)) return true;
  return [input.quoteXUrl, input.sourceXUrl].some((url) => {
    const key = url ? sourceExclusionKey(url) : "";
    return Boolean(key && input.sets.sourceKeys.has(key));
  });
}

export function postedExclusionTarget(post: Pick<MyfansXPost, "product_id" | "quote_x_url" | "source_x_url">) {
  if (post.product_id) return { entityType: "product" as const, entityKey: productExclusionKey(post.product_id), productId: post.product_id, sourceStatusUrl: null };
  const sourceStatusUrl = normalizePermanentSourceUrl(post.quote_x_url || post.source_x_url);
  if (!sourceStatusUrl) return null;
  return { entityType: "source" as const, entityKey: sourceExclusionKey(sourceStatusUrl), productId: null, sourceStatusUrl };
}

export function derivePostedExclusions(posts: readonly MyfansXPost[]): MyfansPermanentExclusion[] {
  const seen = new Set<string>();
  return posts
    .filter((post) => post.status === "posted" || Boolean(post.posted_at) || Boolean(post.x_post_url))
    .flatMap((post) => {
      const target = postedExclusionTarget(post);
      if (!target || seen.has(target.entityKey)) return [];
      seen.add(target.entityKey);
      return [{
        id: -post.id,
        entity_type: target.entityType,
        entity_key: target.entityKey,
        product_id: target.productId,
        source_status_url: target.sourceStatusUrl,
        quote_candidate_id: null,
        reason: "posted" as const,
        context: { derived_from: "myfans_x_posts_fallback", post_id: post.id },
        created_at: post.posted_at ?? post.created_at,
      }];
    });
}

export async function fetchMyfansPermanentExclusions() {
  return supabaseAdmin
    .from("myfans_permanent_candidate_exclusions")
    .select("id,entity_type,entity_key,product_id,source_status_url,quote_candidate_id,reason,context,created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
}

export async function recordMyfansPermanentExclusion(input: {
  entityType: MyfansPermanentExclusionEntity;
  entityKey: string;
  productId?: number | null;
  sourceStatusUrl?: string | null;
  quoteCandidateId?: number | null;
  reason: MyfansPermanentExclusionReason;
  context?: Record<string, unknown>;
}) {
  if (!input.entityKey) return { data: null, error: null };
  return supabaseAdmin.from("myfans_permanent_candidate_exclusions").upsert({
    entity_type: input.entityType,
    entity_key: input.entityKey,
    product_id: input.productId ?? null,
    source_status_url: input.sourceStatusUrl ?? null,
    quote_candidate_id: input.quoteCandidateId ?? null,
    reason: input.reason,
    context: input.context ?? {},
  }, { onConflict: "entity_type,entity_key", ignoreDuplicates: true }).select("id").maybeSingle();
}

export function exclusionTargetForCandidate(input: {
  productId?: number | null;
  quoteXUrl?: string | null;
  sourceXUrl?: string | null;
  quoteCandidateId?: number | null;
}) {
  if (input.productId) return { entityType: "product" as const, entityKey: productExclusionKey(input.productId), productId: input.productId, sourceStatusUrl: null, quoteCandidateId: input.quoteCandidateId ?? null };
  const sourceStatusUrl = normalizePermanentSourceUrl(input.quoteXUrl || input.sourceXUrl);
  if (!sourceStatusUrl) return null;
  return { entityType: "source" as const, entityKey: sourceExclusionKey(sourceStatusUrl), productId: null, sourceStatusUrl, quoteCandidateId: input.quoteCandidateId ?? null };
}
