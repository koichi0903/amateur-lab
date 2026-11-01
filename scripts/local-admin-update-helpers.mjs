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

export function isSuccessfulTaskResponse(responseOk, result) {
  return responseOk && result?.success !== false;
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
