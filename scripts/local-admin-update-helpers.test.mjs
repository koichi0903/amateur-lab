import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeReadinessFailure,
  buildRevalidationHeaders,
  continueAmateurApiCatalogRun,
  findAvailablePort,
  getAmateurApiCatalogCompletionError,
  getAmateurApiCatalogRunAction,
  getCurrentRunJobOutcome,
  getProductionRevalidationEndpoint,
  getRevalidationSiteUrls,
  isSuccessfulTaskResponse,
  requestReadinessAttempt,
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

test("classifies readiness success and HTTP responses without changing their bodies", async () => {
  const ready = await requestReadinessAttempt({
    targetUrl: "http://127.0.0.1:3000/health",
    remainingMs: 1_000,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => " ready " }),
  });
  const httpError = await requestReadinessAttempt({
    targetUrl: "http://127.0.0.1:3000/health",
    remainingMs: 1_000,
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => "warming" }),
  });

  assert.deepEqual(ready, { kind: "ready", status: 200, body: " ready " });
  assert.deepEqual(httpError, { kind: "http-error", status: 503, body: "warming" });
});

test("preserves readiness request error and cause codes", async () => {
  const result = await requestReadinessAttempt({
    targetUrl: "http://127.0.0.1:3000/health",
    remainingMs: 1_000,
    fetchImpl: async () => {
      const error = new TypeError("connection reset");
      error.code = "ERR_REQUEST";
      error.cause = Object.assign(new Error("socket closed"), { code: "ECONNRESET" });
      throw error;
    },
  });

  assert.deepEqual(result, {
    kind: "request-error",
    errorDetail: "TypeError code=ERR_REQUEST causeCode=ECONNRESET connection reset",
  });
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

test("continues catalog pages, reports progress, and waits only between running pages", async () => {
  const requests = [];
  const progress = [];
  const waits = [];
  const states = [
    { id: "run-1", status: "running", fetched_item_count: 50, total_count: 100 },
    { id: "run-1", status: "completed", fetched_item_count: 100, total_count: 100 },
  ];
  const result = await continueAmateurApiCatalogRun({
    taskLabel: "catalog",
    initialRun: { id: "run-1", status: "running" },
    send: async (request) => { requests.push(request); return states.shift(); },
    isInterrupted: () => false,
    onProgress: (run, pageCount) => progress.push([run.fetched_item_count, pageCount]),
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  assert.deepEqual(requests, [
    { action: "continue", runId: "run-1" },
    { action: "continue", runId: "run-1" },
  ]);
  assert.deepEqual(progress, [[50, 1], [100, 2]]);
  assert.deepEqual(waits, [350]);
  assert.equal(result.status, "completed");
});

test("stops requesting catalog pages after interruption", async () => {
  let interrupted = false;
  let requests = 0;
  const result = await continueAmateurApiCatalogRun({
    taskLabel: "catalog",
    initialRun: { id: "run-1", status: "running" },
    send: async () => { requests += 1; return { id: "run-1", status: "running" }; },
    isInterrupted: () => interrupted,
    onProgress: () => { interrupted = true; },
    wait: async () => assert.fail("must not wait after interruption"),
  });

  assert.equal(requests, 1);
  assert.equal(result.status, "running");
});

test("stops after the existing 1,000-page safety limit", async () => {
  let requests = 0;
  await assert.rejects(
    continueAmateurApiCatalogRun({
      taskLabel: "catalog",
      initialRun: { id: "run-1", status: "running" },
      send: async () => { requests += 1; return { id: "run-1", status: "running" }; },
      isInterrupted: () => false,
      onProgress: () => {},
      wait: async () => {},
    }),
    /1,000ページを超えたため安全停止/,
  );
  assert.equal(requests, 1_000);
});

test("classifies only current-run completed and failed jobs", () => {
  const startedAt = Date.parse("2026-10-30T00:00:00.000Z");
  assert.deepEqual(
    getCurrentRunJobOutcome({
      status: "completed",
      updated_at: new Date(startedAt - 60_000).toISOString(),
    }, startedAt),
    { status: "completed" },
  );
  assert.deepEqual(
    getCurrentRunJobOutcome({
      status: "failed",
      error_message: "job failed",
      updated_at: new Date(startedAt).toISOString(),
    }, startedAt),
    { status: "failed", message: "job failed" },
  );
  assert.equal(
    getCurrentRunJobOutcome({
      status: "completed",
      updated_at: new Date(startedAt - 60_001).toISOString(),
    }, startedAt),
    null,
  );
  assert.equal(
    getCurrentRunJobOutcome({ status: "running", updated_at: new Date(startedAt).toISOString() }, startedAt),
    null,
  );
  assert.equal(getCurrentRunJobOutcome(null, startedAt), null);
});

test("builds cache revalidation targets and authentication headers", () => {
  assert.deepEqual(getRevalidationSiteUrls(" https://site.example/// "), ["https://site.example"]);
  assert.deepEqual(getRevalidationSiteUrls(" "), [
    "https://hakkutsu-lab.com",
    "https://amateur-lab.vercel.app",
  ]);

  assert.deepEqual(
    buildRevalidationHeaders({ cronSecret: "cron", signingSecret: "signing", timestamp: "1", body: "{}" }),
    { "content-type": "application/json", authorization: "Bearer cron" },
  );
  const signedHeaders = buildRevalidationHeaders({ signingSecret: "signing", timestamp: "1", body: "{}" });
  assert.equal(signedHeaders["x-hakkutsu-timestamp"], "1");
  assert.match(signedHeaders["x-hakkutsu-signature"], /^[0-9a-f]{64}$/);
  assert.equal(signedHeaders.authorization, undefined);
});

test("rejects invalid and loopback cache revalidation URLs", () => {
  assert.equal(getProductionRevalidationEndpoint("not a URL").error, "not a URL: URL不正");
  assert.equal(getProductionRevalidationEndpoint("http://localhost:3000").error, "http://localhost:3000: 本番URLではありません");
  assert.equal(getProductionRevalidationEndpoint("http://127.0.0.1:3000").error, "http://127.0.0.1:3000: 本番URLではありません");
  assert.equal(getProductionRevalidationEndpoint("https://site.example").endpoint.href, "https://site.example/api/admin/revalidate");
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
