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
  const workPaths = new Set<string>();
  const workTags = new Set<string>();
  if (productIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("works")
      .select("id, product_id")
      .in("product_id", productIds);
    if (error) throw error;
    for (const work of data ?? []) {
      const workId = String(work.id);
      const productId = String(work.product_id);
      workPaths.add(`/works/${encodeURIComponent(workId)}`);
      workTags.add(`work-detail:${workId}`);
      workTags.add(`work-detail-product:${productId}`);
    }
  }

  if (knownTasks.some((task) => CATALOG_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) {
      paths.add(path);
    }
    tags.add("home-catalog");
    tags.add("home-daily-discovery");
  }
  if (knownTasks.some((task) => PRICE_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/sale", "/deals", "/ranking"]) paths.add(path);
    tags.add("home-price-insights");
    tags.add("hero-price-drop");
    tags.add("deals");
  }
  if (knownTasks.some((task) => DISCOVERY_TASKS.has(task))) {
    paths.add("/");
    for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) paths.add(path);
    tags.add("home-ranking");
    tags.add("ai-discoveries");
    tags.add("latest-daily-update");
  }

  for (const path of workPaths) paths.add(path);
  for (const path of paths) revalidatePath(path);

  for (const tag of tags) revalidateTag(tag, tag === "home-price-insights" ? "max" : { expire: 0 });
  for (const tag of workTags) revalidateTag(tag, { expire: 0 });

  return {
    tasks: knownTasks,
    paths: [...paths],
    tags: [...tags, ...workTags],
    workPaths: [...workPaths],
  };
}
