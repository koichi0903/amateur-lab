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
  getScheduledTaskCompletionMessages,
  getScheduledTaskNames,
  getScheduledTaskResponseError,
  isSuccessfulTaskResponse,
  parseScheduledTaskResponse,
  requestReadinessAttempt,
  requestScheduledTaskResult,
  reportScheduledTaskError,
  reportScheduledTaskSequence,
  runTaskSequence,
  shouldContinueScheduledTask,
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

test("parses scheduled task JSON and keeps malformed responses readable", () => {
  assert.deepEqual(parseScheduledTaskResponse('{"success":true}'), { success: true });
  assert.deepEqual(parseScheduledTaskResponse("not JSON"), { message: "not JSON" });
});

test("preserves scheduled task response error messages", () => {
  assert.equal(getScheduledTaskResponseError({
    responseOk: true,
    status: 200,
    taskLabel: "catalog",
    result: { success: true },
  }), null);
  assert.equal(getScheduledTaskResponseError({
    responseOk: false,
    status: 503,
    taskLabel: "catalog",
    result: { message: "maintenance" },
  }), "maintenance");
  assert.equal(getScheduledTaskResponseError({
    responseOk: false,
    status: 503,
    taskLabel: "catalog",
    result: {},
  }), "catalogに失敗しました（HTTP 503）。");
  assert.equal(getScheduledTaskResponseError({
    responseOk: false,
    status: 503,
    taskLabel: "catalog",
    result: { error: "server error" },
  }), "catalogに失敗しました（HTTP 503）。");
});

test("repeats only successful batch tasks with an explicit incomplete result", () => {
  assert.equal(shouldContinueScheduledTask({ repeat: true }, { completed: false }), true);
  assert.equal(shouldContinueScheduledTask({ repeat: true }, { completed: true }), false);
  assert.equal(shouldContinueScheduledTask({ repeat: false }, { completed: false }), false);
});

test("formats scheduled task completion, deferred, and progress messages", () => {
  assert.deepEqual(getScheduledTaskCompletionMessages({
    name: "ended-sale",
    taskLabel: "終了セール",
    result: { deferredCount: 2, processedCount: 4, totalCount: 6 },
    elapsedSeconds: "1.5",
  }), [
    "[情報] 終了セール更新は完了しました。価格を確認できなかった2件は別日で自動再確認します。後続のランキング・スコア更新を継続します。",
    "[完了] 終了セール 1.5秒",
    "[進捗] 4/6",
  ]);
  assert.deepEqual(getScheduledTaskCompletionMessages({
    name: "ranking",
    taskLabel: "ランキング",
    result: {},
    elapsedSeconds: "0.3",
  }), ["[完了] ランキング 0.3秒"]);
});

test("requests scheduled task results and recovers only recognized connection resets", async () => {
  const request = async () => ({ ok: true, status: 200, text: '{"success":true}' });
  assert.deepEqual(await requestScheduledTaskResult({
    task: { path: "/ranking", label: "ランキング" },
    baseUrl: "http://localhost:3000",
    startedAt: 10,
    postWithoutTimeout: request,
    isConnectionReset: () => false,
    recoverDisconnectedTask: async () => false,
  }), { kind: "completed", result: { success: true } });

  const reset = Object.assign(new Error("reset"), { code: "ECONNRESET" });
  assert.deepEqual(await requestScheduledTaskResult({
    task: { path: "/ranking", label: "ランキング" },
    baseUrl: "http://localhost:3000",
    startedAt: 10,
    postWithoutTimeout: async () => { throw reset; },
    isConnectionReset: (error) => error.code === "ECONNRESET",
    recoverDisconnectedTask: async () => true,
  }), { kind: "recovered" });
});

test("selects scheduled tasks and reports sequence results without changing status", () => {
  const allTasks = ["ended-sale", "ranking"];
  const groups = { catalog: ["amateur-api-catalog"] };
  assert.equal(getScheduledTaskNames("all", allTasks, groups), allTasks);
  assert.deepEqual(getScheduledTaskNames("catalog", allTasks, groups), ["amateur-api-catalog"]);
  assert.deepEqual(getScheduledTaskNames("ranking", allTasks, groups), ["ranking"]);

  const logs = [];
  const errors = [];
  const exitCode = reportScheduledTaskSequence({
    succeededTasks: ["ranking"],
    failedTasks: [{ name: "ended-sale", message: "failed" }],
    stoppedAfterFailure: true,
    taskLabels: { "ended-sale": { label: "終了セール" } },
    interrupted: false,
    log: (message) => logs.push(message),
    logError: (message) => errors.push(message),
  });
  assert.equal(exitCode, 1);
  assert.ok(logs.includes("  成功 1件: ranking"));
  assert.ok(errors.some((message) => message.includes("後続の更新工程は実行しません")));

  assert.equal(reportScheduledTaskSequence({
    succeededTasks: [],
    failedTasks: [],
    stoppedAfterFailure: false,
    taskLabels: {},
    interrupted: true,
    log: () => assert.fail("interrupted runs must not print a result"),
    logError: () => assert.fail("interrupted runs must not print an error"),
  }), null);
});

test("reports scheduled task errors only when the run was not interrupted", () => {
  const errors = [];
  assert.equal(reportScheduledTaskError(new Error("failure"), false, (...args) => errors.push(args)), 1);
  assert.deepEqual(errors, [["\n[失敗]", "failure"]]);
  assert.equal(reportScheduledTaskError(new Error("failure"), true, () => assert.fail()), null);
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
