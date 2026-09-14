import { revalidatePath, revalidateTag } from "next/cache";

const CATALOG_TASKS = new Set(["reserve", "new", "semi-new", "old", "stage"]);
const PRICE_TASKS = new Set(["sale", "ended-sale", "missing-prices"]);
const DISCOVERY_TASKS = new Set(["review", "ranking", "score"]);

const ENTITY_PATHS = ["/actress", "/genre", "/maker", "/series"];
const ENTITY_DETAIL_PATHS = ["/actress/[name]", "/genre/[name]", "/maker/[name]", "/series/[name]"];
const WORK_DETAIL_CACHE_TAG = "work-detail";
const HOME_CACHE_TAGS = [
  "home-daily-discovery",
  "hero-price-drop",
  "home-price-insights",
  "ai-discoveries",
  "latest-daily-update",
  "home-ranking",
  "home-catalog",
  "deals",
] as const;

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

export function revalidatePublicCacheForTasks(tasks: string[]) {
  const knownTasks = tasks.filter((task) => PUBLIC_CACHE_TASKS.has(task));
  if (knownTasks.length === 0) return { tasks: [], paths: [], tags: [] };

  if (
    knownTasks.length === 1 &&
    knownTasks[0] === "score" &&
    process.env.ENABLE_BROAD_SCORE_REVALIDATE !== "true"
  ) {
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidateTag("home-ranking", "max");
    return { tasks: knownTasks, paths: ["/", "/ranking"], tags: ["home-ranking"] };
  }

  const paths = new Set(["/"]);
  const tags = new Set<string>([WORK_DETAIL_CACHE_TAG, ...HOME_CACHE_TAGS]);

  if (knownTasks.some((task) => CATALOG_TASKS.has(task))) {
    for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) {
      paths.add(path);
    }
  }
  if (knownTasks.some((task) => PRICE_TASKS.has(task))) {
    for (const path of ["/sale", "/deals", "/ranking"]) paths.add(path);
  }
  if (knownTasks.some((task) => DISCOVERY_TASKS.has(task))) {
    for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) paths.add(path);
  }

  for (const path of paths) revalidatePath(path);
  revalidatePath("/works/[id]", "page");
  for (const path of ENTITY_DETAIL_PATHS) revalidatePath(path, "page");

  revalidateTag(WORK_DETAIL_CACHE_TAG, "max");
  for (const tag of HOME_CACHE_TAGS) {
    revalidateTag(tag, tag === "home-price-insights" ? "max" : { expire: 0 });
  }

  return { tasks: knownTasks, paths: [...paths], tags: [...tags] };
}
