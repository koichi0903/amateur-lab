import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeReadinessFailure,
  findAvailablePort,
  getAmateurApiCatalogCompletionError,
  getAmateurApiCatalogRunAction,
  isSuccessfulTaskResponse,
  runTaskSequence,
  summarizeResponseBody,
  writeFileWithRetry,
} from "./local-admin-update-helpers.mjs";

test("summarizes readiness response bodies without logging unlimited output", () => {
  assert.equal(summarizeResponseBody("  one\n two  "), "one two");
  assert.equal(summarizeResponseBody("x".repeat(300)).length, 241);
});

test("includes phase, status, body, and timeout in readiness diagnostics", () => {
  const message = describeReadinessFailure({
    phase: "browser",
    status: 500,
    body: "Browser failed to start.",
    timeoutMs: 60_000,
  });
  assert.match(message, /phase=browser/);
  assert.match(message, /HTTP 500/);
  assert.match(message, /body=Browser failed to start\./);
  assert.match(message, /timeout=60000ms/);
});

test("keeps ranking and score eligible after a non-fatal ended-sale warning", () => {
  assert.equal(
    isSuccessfulTaskResponse(true, {
      success: true,
      deferredCount: 16,
      message: "終了セール更新が完了しました（要再確認16件）。",
    }),
    true,
  );
  assert.equal(isSuccessfulTaskResponse(false, { success: false }), false);
});

test("runs scheduled tasks in order and stops after the first failure", async () => {
  const executed = [];
  const result = await runTaskSequence(
    ["reserve", "new", "sale"],
    async (name) => {
      executed.push(name);
      if (name === "new") throw new Error("new task failed");
    },
    () => false,
  );

  assert.deepEqual(executed, ["reserve", "new"]);
  assert.deepEqual(result.succeededTasks, ["reserve"]);
  assert.deepEqual(result.failedTasks, [{ name: "new", message: "new task failed" }]);
  assert.equal(result.stoppedAfterFailure, true);
});

test("does not start another task after an interrupt between tasks", async () => {
  const executed = [];
  let interrupted = false;
  const result = await runTaskSequence(
    ["reserve", "new"],
    async (name) => {
      executed.push(name);
      interrupted = true;
    },
    () => interrupted,
  );

  assert.deepEqual(executed, ["reserve"]);
  assert.deepEqual(result.succeededTasks, ["reserve"]);
  assert.deepEqual(result.failedTasks, []);
  assert.equal(result.stoppedAfterFailure, false);
});

test("starts, resumes only stale failed runs, and rejects other active runs", () => {
  const now = Date.parse("2026-10-30T00:00:00.000Z");
  assert.equal(getAmateurApiCatalogRunAction(null, now), "start");
  assert.equal(
    getAmateurApiCatalogRunAction({ updated_at: new Date(now - 9 * 60_000).toISOString(), last_error: "failed" }, now),
    "abort",
  );
  assert.equal(
    getAmateurApiCatalogRunAction({ updated_at: new Date(now - 10 * 60_000).toISOString(), last_error: "failed" }, now),
    "resume",
  );
  assert.equal(
    getAmateurApiCatalogRunAction({ updated_at: new Date(now - 20 * 60_000).toISOString(), last_error: "" }, now),
    "abort",
  );
});

test("preserves interruption, API-limit, and incomplete catalog run failures", () => {
  assert.equal(
    getAmateurApiCatalogCompletionError("catalog", { status: "running" }, true),
    "catalogは中断されました。保存済みの進捗から次回再開できます。",
  );
  assert.equal(
    getAmateurApiCatalogCompletionError("catalog", { status: "limit_reached", fetched_item_count: 1234 }, false),
    "catalogはAPI取得上限で停止しました（1,234件）。全作品完了とは判定できません。",
  );
  assert.equal(
    getAmateurApiCatalogCompletionError("catalog", { status: "paused" }, false),
    "catalogが完了状態になりませんでした（paused）。",
  );
  assert.equal(
    getAmateurApiCatalogCompletionError("catalog", { status: "completed" }, false),
    null,
  );
});

test("writes UTF-8 files through the shared retry helper", async () => {
  const directory = await mkdtemp(join(tmpdir(), "local-update-helper-"));
  const path = join(directory, "tsconfig.json");

  try {
    await writeFileWithRetry(path, "復元テスト");
    assert.equal(await readFile(path, "utf8"), "復元テスト");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("finds an available loopback port", async () => {
  const port = await findAvailablePort();
  assert.equal(Number.isInteger(port), true);
  assert.equal(port > 0 && port <= 65_535, true);
});
