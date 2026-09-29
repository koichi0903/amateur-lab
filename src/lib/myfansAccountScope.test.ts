import test from "node:test";
import assert from "node:assert/strict";
import { accountScopedExclusionKey, accountScopedIdempotencyKey, isAccountVisible, normalizeMyfansAccountKey } from "./myfansAccountScope";

test("account identity is stable and display @ is not part of the key", () => {
  assert.equal(normalizeMyfansAccountKey(" @fansmy230 "), "fansmy230");
});

test("idempotency is independent between accounts", () => {
  assert.notEqual(accountScopedIdempotencyKey(1, "variant:x"), accountScopedIdempotencyKey(2, "variant:x"));
  assert.equal(accountScopedIdempotencyKey(2, "variant:x"), "2:variant:x");
});

test("shared supply rows are visible but operational rows are account-local", () => {
  assert.equal(isAccountVisible(null, 2), true);
  assert.equal(isAccountVisible(1, 2), false);
  assert.equal(isAccountVisible(2, 2), true);
});

test("same source can be excluded independently per account", () => {
  assert.notEqual(accountScopedExclusionKey(1, "source", "source:x"), accountScopedExclusionKey(2, "source", "source:x"));
});
