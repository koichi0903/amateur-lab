import assert from "node:assert/strict";
import test from "node:test";
import { intValue, text } from "./formDataValues";

test("normalizes and trims FormData text", () => {
  const formData = new FormData();
  formData.set("account", "  ｈａｋｋｕｔｓｕ＿ｌａｂ  ");
  assert.equal(text(formData, "account"), "hakkutsu_lab");
  assert.equal(text(formData, "missing"), "");
});

test("parses non-negative rounded integer values", () => {
  const formData = new FormData();
  formData.set("count", "¥1,234.5");
  formData.set("negative", "-7");
  formData.set("invalid", "n/a");
  assert.equal(intValue(formData, "count"), 1235);
  assert.equal(intValue(formData, "negative"), 0);
  assert.equal(intValue(formData, "invalid"), 0);
});
