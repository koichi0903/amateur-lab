import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDmmActressProfile } from "./actressProfileNormalization.ts";

test("normalizes DMM actress fields and preserves the existing profile record shape", () => {
  const normalized = normalizeDmmActressProfile({
    actress_id: "12345",
    name: "  女優名  ",
    ruby: " よみ ",
    birthday: "1995-02-03",
    height: "165",
    bust: "90.5",
    waist: "60",
    hip: "88",
    cup: " F ",
    blood_type: " A ",
    hobby: " 読書 ",
    prefectures: " 東京都 ",
    imageURL: { small: "http://example.com/small.jpg", large: "https://example.com/large.jpg" },
    listURL: { digital: "https://example.com/actress" },
  }, () => new Date("2026-10-30T00:00:00.000Z"));

  assert.deepEqual(normalized, {
    dmm_actress_id: "12345",
    name: "女優名",
    ruby: "よみ",
    birthday: "1995-02-03",
    height_cm: 165,
    bust_cm: 90.5,
    waist_cm: 60,
    hip_cm: 88,
    cup: "F",
    blood_type: "A",
    hobby: "読書",
    prefectures: "東京都",
    image_url_small: "https://example.com/small.jpg",
    image_url_large: "https://example.com/large.jpg",
    fanza_digital_url: "https://example.com/actress",
    updated_at: "2026-10-30T00:00:00.000Z",
  });
});

test("rejects missing identity and preserves measurement parsing rules", () => {
  assert.equal(normalizeDmmActressProfile({ name: "女優名" }), null);
  assert.equal(normalizeDmmActressProfile({ id: 10, name: "  " }), null);

  const normalized = normalizeDmmActressProfile({ id: 10, name: "女優名", height: "165cm", bust: -1 });
  assert.equal(normalized?.height_cm, null);
  assert.equal(normalized?.bust_cm, -1);
});
