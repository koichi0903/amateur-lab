import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createHmac } from "node:crypto";

export function summarizeResponseBody(body, maxLength = 240) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "(空の応答)";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function describeReadinessFailure({ phase, status, body, error, timeoutMs }) {
  const details = [`phase=${phase}`];
  if (status != null) details.push(`HTTP ${status}`);
  if (body != null) details.push(`body=${summarizeResponseBody(body)}`);
  if (error) details.push(`error=${error instanceof Error ? error.message : String(error)}`);
  if (timeoutMs != null) details.push(`timeout=${timeoutMs}ms`);
  return details.join(" ");
}

function getReadinessRequestErrorDetail(error) {
  const cause = error?.cause;
  return [
    error?.name ?? "Error",
    error?.code ? `code=${error.code}` : null,
    cause?.code ? `causeCode=${cause.code}` : null,
    error?.message ?? String(error),
  ].filter(Boolean).join(" ");
}

export async function requestReadinessAttempt({ targetUrl, remainingMs, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(targetUrl, {
      signal: AbortSignal.timeout(remainingMs),
    });
    const body = await response.text();
    return {
      kind: response.ok ? "ready" : "http-error",
      status: response.status,
      body,
    };
  } catch (error) {
    return { kind: "request-error", errorDetail: getReadinessRequestErrorDetail(error) };
  }
}

export function isSuccessfulTaskResponse(responseOk, result) {
  return responseOk && result?.success !== false;
}

export function parseScheduledTaskResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function getScheduledTaskResponseError({ responseOk, status, taskLabel, result }) {
  if (isSuccessfulTaskResponse(responseOk, result)) return null;
  return result.message || `${taskLabel}に失敗しました（HTTP ${status}）。`;
}

export function shouldContinueScheduledTask(task, result) {
  return Boolean(task.repeat && result?.completed === false);
}

export async function requestScheduledTaskResult({
  task,
  baseUrl,
  startedAt,
  postWithoutTimeout,
  isConnectionReset,
  recoverDisconnectedTask,
}) {
  let response;
  try {
    response = await postWithoutTimeout(`${baseUrl}${task.path}`);
  } catch (error) {
    if (isConnectionReset(error) && await recoverDisconnectedTask(task, startedAt)) {
      return { kind: "recovered" };
    }
    throw error;
  }

  const result = parseScheduledTaskResponse(response.text);
  const responseError = getScheduledTaskResponseError({
    responseOk: response.ok,
    status: response.status,
    taskLabel: task.label,
    result,
  });
  if (responseError) throw new Error(responseError);
  return { kind: "completed", result };
}

export function getScheduledTaskCompletionMessages({ name, taskLabel, result, elapsedSeconds }) {
  const messages = [];
  if (name === "ended-sale" && Number(result.deferredCount ?? 0) > 0) {
    messages.push(
      `[情報] 終了セール更新は完了しました。価格を確認できなかった${result.deferredCount}件は別日で自動再確認します。` +
        "後続のランキング・スコア更新を継続します。",
    );
  }
  messages.push(`[完了] ${taskLabel} ${elapsedSeconds}秒`);
  if (result.processedCount != null && result.totalCount != null) {
    messages.push(`[進捗] ${result.processedCount}/${result.totalCount}`);
  }
  return messages;
}

export function getScheduledTaskNames(taskName, allTasks, taskGroups) {
  return taskName === "all" ? allTasks : (taskGroups[taskName] ?? [taskName]);
}

export function reportScheduledTaskSequence({
  succeededTasks,
  failedTasks,
  stoppedAfterFailure,
  taskLabels,
  interrupted,
  log = console.log,
  logError = console.error,
}) {
  for (const failure of failedTasks) {
    logError(`\n[工程失敗] ${taskLabels[failure.name].label}: ${failure.message}`);
    logError("[中断] 同時実行とデータ不整合を防ぐため、後続の更新工程は実行しません。");
  }

  if (interrupted) return null;

  log("\n[実行結果]");
  log(`  成功 ${succeededTasks.length}件: ${succeededTasks.join(", ") || "なし"}`);
  log(`  失敗 ${failedTasks.length}件: ${failedTasks.map(({ name }) => name).join(", ") || "なし"}`);
  for (const failure of failedTasks) logError(`  - ${failure.name}: ${failure.message}`);

  if (failedTasks.length > 0) {
    logError(
      stoppedAfterFailure
        ? "\n[工程中断] 失敗した工程で停止しました。後続工程は未実行です。"
        : "\n[一部失敗] 失敗した工程があります。",
    );
    return 1;
  }

  log("\n[全工程完了] ローカル更新が終了しました。ローカルサーバーを停止します。");
  return null;
}

