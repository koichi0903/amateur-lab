import assert from "node:assert/strict";
import test from "node:test";

import {
  getSeriesAlertEntityNames,
  matchesSeriesAlertWork,
  seriesAlertDeliveryKey,
  type SeriesAlertRule,
  type SeriesAlertWork,
} from "./pushSeriesAlertRules";

const works: SeriesAlertWork[] = [
  {
    id: 10,
    product_id: "abc-10",
    title: "Actress work",
    actress: "青木, 山田",
    maker: "Maker One",
    series: null,
  },
  {
    id: 11,
    product_id: "abc-11",
    title: "Maker work",
    actress: "山田",
    maker: "Maker Two",
    series: null,
  },
];

test("collects unique actress and maker alert names", () => {
  assert.deepEqual(getSeriesAlertEntityNames(works), ["青木", "山田", "Maker One", "Maker Two"]);
});

test("matches only the entity field selected by the alert type", () => {
  const actressAlert: SeriesAlertRule = {
    endpoint: "endpoint",
    alert_type: "actress",
    series_name: "青木",
  };
  const makerAlert: SeriesAlertRule = {
    endpoint: "endpoint",
    alert_type: "maker",
    series_name: "Maker One",
  };

  assert.equal(matchesSeriesAlertWork(actressAlert, works[0]), true);
  assert.equal(matchesSeriesAlertWork(actressAlert, works[1]), false);
  assert.equal(matchesSeriesAlertWork(makerAlert, works[0]), true);
  assert.equal(matchesSeriesAlertWork(makerAlert, works[1]), false);
});

test("creates the same stable delivery identity from its four fields", () => {
  assert.equal(seriesAlertDeliveryKey("ep", "maker", "Maker One", 10), "ep\u0000maker\u0000Maker One\u000010");
});
