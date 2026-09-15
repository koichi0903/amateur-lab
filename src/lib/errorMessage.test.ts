import assert from "node:assert/strict";
import test from "node:test";

import { formatUnknownError } from "./errorMessage.ts";

test("formats structured Supabase errors", () => {
  assert.equal(
    formatUnknownError({ message: "query failed", code: "PGRST001" }),
    "query failed | PGRST001",
  );
});

test("reads nested network error causes", () => {
  const error = new TypeError("fetch failed", {
    cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
  });
  assert.equal(
    formatUnknownError(error),
    "fetch failed (UND_ERR_CONNECT_TIMEOUT)",
  );
});

test("does not render object errors as object Object", () => {
  assert.equal(formatUnknownError({ message: "" }), "詳細のない通信エラー");
});