export function reportScheduledTaskError(error, interrupted, logError = console.error) {
  if (interrupted) return null;
  logError("\n[失敗]", error instanceof Error ? error.message : error);
  return 1;
}

export async function runTaskSequence(taskNames, executeTask, isInterrupted) {
  const succeededTasks = [];
  const failedTasks = [];
  let stoppedAfterFailure = false;

  for (const name of taskNames) {
    if (isInterrupted()) break;
    try {
      await executeTask(name);
      succeededTasks.push(name);
    } catch (error) {
      failedTasks.push({
        name,
        message: error instanceof Error ? error.message : String(error),
      });
      stoppedAfterFailure = true;
      break;
    }
  }

  return { succeededTasks, failedTasks, stoppedAfterFailure };
}

export function getAmateurApiCatalogRunAction(activeRun, now = Date.now()) {
  if (!activeRun) return "start";

  const updatedAt = Date.parse(activeRun.updated_at ?? "");
  const hasRecordedFailure = typeof activeRun.last_error === "string" && activeRun.last_error.length > 0;
  const isStale = Number.isFinite(updatedAt) && now - updatedAt >= 10 * 60_000;
  return hasRecordedFailure && isStale ? "resume" : "abort";
}

export function getAmateurApiCatalogCompletionError(taskLabel, run, interrupted) {
  if (interrupted && run.status === "running") {
    return `${taskLabel}は中断されました。保存済みの進捗から次回再開できます。`;
  }
  if (run.status === "limit_reached") {
    return `${taskLabel}はAPI取得上限で停止しました（${Number(run.fetched_item_count ?? 0).toLocaleString("ja-JP")}件）。全作品完了とは判定できません。`;
  }
  if (run.status !== "completed") {
    return `${taskLabel}が完了状態になりませんでした（${String(run.status)}）。`;
  }
  return null;
}

export async function continueAmateurApiCatalogRun({
  taskLabel,
  initialRun,
  send,
  isInterrupted,
  onProgress,
  wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
}) {
  let run = initialRun;
  let pageCount = 0;
  while (run.status === "running" && !isInterrupted()) {
    if (pageCount >= 1_000) {
      throw new Error(`${taskLabel}が1,000ページを超えたため安全停止しました。保存済み進捗から再開できます。`);
    }
    run = await send({ action: "continue", runId: run.id });
    pageCount += 1;
    onProgress(run, pageCount);
    if (run.status === "running" && !isInterrupted()) {
      await wait(350);
    }
  }
  return run;
}

export function getCurrentRunJobOutcome(job, startedAt) {
  if (!job) return null;

  const updatedAt = job.updated_at ? Date.parse(job.updated_at) : 0;
  const belongsToCurrentRun = Number.isFinite(updatedAt) && updatedAt >= startedAt - 60_000;
  if (!belongsToCurrentRun) return null;
  if (job.status === "completed") return { status: "completed" };
  if (job.status === "failed") return { status: "failed", message: job.error_message };
  return null;
}

export function getRevalidationSiteUrls(configuredSiteUrl) {
  const normalizedSiteUrl = configuredSiteUrl?.trim().replace(/\/+$/, "");
  return normalizedSiteUrl
    ? [normalizedSiteUrl]
    : ["https://hakkutsu-lab.com", "https://amateur-lab.vercel.app"];
}

export function buildRevalidationHeaders({ cronSecret, signingSecret, timestamp, body }) {
  const headers = { "content-type": "application/json" };
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  } else if (signingSecret) {
    headers["x-hakkutsu-timestamp"] = timestamp;
    headers["x-hakkutsu-signature"] = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }
  return headers;
}

export function getProductionRevalidationEndpoint(siteUrl) {
  let endpoint;
  try {
    endpoint = new URL("/api/admin/revalidate", siteUrl);
  } catch {
    return { error: `${siteUrl}: URL不正` };
  }
  if (["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
    return { error: `${siteUrl}: 本番URLではありません` };
  }
  return { endpoint };
}

export async function findAvailablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (port) resolvePort(port);
        else reject(new Error("空きポートを取得できませんでした。"));
      });
    });
  });
}

export async function writeFileWithRetry(path, contents) {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await writeFile(path, contents, "utf8");
      return;
    } catch (error) {
      lastError = error;
      if (error?.code !== "EPERM" && error?.code !== "EBUSY") throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw lastError;
}
