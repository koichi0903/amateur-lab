import assert from "node:assert/strict";
import test from "node:test";
import type { XMediaAsset } from "@/lib/xMediaAssets";
import { selectPreferredXMediaAssetsByWork } from "./xGrowthMediaAssetSelection.ts";

function asset(input: Partial<XMediaAsset> & Pick<XMediaAsset, "id" | "work_id" | "media_type">): XMediaAsset {
  return {
    account_handle: "hakkutsu_lab",
    product_id: null,
    source_url: `https://video.example/${input.id}.mp4`,
    source_domain: "video.example",
    source_kind: "unknown_external",
    mime_type: "video/mp4",
    content_length: 100,
    fetch_status: "ok",
    fetch_status_code: 200,
    last_checked_at: "now",
    rights_status: "unknown",
    rights_basis_type: null,
    rights_basis_url: null,
    evidence_ref: null,
    rights_basis_note: null,
    reviewed_at: null,
    reviewed_by: null,
    review_source: null,
    x_usage_allowed: false,
    can_reupload: false,
    can_modify: false,
    quote_only: true,
    commercial_use_allowed: false,
    media_quality: "normal",
    manual_tags: [],
    trim_start_seconds: null,
    trim_reviewed_at: null,
    trim_reviewed_by: null,
    trim_review_source: null,
    trim_modify_confirmed: false,
    trim_note: null,
    notes: "",
    ...input,
  };
}

const isUsable = (candidate: XMediaAsset | undefined) => candidate?.fetch_status === "ok";

test("prefers technically usable video assets and then a strong first-seconds asset", () => {
  const unusable = asset({ id: 1, work_id: 10, media_type: "video", fetch_status: "dead" });
  const usable = asset({ id: 2, work_id: 10, media_type: "sample_movie" });
  const strong = asset({
    id: 3,
    work_id: 10,
    media_type: "video",
    media_quality: "strong",
    manual_tags: ["first_seconds_strong"],
  });
  const selected = selectPreferredXMediaAssetsByWork([unusable, usable, strong], isUsable);
  assert.equal(selected.get(10), strong);
});

test("keeps the first row on equivalent quality and skips non-video or missing-work rows", () => {
  const first = asset({ id: 4, work_id: 20, media_type: "video" });
  const equivalent = asset({ id: 5, work_id: 20, media_type: "sample_movie" });
  const image = asset({ id: 6, work_id: 20, media_type: "image" });
  const noWork = asset({ id: 7, work_id: null, media_type: "video" });
  const selected = selectPreferredXMediaAssetsByWork([first, equivalent, image, noWork], isUsable);
  assert.deepEqual([...selected.keys()], [20]);
  assert.equal(selected.get(20), first);
});

test("technical usability takes priority over opening strength", () => {
  const unusableStrong = asset({
    id: 8,
    work_id: 30,
    media_type: "video",
    fetch_status: "dead",
    media_quality: "strong",
    manual_tags: ["first_seconds_strong"],
  });
  const usableNormal = asset({ id: 9, work_id: 30, media_type: "sample_movie", fetch_status: "ok" });

  const selected = selectPreferredXMediaAssetsByWork([unusableStrong, usableNormal], isUsable);

  assert.equal(selected.get(30), usableNormal);
});
