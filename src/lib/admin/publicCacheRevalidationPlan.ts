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

export type PublicCacheRevalidationPlan = {
  tasks: string[];
  paths: string[];
  tags: string[];
  includesAmateurApiCatalog: boolean;
};

function addCatalogTargets(tasks: string[], paths: Set<string>, tags: Set<string>) {
  if (!tasks.some((task) => CATALOG_TASKS.has(task))) return;
  paths.add("/");
  for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) paths.add(path);
  tags.add("home-catalog");
  tags.add("home-daily-discovery");
  tags.add("entity-works");
}

function addPriceTargets(tasks: string[], paths: Set<string>, tags: Set<string>) {
  if (!tasks.some((task) => PRICE_TASKS.has(task))) return;
  paths.add("/");
  for (const path of ["/sale", "/deals", "/ranking"]) paths.add(path);
  tags.add("home-price-insights");
  tags.add("hero-price-drop");
  tags.add("deals");
  tags.add("entity-works");
}

function addDiscoveryTargets(tasks: string[], paths: Set<string>, tags: Set<string>) {
  if (!tasks.some((task) => DISCOVERY_TASKS.has(task))) return;
  paths.add("/");
  for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) paths.add(path);
  tags.add("home-ranking");
  tags.add("ai-discoveries");
  tags.add("latest-daily-update");
  tags.add("entity-works");
}

function addAmateurCatalogTargets(paths: Set<string>, tags: Set<string>) {
  for (const path of ["/amateur", "/amateur/search", "/amateur/sale", "/amateur/genre", "/amateur/maker"]) {
    paths.add(path);
  }
  tags.add("fanza-amateur-home");
  tags.add("fanza-amateur-catalog");
}

export function buildPublicCacheRevalidationPlan(tasks: string[]): PublicCacheRevalidationPlan {
  const knownTasks = [...new Set(tasks)].filter((task) => PUBLIC_CACHE_TASKS.has(task));
  if (knownTasks.length === 0) {
    return { tasks: [], paths: [], tags: [], includesAmateurApiCatalog: false };
  }

  const paths = new Set<string>();
  const tags = new Set<string>();
  addCatalogTargets(knownTasks, paths, tags);
  addPriceTargets(knownTasks, paths, tags);
  addDiscoveryTargets(knownTasks, paths, tags);
  const includesAmateurApiCatalog = knownTasks.includes("amateur-api-catalog");
  if (includesAmateurApiCatalog) addAmateurCatalogTargets(paths, tags);

  return {
    tasks: knownTasks,
    paths: [...paths],
    tags: [...tags],
    includesAmateurApiCatalog,
  };
}
