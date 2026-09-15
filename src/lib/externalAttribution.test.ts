import assert from "node:assert/strict";
import test from "node:test";
import { isOperatorLandingPath } from "./externalAttribution.ts";

test("管理画面を起点にしたアクセスを運用者トラフィックとして判定する", () => {
  for (const path of ["/admin", "/admin/", "/admin/update", "/admin/revenue?days=30"])
    assert.equal(isOperatorLandingPath(path), true);
});

test("通常ページやadminに似たパスは除外しない", () => {
  for (const path of ["/", "/works/112", "/administrator", "/admin-guide"])
    assert.equal(isOperatorLandingPath(path), false);
});
