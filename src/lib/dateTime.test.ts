import assert from "node:assert/strict";
import test from "node:test";
import { formatJstDateTime, formatJapanDateTime } from "./dateTime.ts";

test("formatJstDateTime uses the shared Japan date and time display", () => {
  assert.equal(formatJstDateTime("2026-10-29T00:00:00.000Z"), "10/29 09:00");
});

test("database date formatting keeps its null and naive timestamp contract", () => {
  assert.equal(formatJapanDateTime(null), null);
  assert.equal(formatJapanDateTime("2026-10-29T00:00:00"), "10/29 09:00");
});
