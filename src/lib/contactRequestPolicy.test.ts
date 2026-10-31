import assert from "node:assert/strict";
import test from "node:test";
import { buildContactEmailText, validateContactRequest } from "./contactRequestPolicy";

const configuredRequest = {
  contactEmail: "owner@example.test",
  from: "site@example.test",
  apiKey: "configured",
  origin: "https://hakkutsu-lab.com",
  requestHost: "hakkutsu-lab.com",
  contentLength: 1_000,
};

test("contact request policy preserves setup, origin, and size rejection boundaries", () => {
  assert.deepEqual(
    validateContactRequest({ ...configuredRequest, contactEmail: undefined }),
    { message: "お問い合わせ窓口は現在準備中です。", status: 503 },
  );
  assert.deepEqual(
    validateContactRequest({ ...configuredRequest, origin: "https://other.example" }),
    { message: "このサイトから送信してください。", status: 403 },
  );
  assert.deepEqual(
    validateContactRequest({ ...configuredRequest, origin: "not a url" }),
    { message: "不正な送信元です。", status: 403 },
  );
  assert.deepEqual(
    validateContactRequest({ ...configuredRequest, contentLength: 20_001 }),
    { message: "入力内容が長すぎます。", status: 413 },
  );
});

test("a missing origin and a body exactly at the limit remain allowed", () => {
  assert.equal(
    validateContactRequest({ ...configuredRequest, origin: null, contentLength: 20_000 }),
    null,
  );
});

test("contact email text keeps the established labels and empty-value fallbacks", () => {
  assert.equal(
    buildContactEmailText({
      referenceId: "reference-1",
      category: "作品情報",
      name: "",
      replyEmail: "reply@example.test",
      targetUrl: "",
      details: "確認依頼です。",
    }),
    [
      "発掘LAB お問い合わせ",
      "受付ID: reference-1",
      "種別: 作品情報",
      "お名前: 未入力",
      "返信先: reply@example.test",
      "対象URL: 未入力",
      "",
      "お問い合わせ内容:",
      "確認依頼です。",
    ].join("\n"),
  );
});
