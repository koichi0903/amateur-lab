import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicCacheRevalidationPlan } from "./publicCacheRevalidationPlan";

test("public cache plan deduplicates tasks and combines catalog, price, and discovery targets", () => {
  const plan = buildPublicCacheRevalidationPlan(["new", "sale", "ranking", "new", "unknown"]);

  assert.deepEqual(plan, {
    tasks: ["new", "sale", "ranking"],
    paths: ["/", "/new", "/ranking", "/features", "/actress", "/genre", "/maker", "/sitemap.xml", "/sale", "/deals"],
    tags: [
      "home-catalog",
      "home-daily-discovery",
      "entity-works",
      "home-price-insights",
      "hero-price-drop",
      "deals",
      "home-ranking",
      "ai-discoveries",
      "latest-daily-update",
    ],
    includesAmateurApiCatalog: false,
  });
});

test("amateur catalog task selects public and dynamic catalog pages", () => {
  const plan = buildPublicCacheRevalidationPlan(["amateur-api-catalog"]);

  assert.deepEqual(plan.tasks, ["amateur-api-catalog"]);
  assert.deepEqual(plan.paths, ["/amateur", "/amateur/search", "/amateur/sale", "/amateur/genre", "/amateur/maker"]);
  assert.deepEqual(plan.tags, ["fanza-amateur-home", "fanza-amateur-catalog"]);
  assert.equal(plan.includesAmateurApiCatalog, true);
});

test("known standalone task has no broad page or tag targets", () => {
  assert.deepEqual(buildPublicCacheRevalidationPlan(["sample-movie"]), {
    tasks: ["sample-movie"],
    paths: [],
    tags: [],
    includesAmateurApiCatalog: false,
  });
});

test("unknown tasks produce an empty plan", () => {
  assert.deepEqual(buildPublicCacheRevalidationPlan(["unknown", "unknown"]), {
    tasks: [],
    paths: [],
    tags: [],
    includesAmateurApiCatalog: false,
  });
});
