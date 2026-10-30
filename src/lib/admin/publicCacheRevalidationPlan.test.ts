import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicCacheRevalidationPlan } from "./publicCacheRevalidationPlan.ts";

test("filters unknown tasks and preserves first-seen task order", () => {
  assert.deepEqual(buildPublicCacheRevalidationPlan(["unknown", "sale", "sale", "new"]), {
    tasks: ["sale", "new"],
    paths: ["/", "/new", "/ranking", "/features", "/actress", "/genre", "/maker", "/sitemap.xml", "/sale", "/deals"],
    tags: ["home-catalog", "home-daily-discovery", "entity-works", "home-price-insights", "hero-price-drop", "deals"],
    includesAmateurApiCatalog: false,
  });
});

test("plans amateur catalog paths, tags, and dynamic-page revalidation", () => {
  assert.deepEqual(buildPublicCacheRevalidationPlan(["amateur-api-catalog"]), {
    tasks: ["amateur-api-catalog"],
    paths: ["/amateur", "/amateur/search", "/amateur/sale", "/amateur/genre", "/amateur/maker"],
    tags: ["fanza-amateur-home", "fanza-amateur-catalog"],
    includesAmateurApiCatalog: true,
  });
});

test("returns an empty plan when no task is revalidatable", () => {
  assert.deepEqual(buildPublicCacheRevalidationPlan(["", "invalid"]), {
    tasks: [],
    paths: [],
    tags: [],
    includesAmateurApiCatalog: false,
  });
});
