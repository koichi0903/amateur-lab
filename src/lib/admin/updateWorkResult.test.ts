import assert from "node:assert/strict";
import test from "node:test";
import { resolveUpdateWorkStatus } from "./updateWorkResult.ts";

test("unavailable deferred takes precedence over metadata changes", () => {
  assert.equal(resolveUpdateWorkStatus("unavailable_deferred", true), "unavailable_deferred");
  assert.equal(resolveUpdateWorkStatus("unavailable_deferred", false), "unavailable_deferred");
});

test("metadata or Playwright changes mark the work updated", () => {
  assert.equal(resolveUpdateWorkStatus("unchanged", true), "updated");
  assert.equal(resolveUpdateWorkStatus("updated", false), "updated");
});

test("unchanged metadata and Playwright results stay unchanged", () => {
  assert.equal(resolveUpdateWorkStatus("unchanged", false), "unchanged");
  assert.equal(resolveUpdateWorkStatus("unavailable", false), "unchanged");
  assert.equal(resolveUpdateWorkStatus("unavailable", true), "updated");
  assert.equal(resolveUpdateWorkStatus("sample_movie_missing", false), "unchanged");
  assert.equal(resolveUpdateWorkStatus("sample_movie_missing", true), "updated");
});
