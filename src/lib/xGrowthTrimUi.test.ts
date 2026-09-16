import assert from "node:assert/strict";
import { shouldShowTopPickTrimControls, trimPostButtonLabel } from "./xGrowthTrimUi";

assert.equal(shouldShowTopPickTrimControls({ mediaType: "sample_movie", mediaUrl: "/api/admin/x-growth/media/download?assetId=11", assetId: 11 }), true);
assert.equal(shouldShowTopPickTrimControls({ mediaType: "image", mediaUrl: "/image.png", assetId: 11 }), false);
assert.equal(trimPostButtonLabel(0), "動画を使ってX投稿");
assert.equal(trimPostButtonLabel(3.4), "トリム済み動画を使ってX投稿");

console.log("xGrowthTrimUi regression tests passed");
