import { revalidatePath, revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CATALOG_TASKS = new Set(["reserve", "new", "semi-new", "old", "stage"]);
const PRICE_TASKS = new Set(["sale", "ended-sale", "missing-prices"]);
const DISCOVERY_TASKS = new Set(["review", "ranking", "score"]);

const ENTITY_PATHS = ["/actress", "/genre", "/maker", "/series"];

export const PUBLIC_CACHE_TASKS = new Set([
  "reserve",
  "new",
  "semi-new",
  "old",
  "sale",
  "ended-sale",
  "stage",
  "review",
  "ranking",
  "score",
  "missing-prices",
  "sample-movie",
]);

export type PublicCacheRevalidationOptions = {
  workIds?: Iterable<string | number>;
};

export async function revalidatePublicCacheForTasks(
  tasks: string[],
  options: PublicCacheRevalidationOptions = {},
) {
  const knownTasks = [...new Set(tasks)].filter((task) => PUBLIC_CACHE_TASKS.has(task));
  if (knownTasks.length === 0) return { tasks: [], paths: [], tags: [] };

  const paths = new Set<string>();
  const tags = new Set<string>();
  const productIds = [...(options.workIds ?? [])]
      .map((id) => String(id).trim())
      .filter(Boolean);
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

  if (knownTasks.some((task) => CATALOG_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) {
      paths.add(path);
    }
    tags.add("home-catalog");
    tags.add("home-daily-discovery");
    tags.add("entity-works");
  }
  if (knownTasks.some((task) => PRICE_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/sale", "/deals", "/ranking"]) paths.add(path);
    tags.add("home-price-insights");
    tags.add("hero-price-drop");
    tags.add("deals");
    tags.add("entity-works");
  }
  if (knownTasks.some((task) => DISCOVERY_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) paths.add(path);
    tags.add("home-ranking");
    tags.add("ai-discoveries");
    tags.add("latest-daily-update");
    tags.add("entity-works");
  }

  for (const path of paths) revalidatePath(path);

  for (const tag of tags) revalidateTag(tag, tag === "home-price-insights" ? "max" : { expire: 0 });
  for (const tag of workTags) revalidateTag(tag, { expire: 0 });

  return {
    tasks: knownTasks,
    paths: [...paths],
    tags: [...tags, ...workTags],
    // Work detail caches are fully covered by their two data tags above:
    // one for the works row and one for product-keyed offers/history/images.
    // Avoid an additional per-work revalidatePath call.
    workPaths: [],
  };
}
