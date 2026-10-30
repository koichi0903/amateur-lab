import assert from "node:assert/strict";
import test from "node:test";
import type { XDailyTopPick } from "@/lib/xGrowthTypes";
import { finalizeXGrowthMediaMix } from "./xGrowthFinalMediaMix.ts";

function pick(workId: number, mediaType: string, slotId?: "slot_1" | "slot_2" | "slot_3") {
  return {
    workId,
    productId: `product-${workId}`,
    sampleMovieUrl: mediaType === "sample_movie" ? `https://example.com/${workId}.mp4` : null,
    imageUrl: mediaType === "existing_link_image" ? `https://example.com/${workId}.jpg` : null,
    mediaType,
    slotId,
  } as XDailyTopPick;
}

const baseMediaMix = { targetVideos: 2, selectedVideos: 0, unmetReason: null };

test("counts final videos by slot and preserves the uniqueness audit", () => {
  const result = finalizeXGrowthMediaMix(
    baseMediaMix,
    [pick(1, "sample_movie", "slot_1"), pick(2, "sample_movie", "slot_3"), pick(3, "existing_link_image")],
    new Set(),
  );

  assert.equal(result.selectedVideos, 2);
  assert.equal(result.selectedVideosAfterReplenishment, 2);
  assert.deepEqual(result.selectedVideosBySlot, { slot_1: 1, slot_3: 1 });
  assert.equal(result.unmetReason, null);
  assert.equal(result.uniqueAudit.passed, true);
});

test("adds an unmet reason only when selected videos are below target", () => {
  const fallback = finalizeXGrowthMediaMix(baseMediaMix, [pick(1, "sample_movie")], new Set());
  const preserved = finalizeXGrowthMediaMix({ ...baseMediaMix, unmetReason: "候補不足" }, [pick(1, "sample_movie")], new Set());

  assert.match(fallback.unmetReason ?? "", /最終Diversity Gate後/);
  assert.equal(preserved.unmetReason, "候補不足");
});
