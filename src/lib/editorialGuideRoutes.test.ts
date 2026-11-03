import assert from "node:assert/strict";
import test from "node:test";
import { resolveGuideLink } from "./editorialGuideRoutes.ts";

test("amateur guide links rewrite sale and guide paths", () => {
  assert.equal(resolveGuideLink("/sale?sort=price", "/amateur/guides", true), "/amateur/sale?sort=price");
  assert.equal(resolveGuideLink("/sale#discount", "/amateur/guides", true), "/amateur/sale#discount");
  assert.equal(resolveGuideLink("/guides/vr", "/amateur/guides", true), "/amateur/guides/vr");
  assert.equal(resolveGuideLink("/guides", "/amateur/guides", true), "/amateur/guides");
});

test("regular guide links and non-rewritten amateur links stay unchanged", () => {
  assert.equal(resolveGuideLink("/sale?sort=price", "/guides", false), "/sale?sort=price");
  assert.equal(resolveGuideLink("/ranking", "/amateur/guides", true), "/ranking");
  assert.equal(resolveGuideLink("https://example.test", "/amateur/guides", true), "https://example.test");
});
