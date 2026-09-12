import assert from "node:assert/strict";
import { canTrimXMediaAsset, isUsableXMediaAsset, validateTrimStartSeconds, type XMediaAsset, type XMediaManualTag } from "./xMediaAssets";

const base: Partial<XMediaAsset> = {
  rights_status: "allowed",
  x_usage_allowed: true,
  can_reupload: true,
  quote_only: false,
  commercial_use_allowed: true,
  fetch_status: "ok",
  media_quality: "normal",
  manual_tags: [] as XMediaManualTag[],
  can_modify: false,
};

assert.equal(isUsableXMediaAsset({ ...base, rights_status: "unknown" }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, x_usage_allowed: false }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, can_reupload: false }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, quote_only: true }).usable, false);
assert.equal(isUsableXMediaAsset({ ...base, fetch_status: "dead" }).usable, false);
assert.equal(isUsableXMediaAsset(base).usable, true);
assert.equal(canTrimXMediaAsset(base).usable, false);
assert.equal(canTrimXMediaAsset({ ...base, can_modify: true }).usable, true);
assert.deepEqual(validateTrimStartSeconds(0), { ok: true, value: 0 });
assert.deepEqual(validateTrimStartSeconds(5.34), { ok: true, value: 5.3 });
assert.equal(validateTrimStartSeconds(-0.1).ok, false);
assert.equal(validateTrimStartSeconds(Number.NaN).ok, false);
assert.equal(validateTrimStartSeconds(10, 10).ok, false);
assert.equal(validateTrimStartSeconds(9.9, 10).ok, true);
