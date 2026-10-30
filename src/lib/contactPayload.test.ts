import assert from "node:assert/strict";
import test from "node:test";
import { validateContactPayload } from "./contactPayload.ts";

const now = Date.parse("2026-10-30T12:00:00Z");
const validInput = (overrides: Record<string, unknown> = {}) => ({
  category: "サイトの不具合",
  name: " 利用者 ",
  replyEmail: " user@example.com ",
  targetUrl: " https://example.com/page ",
  details: " こちらの表示に不具合があります。確認をお願いします。 ",
  consent: true,
  startedAt: now - 3_000,
  ...overrides,
});

test("validates and trims the fields consumed by the contact mail", () => {
  assert.deepEqual(validateContactPayload(validInput(), () => now), {
    kind: "valid",
    now,
    payload: {
      category: "サイトの不具合",
      name: "利用者",
      replyEmail: "user@example.com",
      targetUrl: "https://example.com/page",
      details: "こちらの表示に不具合があります。確認をお願いします。",
    },
  });
});

test("accepts a blank optional name and URL while preserving the 20-character lower bound", () => {
  const result = validateContactPayload(validInput({ name: " ", targetUrl: "", details: "12345678901234567890" }), () => now);

  assert.deepEqual(result, {
    kind: "valid",
    now,
    payload: {
      category: "サイトの不具合",
      name: "",
      replyEmail: "user@example.com",
      targetUrl: "",
      details: "12345678901234567890",
    },
  });
});

test("the honeypot succeeds before validating other fields", () => {
  assert.deepEqual(validateContactPayload(validInput({ website: " https://bot.example ", category: "invalid" }), () => now), { kind: "honeypot" });
});

test("returns the original ordered validation messages", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ category: "invalid", name: "x".repeat(81) }, "お問い合わせ種別を確認してください。"],
    [{ name: "x".repeat(81) }, "お名前が長すぎます。"],
    [{ replyEmail: "bad" }, "返信先メールアドレスを確認してください。"],
    [{ replyEmail: `${"a".repeat(245)}@example.com` }, "返信先メールアドレスを確認してください。"],
    [{ targetUrl: "ftp://example.com" }, "対象ページURLを確認してください。"],
    [{ targetUrl: `https://example.com/${"a".repeat(990)}` }, "対象ページURLを確認してください。"],
    [{ details: "短い内容です" }, "お問い合わせ内容は20〜5000文字で入力してください。"],
    [{ details: "a".repeat(5001) }, "お問い合わせ内容は20〜5000文字で入力してください。"],
    [{ consent: false }, "個人情報の取り扱いへの同意が必要です。"],
    [{ startedAt: now - 1_999 }, "ページを再読み込みして、もう一度お試しください。"],
    [{ startedAt: now - 2 * 60 * 60 * 1000 - 1 }, "ページを再読み込みして、もう一度お試しください。"],
  ];

  for (const [override, message] of cases) {
    assert.deepEqual(validateContactPayload(validInput(override), () => now), { kind: "invalid", message }, message);
  }
});

test("accepts both inclusive boundaries of the startedAt window", () => {
  for (const startedAt of [now - 2_000, now - 2 * 60 * 60 * 1000]) {
    const result = validateContactPayload(validInput({ startedAt }), () => now);
    assert.equal(result.kind, "valid");
  }
});
