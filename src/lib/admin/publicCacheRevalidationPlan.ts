const CATALOG_TASKS = new Set(["reserve", "new", "semi-new", "old", "stage"]);
const PRICE_TASKS = new Set(["sale", "ended-sale", "missing-prices"]);
const DISCOVERY_TASKS = new Set(["review", "ranking", "score"]);

const ENTITY_PATHS = ["/actress", "/genre", "/maker"];

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
  "amateur-api-catalog",
]);

type MutablePlan = {
  paths: Set<string>;
  tags: Set<string>;
};

export type PublicCacheRevalidationPlan = {
  tasks: string[];
  paths: string[];
  tags: string[];
  includesAmateurApiCatalog: boolean;
};

function addCatalogTargets(plan: MutablePlan) {
  plan.paths.add("/");
  for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) plan.paths.add(path);
  plan.tags.add("home-catalog");
  plan.tags.add("home-daily-discovery");
  plan.tags.add("entity-works");
}

function addPriceTargets(plan: MutablePlan) {
  plan.paths.add("/");
  for (const path of ["/sale", "/deals", "/ranking"]) plan.paths.add(path);
  plan.tags.add("home-price-insights");
  plan.tags.add("hero-price-drop");
  plan.tags.add("deals");
  plan.tags.add("entity-works");
}

function addDiscoveryTargets(plan: MutablePlan) {
  plan.paths.add("/");
  for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) plan.paths.add(path);
  plan.tags.add("home-ranking");
  plan.tags.add("ai-discoveries");
  plan.tags.add("latest-daily-update");
  plan.tags.add("entity-works");
}

function addAmateurCatalogTargets(plan: MutablePlan, tasks: string[]) {
  if (!tasks.includes("amateur-api-catalog")) return false;
  for (const path of ["/amateur", "/amateur/search", "/amateur/sale", "/amateur/genre", "/amateur/maker"]) {
    plan.paths.add(path);
  }
  plan.tags.add("fanza-amateur-home");
  plan.tags.add("fanza-amateur-catalog");
  return true;
}

export function buildPublicCacheRevalidationPlan(tasks: string[]): PublicCacheRevalidationPlan {
  const knownTasks = [...new Set(tasks)].filter((task) => PUBLIC_CACHE_TASKS.has(task));
  const plan: MutablePlan = { paths: new Set(), tags: new Set() };
  if (knownTasks.some((task) => CATALOG_TASKS.has(task))) addCatalogTargets(plan);
  if (knownTasks.some((task) => PRICE_TASKS.has(task))) addPriceTargets(plan);
  if (knownTasks.some((task) => DISCOVERY_TASKS.has(task))) addDiscoveryTargets(plan);
  const includesAmateurApiCatalog = addAmateurCatalogTargets(plan, knownTasks);

  return {
    tasks: knownTasks,
    paths: [...plan.paths],
    tags: [...plan.tags],
    includesAmateurApiCatalog,
  };
}
