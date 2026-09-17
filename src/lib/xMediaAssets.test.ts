import assert from "node:assert/strict";
import { canTrimOfficialSampleMovie, isPostableOfficialSampleMovie, isUsableXMediaAsset, type XMediaAsset, type XMediaManualTag } from "./xMediaAssets";

const base: Partial<XMediaAsset> = {
  rights_status: "allowed",
  x_usage_allowed: true,
  can_reupload: true,
  quote_only: false,
  commercial_use_allowed: true,
  fetch_status: "ok",
  media_quality: "normal",
  manual_tags: [] as XMediaManualTag[],
};

assert.equal(isUsableXMediaAsset({ ...base, rights_status: "unknown" }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, x_usage_allowed: false }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, can_reupload: false }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, quote_only: true }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, fetch_status: "dead" }).usable, false);
assert.equal(isUsableXMediaAsset(base).usable, true);

const officialSample: Partial<XMediaAsset> = {
  ...base,
  source_url: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4",
  source_kind: "official_sample",
  rights_status: "unknown",
  x_usage_allowed: false,
  can_reupload: false,
  quote_only: true,
  commercial_use_allowed: false,
  can_modify: false,
  trim_modify_confirmed: false,
};

assert.equal(isUsableXMediaAsset(officialSample).usable, false);
assert.equal(isPostableOfficialSampleMovie(officialSample).usable, true);
assert.equal(isPostableOfficialSampleMovie({ ...officialSample, fetch_status: "dead" }).usable, false);
assert.equal(isPostableOfficialSampleMovie({ ...officialSample, media_quality: "weak" }).usable, false);
assert.equal(canTrimOfficialSampleMovie(officialSample).usable, true);
assert.equal(canTrimOfficialSampleMovie({ ...officialSample, fetch_status: "forbidden" }).usable, false);
