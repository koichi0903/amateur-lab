import assert from "node:assert/strict";
import { canTrimOfficialSampleMovie, isFanzaXGrowthTechnicalSampleMovie, isPostableOfficialSampleMovie, isUsableXMediaAsset, type XMediaAsset, type XMediaManualTag, validateTrimStartSeconds } from "./xMediaAssets";

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
assert.equal(isUsableXMediaAsset({ ...base, fetch_status: "unknown" }).usable, false);
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
assert.equal(isPostableOfficialSampleMovie(officialSample).usable, false);
assert.equal(isPostableOfficialSampleMovie({ ...officialSample, rights_status: "allowed", x_usage_allowed: true, can_reupload: true, quote_only: false, commercial_use_allowed: true }).usable, true);
assert.equal(isPostableOfficialSampleMovie({ ...officialSample, fetch_status: "dead" }).usable, false);
assert.equal(isPostableOfficialSampleMovie({ ...officialSample, media_quality: "weak" }).usable, false);
assert.equal(canTrimOfficialSampleMovie(officialSample).usable, false);
assert.equal(canTrimOfficialSampleMovie({ ...officialSample, rights_status: "allowed", x_usage_allowed: true, can_reupload: true, quote_only: false, commercial_use_allowed: true }).usable, true);
assert.equal(canTrimOfficialSampleMovie({ ...officialSample, fetch_status: "forbidden" }).usable, false);
assert.equal(isFanzaXGrowthTechnicalSampleMovie({ ...officialSample, fetch_status: "forbidden", fetch_status_code: 403, mime_type: "text/html", content_length: 919 }).usable, true);
assert.equal(isFanzaXGrowthTechnicalSampleMovie({ ...officialSample, fetch_status: "dead", fetch_status_code: 404 }).usable, true);

assert.deepEqual(validateTrimStartSeconds(0, 12), { ok: true, value: 0 });
assert.equal(validateTrimStartSeconds(-0.1, 12).ok, false);
assert.equal(validateTrimStartSeconds(12, 12).ok, false);
assert.equal(validateTrimStartSeconds(12.1, 12).ok, false);
