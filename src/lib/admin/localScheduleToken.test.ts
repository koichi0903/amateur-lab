import assert from "node:assert/strict";
import test from "node:test";
import { isValidLocalScheduleToken } from "./localScheduleToken.ts";

test("accepts a matching schedule token only for loopback hosts", () => {
  assert.equal(isValidLocalScheduleToken("localhost", "secret", "secret"), true);
  assert.equal(isValidLocalScheduleToken("127.0.0.1", "secret", "secret"), true);
  assert.equal(isValidLocalScheduleToken("example.com", "secret", "secret"), false);
});

test("rejects missing, empty, and mismatched schedule tokens", () => {
  assert.equal(isValidLocalScheduleToken("localhost", undefined, "secret"), false);
  assert.equal(isValidLocalScheduleToken("localhost", "", "secret"), false);
  assert.equal(isValidLocalScheduleToken("localhost", "secret", null), false);
  assert.equal(isValidLocalScheduleToken("localhost", "secret", ""), false);
  assert.equal(isValidLocalScheduleToken("localhost", "secret", "another"), false);
  assert.equal(isValidLocalScheduleToken("localhost", "secret", "short"), false);
});
