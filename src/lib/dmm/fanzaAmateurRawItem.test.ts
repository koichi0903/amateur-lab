import assert from "node:assert/strict";
import test from "node:test";
import { getFanzaAmateurPriceFromRawItem } from "./fanzaAmateurRawItem";

test("reads numeric and string prices from DMM raw items", () => {
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: { price: 1200 } }), 1200);
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: { price: "1200円" } }), 1200);
});

test("rejects malformed, non-positive, and unsafe raw item prices", () => {
  assert.equal(getFanzaAmateurPriceFromRawItem(null), null);
  assert.equal(getFanzaAmateurPriceFromRawItem([]), null);
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: [] }), null);
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: { price: "無料" } }), null);
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: { price: 0 } }), null);
  assert.equal(getFanzaAmateurPriceFromRawItem({ prices: { price: Number.MAX_SAFE_INTEGER + 1 } }), null);
});
