import assert from "node:assert/strict";
import test from "node:test";
import {
  inferBlueskyShareAttribution,
  isOperatorLandingPath,
} from "./externalAttribution.ts";

test("管理画面を起点にしたアクセスを運用者トラフィックとして判定する", () => {
  for (const path of ["/admin", "/admin/", "/admin/update", "/admin/revenue?days=30"])
    assert.equal(isOperatorLandingPath(path), true);
});

test("通常ページやadminに似たパスは除外しない", () => {
  for (const path of ["/", "/works/112", "/administrator", "/admin-guide"])
    assert.equal(isOperatorLandingPath(path), false);
});

test("referrerがないBluesky share URLをsocial/blueskyとして分類する", () => {
  assert.deepEqual(
    inferBlueskyShareAttribution(
      { channel: "direct", source: "direct" },
      "?utm_source=bluesky&share=bluesky-20261101-scute1583-01",
    ),
    { channel: "social", source: "bluesky" },
  );
});

test("既存referrerとBluesky以外のshare sourceは変更しない", () => {
  assert.deepEqual(
    inferBlueskyShareAttribution(
      { channel: "social", source: "bsky.app" },
      "?share=bluesky-20261101-scute1583-01",
    ),
    { channel: "social", source: "bsky.app" },
  );
  assert.deepEqual(
    inferBlueskyShareAttribution(
      { channel: "direct", source: "direct" },
      "?share=xpost-20261101-scute1583-01",
    ),
    { channel: "direct", source: "direct" },
  );
});
