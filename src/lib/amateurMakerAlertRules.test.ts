import assert from "node:assert/strict";
import test from "node:test";

import {
  amateurMakerAlertDeliveryKey,
  amateurMakerAlertNames,
  amateurMakerNames,
  matchesAmateurMakerAlert,
  type AmateurMakerAlertRule,
  type AmateurMakerAlertWork,
} from "./amateurMakerAlertRules";

const works: AmateurMakerAlertWork[] = [
  {
    content_id: "content-1",
    title: "First work",
    raw_item: { iteminfo: { maker: [{ name: " Maker One " }, { name: "Maker One" }, { name: "Maker Two" }] } },
  },
  { content_id: "content-2", title: "No maker", raw_item: { iteminfo: { maker: [] } } },
];

test("normalizes valid maker names and ignores malformed rows", () => {
  assert.deepEqual(amateurMakerNames(works[0].raw_item), ["Maker One", "Maker Two"]);
  assert.deepEqual(amateurMakerNames(null), []);
  assert.deepEqual(amateurMakerNames({ iteminfo: { maker: [null, {}, { name: "  " }, { name: 4 }] } }), []);
});

test("collects unique maker alert names across works", () => {
  assert.deepEqual(amateurMakerAlertNames(works), ["Maker One", "Maker Two"]);
});

test("matches an alert by exact maker name and constructs a stable delivery key", () => {
  const alert: AmateurMakerAlertRule = { endpoint: "endpoint", maker_name: "Maker Two" };
  assert.equal(matchesAmateurMakerAlert(alert, works[0]), true);
  assert.equal(matchesAmateurMakerAlert(alert, works[1]), false);
  assert.equal(amateurMakerAlertDeliveryKey("ep", "Maker Two", "content-1"), "ep\u0000Maker Two\u0000content-1");
});
