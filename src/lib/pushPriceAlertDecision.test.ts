import assert from "node:assert/strict";
import test from "node:test";
import { decidePriceAlert, isGonePushEndpointError } from "./pushPriceAlertDecision.ts";

test("price alert baselines first observation and only sends when price drops", () => {
  assert.equal(decidePriceAlert(1200, null), "initialize");
  assert.equal(decidePriceAlert(1200, 1200), "unchanged");
  assert.equal(decidePriceAlert(1300, 1200), "advance_baseline");
  assert.equal(decidePriceAlert(1100, 1200), "notify");
});

test("only numeric 404 and 410 push errors mark a subscription as gone", () => {
  assert.equal(isGonePushEndpointError({ statusCode: 404 }), true);
  assert.equal(isGonePushEndpointError({ statusCode: 410 }), true);
  assert.equal(isGonePushEndpointError({ statusCode: "410" }), false);
  assert.equal(isGonePushEndpointError(new Error("network")), false);
  assert.equal(isGonePushEndpointError(null), false);
});
