import assert from "node:assert/strict";
import test from "node:test";
import { buildFanzaAmateurSamplePlayerUrl } from "./fanzaAmateurSamplePlayer.ts";

test("builds the player URL from the preferred approved sample URL", () => {
  const result = buildFanzaAmateurSamplePlayerUrl({
    size_476_306: "https://www.dmm.co.jp/litevideo/-/cid=preferred/",
    size_560_360: "https://www.dmm.co.jp/litevideo/-/cid=fallback/",
  }, "catalog-id", "affiliate-id");

  assert.ok(result);
  assert.match(result, /\/cid=preferred\//);
  assert.match(result, /affi_id=affiliate-id/);
});

test("falls back to the catalog content ID when the sample URL has no CID segment", () => {
  const result = buildFanzaAmateurSamplePlayerUrl({
    size_720_480: "https://www.dmm.co.jp/litevideo/sample/",
  }, "catalog-id", "affiliate-id");

  assert.ok(result);
  assert.match(result, /\/cid=catalog-id\//);
});

test("rejects non-HTTPS, non-DMM, and non-litevideo sample URLs", () => {
  for (const sampleUrl of [
    "http://www.dmm.co.jp/litevideo/-/cid=work/",
    "https://example.com/litevideo/-/cid=work/",
    "https://www.dmm.co.jp/other/-/cid=work/",
  ]) {
    assert.equal(buildFanzaAmateurSamplePlayerUrl({ size_476_306: sampleUrl }, "catalog-id", "affiliate-id"), null);
  }
});
