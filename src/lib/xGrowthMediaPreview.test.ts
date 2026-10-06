import assert from "node:assert/strict";
import test from "node:test";
import { ensureXGrowthMediaPreviewUrl, xGrowthMediaPreviewUrl, xGrowthMediaResponseHeaders } from "./xGrowthMediaPreview.ts";

test("sample movie preview URL uses the same-origin preview mode", () => {
  assert.equal(
    xGrowthMediaPreviewUrl({ workId: 602, mediaType: "sample_movie", mediaAssetId: 17 }),
    "/api/admin/x-growth/media/download?workId=602&mediaType=sample_movie&assetId=17&preview=1",
  );
});

test("preview headers keep range metadata and omit attachment", () => {
  const headers = xGrowthMediaResponseHeaders({
    contentType: "video/mp4",
    contentLength: "1024",
    contentRange: "bytes 0-1023/59982274",
    acceptRanges: "bytes",
    preview: true,
    filename: "sample.mp4",
  });
  assert.equal(headers.get("content-type"), "video/mp4");
  assert.equal(headers.get("content-length"), "1024");
  assert.equal(headers.get("content-range"), "bytes 0-1023/59982274");
  assert.equal(headers.get("accept-ranges"), "bytes");
  assert.equal(headers.get("content-disposition"), null);
});

test("legacy saved player source is upgraded to preview mode", () => {
  assert.equal(
    ensureXGrowthMediaPreviewUrl("/api/admin/x-growth/media/download?workId=602&mediaType=sample_movie&assetId=3378"),
    "/api/admin/x-growth/media/download?workId=602&mediaType=sample_movie&assetId=3378&preview=1",
  );
});

test("download headers retain attachment", () => {
  const headers = xGrowthMediaResponseHeaders({
    contentType: "video/mp4",
    preview: false,
    filename: "sample.mp4",
  });
  assert.equal(headers.get("content-disposition"), 'attachment; filename="sample.mp4"');
});
