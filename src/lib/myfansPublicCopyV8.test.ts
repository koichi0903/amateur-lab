import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansLinkStrategy, PublicCopyFacts } from "./myfansXExecution";
import { buildPublicCopyV8 } from "./myfansPublicCopyGeneration";

function facts(overrides: Partial<PublicCopyFacts> = {}): PublicCopyFacts {
  return {
    sourceText: "",
    creatorName: "作者A",
    creatorHandle: "@creator",
    publicMetrics: {
      views: 0,
      likes: null,
      reposts: null,
      replies: null,
      popularityRank: null,
      productLikes: 0,
      productSaves: 0,
      price: 0,
      isNew: false,
    },
    visualContext: "text_only",
    quoteVisualAnalysis: null,
    productFacts: { title: "作品A", genre: "" },
    ...overrides,
  };
}

test("V8 prioritizes source text and preserves body-link disclosure copy", () => {
  const copy = buildPublicCopyV8(facts({ sourceText: "先に距離が変わる", visualContext: "video" }), "body_link_sales", "body_link" satisfies MyfansLinkStrategy, 0);

  assert.deepEqual(copy, [
    "「先に距離が変わる」はさすがに目が止まる。 #PR",
    "気になる人だけ詳細へ。",
  ]);
});

test("V8 keeps text-only discovery copy and profile-CTA social-proof fallback", () => {
  assert.deepEqual(buildPublicCopyV8(facts(), "discovery", "no_link", 0), [
    "この入り方ずるい。",
    "この切り取りだけで気になってしまう。",
  ]);

  assert.deepEqual(buildPublicCopyV8(facts({
    visualContext: "video",
    publicMetrics: { ...facts().publicMetrics, views: 100_000 },
  }), "discovery", "profile_cta", 4), [
    "これ流れてきたら一回開く。",
    "好みならプロフィールまで見たくなる。",
  ]);
});
