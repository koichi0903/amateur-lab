import assert from "node:assert/strict";
import { companionPersistenceError, normalizeCompanionError } from "./myfansCompanionErrors";

assert.deepEqual(normalizeCompanionError({ code: "23514", message: "check constraint failed", details: "launch_priority" }, "myfans_product_import"), {
  errorCode: "23514",
  errorMessage: "check constraint failed",
  errorStage: "myfans_product_import",
});
assert.deepEqual(normalizeCompanionError({ reason: "product_resolution_failed", errorCode: "PRODUCT_IMPORT_FAILED", errorMessage: "必須field不足", stage: "observation" }, "fallback"), {
  errorCode: "PRODUCT_IMPORT_FAILED",
  errorMessage: "必須field不足",
  errorStage: "observation",
  reason: "product_resolution_failed",
});
assert.equal(normalizeCompanionError({ code: "OBJECT_THROW" }, "structured").errorMessage.includes("[object Object]"), false);
const wrapped = companionPersistenceError({ code: "23514", message: "constraint failed" }, "myfans_product_import", "product_resolution_failed");
assert.equal((wrapped as Error & { reason: string }).reason, "product_resolution_failed");
assert.doesNotMatch(normalizeCompanionError({ code: "OBJECT_THROW" }, "structured").errorMessage, /\[object Object\]/);

console.log("Myfans companion error checks passed");
