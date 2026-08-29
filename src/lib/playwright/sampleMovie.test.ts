import assert from "node:assert/strict";
import test from "node:test";

import { isSampleMovieUrl } from "./sampleMovie.ts";

test("accepts FANZA sample movie URLs with query parameters", () => {
  assert.equal(
    isSampleMovieUrl("https://cc3001.dmm.co.jp/path/mngs00071mhb.mp4?token=abc"),
    true,
  );
});

test("accepts uppercase MP4 extensions and fragments", () => {
  assert.equal(
    isSampleMovieUrl("https://example.com/sample.MP4#preview"),
    true,
  );
});

test("rejects player pages and non-http media URLs", () => {
  assert.equal(
    isSampleMovieUrl("https://www.dmm.co.jp/service/digitalapi/-/html5_player/"),
    false,
  );
  assert.equal(isSampleMovieUrl("blob:https://example.com/sample"), false);
  assert.equal(isSampleMovieUrl(null), false);
});
