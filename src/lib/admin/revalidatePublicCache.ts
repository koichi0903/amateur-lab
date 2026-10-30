import { revalidatePath, revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPublicCacheRevalidationPlan } from "@/lib/admin/publicCacheRevalidationPlan";

export { PUBLIC_CACHE_TASKS } from "@/lib/admin/publicCacheRevalidationPlan";

export type PublicCacheRevalidationOptions = {
  workIds?: Iterable<string | number>;
};

export async function revalidatePublicCacheForTasks(
  tasks: string[],
  options: PublicCacheRevalidationOptions = {},
) {
  const plan = buildPublicCacheRevalidationPlan(tasks);
  if (plan.tasks.length === 0) return { tasks: [], paths: [], tags: [] };

  const productIds = [...(options.workIds ?? [])].map((id) => String(id).trim()).filter(Boolean);
  const workTags = new Set<string>();
  if (productIds.length > 0) {
    // Keep the REST query URL below Supabase/undici header limits when a
    // scheduled update touches many works at once.
    for (let index = 0; index < productIds.length; index += 200) {
      const batch = productIds.slice(index, index + 200);
      const { data, error } = await supabaseAdmin
        .from("works")
        .select("id, product_id")
        .in("product_id", batch);
      if (error) throw error;
      for (const work of data ?? []) {
        const workId = String(work.id);
        const productId = String(work.product_id);
        workTags.add(`work-detail:${workId}`);
        workTags.add(`work-detail-product:${productId}`);
      }
    }
  }

  for (const path of plan.paths) revalidatePath(path);

  if (plan.includesAmateurApiCatalog) {
    for (const path of ["/amateur/[contentId]", "/amateur/genre/[name]", "/amateur/maker/[name]"]) {
      revalidatePath(path, "page");
    }
  }

  for (const tag of plan.tags) revalidateTag(tag, tag === "home-price-insights" ? "max" : { expire: 0 });
  for (const tag of workTags) revalidateTag(tag, { expire: 0 });

  return {
    tasks: plan.tasks,
    paths: plan.paths,
    tags: [...plan.tags, ...workTags],
    // Work detail caches are fully covered by their two data tags above:
    // one for the works row and one for product-keyed offers/history/images.
    // Avoid an additional per-work revalidatePath call.
    workPaths: [],
  };
}
