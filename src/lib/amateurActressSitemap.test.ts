import assert from "node:assert/strict";
import test from "node:test";
import { getAmateurActressSitemapPaths, getAmateurActressSitemapUrls } from "./amateurActressSitemap.ts";

test("女優サイトマップの分割数はインデックスAPIの総ページ数に一致する", () => {
  assert.equal(getAmateurActressSitemapPaths(27).length, 27);
  assert.deepEqual(getAmateurActressSitemapPaths(2), [
    "/sitemaps/amateur-actress-1.xml",
    "/sitemaps/amateur-actress-2.xml",
  ]);
  assert.deepEqual(getAmateurActressSitemapPaths(Number.NaN), []);
});

test("女優サイトマップURLは有効な対象だけを安全にエンコードして返す", () => {
  assert.deepEqual(
    getAmateurActressSitemapUrls(
      [
        { name: "女優 A", work_count: 3 },
        { name: "   ", work_count: 5 },
        { name: "件数なし", work_count: 0 },
      ],
      "https://hakkutsu-lab.com",
    ),
    ["https://hakkutsu-lab.com/amateur/actress/%E5%A5%B3%E5%84%AA%20A"],
  );
});
