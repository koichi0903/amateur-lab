import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkEntityAlertPlans } from "./pushWorkEntityAlertPlan.ts";

test("push work alerts normalize available names and keep selected matches once", () => {
  assert.deepEqual(
    buildWorkEntityAlertPlans(
      { actress: "女優A / 女優B／女優C, 女優A", maker: "メーカーX、メーカーY" },
      { actressAlerts: ["女優B", "不明", "女優B"], makerAlerts: ["メーカーY"] },
    ),
    [
      { type: "actress", available: ["女優A", "女優B", "女優C"], selected: ["女優B"] },
      { type: "maker", available: ["メーカーX", "メーカーY"], selected: ["メーカーY"] },
    ],
  );
});

test("push work alerts keep empty selections and unavailable entity names", () => {
  assert.deepEqual(
    buildWorkEntityAlertPlans({ actress: null, maker: "メーカーX" }, { makerAlerts: ["other"] }),
    [
      { type: "actress", available: [], selected: [] },
      { type: "maker", available: ["メーカーX"], selected: [] },
    ],
  );
});
