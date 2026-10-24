import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAffiliateSource,
  workDetailHref,
} from "./affiliateTracking.ts";

test("work detail links keep attribution in a fragment, not a crawlable query", () => {
  assert.equal(workDetailHref(39697, "actress"), "/works/39697#from=actress");
});

test("affiliate source parsing supports fragment links and legacy query links", () => {
  assert.equal(resolveAffiliateSource("", "#from=actress", "direct"), "actress");
  assert.equal(resolveAffiliateSource("?from=ranking", "", "direct"), "ranking");
  assert.equal(resolveAffiliateSource("?from=ranking", "#from=actress", "direct"), "actress");
  assert.equal(resolveAffiliateSource("", "#from=unknown", "sale"), "direct");
});
