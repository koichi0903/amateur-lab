import assert from "node:assert/strict";
import test from "node:test";

import { buildMiniPriceChartGeometry } from "./miniPriceChart";

test("価格履歴を間引かず実際の日時で配置する", () => {
  const geometry = buildMiniPriceChartGeometry({
    points: [
      { price: 1000, changedAt: "2026-06-01T00:00:00Z" },
      { price: 800, changedAt: "2026-06-10T00:00:00Z" },
      { price: 500, changedAt: "2026-08-30T00:00:00Z" },
    ],
    windowStartAt: "2026-06-01T00:00:00Z",
    windowEndAt: "2026-08-30T00:00:00Z",
    width: 200,
    height: 80,
  });

  assert.equal(geometry.points.length, 3);
  assert.ok(geometry.points[1].x < 50, "9日後の点は90日幅の左側に配置される");
  assert.match(geometry.stepPath, /H .* V /);
});

test("値下げと値上げを各履歴点で判定する", () => {
  const geometry = buildMiniPriceChartGeometry({
    points: [
      { price: 1000, changedAt: "2026-06-01T00:00:00Z" },
      { price: 500, changedAt: "2026-07-01T00:00:00Z" },
      { price: 700, changedAt: "2026-08-01T00:00:00Z" },
    ],
    windowStartAt: "2026-06-01T00:00:00Z",
    windowEndAt: "2026-08-30T00:00:00Z",
    width: 200,
    height: 80,
  });

  assert.deepEqual(geometry.points.map((point) => point.movement), ["same", "down", "up"]);
});
