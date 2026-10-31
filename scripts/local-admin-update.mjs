import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { resolve } from "node:path";
import {
  describeReadinessFailure,
  findAvailablePort,
  getAmateurApiCatalogCompletionError,
  getAmateurApiCatalogRunAction,
  isSuccessfulTaskResponse,
  runTaskSequence,
  writeFileWithRetry,
} from "./local-admin-update-helpers.mjs";

loadEnv({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const TASKS = {
  reserve: { label: "予約作品更新", path: "/api/update-reserve", jobName: "reserve" },
  new: { label: "新作更新", path: "/api/update-new", jobName: "new_update" },
  "semi-new": { label: "準新作更新", path: "/api/update-semi-new", jobName: "semi_new" },
  old: { label: "旧作更新", path: "/api/update-old", jobName: "old" },
  sale: { label: "セール更新", path: "/api/update-sale", jobName: "sale" },
  "ended-sale": { label: "終了セール更新", path: "/api/update-ended-sale", jobName: "ended_sale" },
  stage: { label: "Stage同期", path: "/api/sync/update-stage", jobName: "stage" },
  review: { label: "レビュー更新", path: "/api/review-update", repeat: true, jobName: "review" },
  ranking: { label: "ランキング更新", path: "/api/dmm-ranking", jobName: "ranking" },
  score: { label: "スコア更新", path: "/api/score-update", jobName: "score" },
  "missing-prices": { label: "価格補完", path: "/api/update-missing-prices", jobName: "missing_prices" },
  "amateur-api-catalog": { label: "素人作品API全件補完", path: "/api/admin/fanza-amateur-api-catalog", jobName: "amateur_api_catalog" },
};

const ALL_TASKS = [
  "reserve",
  "new",
  "semi-new",
  "old",
  "sale",
  "ended-sale",
  "stage",
  "review",
  "ranking",
  "score",
];

const TASK_GROUPS = {
  "daily-0030": ["reserve", "new", "old", "sale", "ended-sale", "ranking", "score", "amateur-api-catalog"],
  "daily-1030": ["sale", "ended-sale", "ranking", "score", "amateur-api-catalog"],
  "tue-fri-1800": ["review", "semi-new"],
  "sunday-1800": ["missing-prices"],
};

const LOCAL_UPDATE_DIST_DIR = ".next-local-update-production-scheduled";
const LOCAL_UPDATE_BUILD_SUCCESS_MARKER = ".local-update-build-success";

async function revalidateProduction(tasks) {
  if (tasks.length === 0) return;

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const siteUrls = configuredSiteUrl
    ? [configuredSiteUrl]
    : ["https://hakkutsu-lab.com", "https://amateur-lab.vercel.app"];
  const cronSecret = process.env.CRON_SECRET?.trim();
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cronSecret && !signingSecret) {
    throw new Error(
      "[再検証] CRON_SECRET と SUPABASE_SERVICE_ROLE_KEY の両方が未設定です。",
    );
  }

  const body = JSON.stringify({ tasks });
  const timestamp = Date.now().toString();
  const headers = { "content-type": "application/json" };
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  } else {
    headers["x-hakkutsu-timestamp"] = timestamp;
    headers["x-hakkutsu-signature"] = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }

  const failures = [];
  for (const siteUrl of siteUrls) {
    let endpoint;
    try {
      endpoint = new URL("/api/admin/revalidate", siteUrl);
    } catch {
      failures.push(`${siteUrl}: URL不正`);
      continue;
    }
    if (["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
      failures.push(`${siteUrl}: 本番URLではありません`);
      continue;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log(`[再検証] 本番キャッシュを更新しました: ${tasks.join(", ")}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${siteUrl}: ${message}`);
    }
  }

  throw new Error(`[再検証] 本番キャッシュの更新に失敗しました: ${failures.join(" / ")}`);
}

function usage() {
  console.log("使い方: npm run update:local -- <task>");
  console.log(`task: all | ${Object.keys(TASK_GROUPS).join(" | ")} | ${Object.keys(TASKS).join(" | ")}`);
  console.log("価格補完は長時間処理のため all には含まれません。");
}

const requestedTask = process.argv[2]?.trim().toLowerCase();
if (!requestedTask || (requestedTask !== "all" && !TASK_GROUPS[requestedTask] && !TASKS[requestedTask])) {
  usage();
  process.exitCode = 1;
} else {
  try {
    await run(requestedTask);
  } catch (error) {
    console.error("\n[失敗]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    // The two daily groups are the only scheduled runs that invalidate the
    // production cache. Do this once after the update attempt, even when a
    // stage or local-server startup failed, and before the scheduler records
    // the final status. Manual daily-1030 launches use this same path.
    if (requestedTask === "daily-0030" || requestedTask === "daily-1030") {
      const cacheTasks = TASK_GROUPS[requestedTask].filter(
        (name) => TASKS[name].revalidate !== false,
      );
      try {
        console.log(`[再検証] ${requestedTask} の更新処理後に本番キャッシュを更新します。`);
        await revalidateProduction(cacheTasks);
      } catch (error) {
        console.error(
          "[再検証失敗]",
          error instanceof Error ? error.message : error,
        );
        process.exitCode = 1;
      }
    }
  }
}

function postWithoutTimeout(url, options = {}) {
  return new Promise((resolveResponse, reject) => {
    const headers = {
      accept: "application/json",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.headers ?? {}),
    };
    const request = httpRequest(
      url,
      {
        method: "POST",
        headers,
        // Playwrightを使う更新は5分以上かかる。Node fetch (undici) の
        // 既定タイムアウトで接続だけが切れ、サーバー処理が残るのを防ぐ。
        timeout: 0,
      },
      (response) => {
        response.setEncoding("utf8");
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });
        response.once("aborted", () => {
          reject(new Error("更新APIからの応答が途中で切断されました。"));
        });
        response.once("error", reject);
        response.once("end", () => {
          resolveResponse({
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            status: response.statusCode ?? 500,
            text: body,
          });
        });
      },
    );

    request.once("error", reject);
    request.end(options.body);
  });
}

async function pathMtimeMs(path) {
  try {
    return (await stat(resolve(process.cwd(), path))).mtimeMs;
  } catch {
    return 0;
  }
}

async function latestMtimeMs(path) {
  let latest = await pathMtimeMs(path);

  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(resolve(process.cwd(), directory), {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;

      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(child);
      } else {
        latest = Math.max(latest, await pathMtimeMs(child));
      }
    }
  }

  await walk(path);
  return latest;
}

async function shouldBuildProductionServer(distDirPath) {
  if (process.env.FORCE_LOCAL_UPDATE_BUILD === "true") return true;

  const successfulBuildMtime = await pathMtimeMs(
    `${LOCAL_UPDATE_DIST_DIR}/${LOCAL_UPDATE_BUILD_SUCCESS_MARKER}`,
  );
  if (successfulBuildMtime === 0) return true;

  const sourceMtime = Math.max(
    await latestMtimeMs("src"),
    await latestMtimeMs("public"),
    await pathMtimeMs("next.config.ts"),
    await pathMtimeMs("package.json"),
    await pathMtimeMs("package-lock.json"),
  );

  return sourceMtime > successfulBuildMtime || !(await pathMtimeMs(distDirPath));
}

async function runBuild(distDirName) {
  console.log(`[local-update] ${distDirName} をビルドします。`);
  await rm(resolve(process.cwd(), distDirName), { recursive: true, force: true });

  await new Promise((resolveBuild, rejectBuild) => {
    const build = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "build", "--webpack"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NEXT_DIST_DIR: distDirName,
          NODE_ENV: "production",
          FORCE_COLOR: "1",
        },
        stdio: "inherit",
      },
    );

    build.once("error", rejectBuild);
    build.once("exit", async (code) => {
      if (code === 0) {
        try {
          await writeFile(
            resolve(process.cwd(), distDirName, LOCAL_UPDATE_BUILD_SUCCESS_MARKER),
            new Date().toISOString(),
            "utf8",
          );
          resolveBuild();
        } catch (error) {
          rejectBuild(error);
        }
      } else {
        rejectBuild(new Error(`production build failed with exit ${code ?? "unknown"}`));
      }
    });
  });
}

function isConnectionReset(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(ECONNRESET|socket hang up|応答が途中で切断)\b/i.test(message);
}

async function getJobStatus(jobName) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;

  const url = new URL("/rest/v1/jobs", supabaseUrl);
  url.searchParams.set("select", "job_name,status,error_message,started_at,finished_at,updated_at");
  url.searchParams.set("job_name", `eq.${jobName}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`ジョブ状態確認に失敗しました（HTTP ${response.status}）。`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function getActiveAmateurApiCatalogRun() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;

  const url = new URL("/rest/v1/fanza_amateur_api_catalog_runs", supabaseUrl);
  url.searchParams.set("select", "id,status,run_type,fetched_item_count,expected_item_count,rank_next_offset,last_error,updated_at");
  url.searchParams.set("status", "eq.running");
  url.searchParams.set("run_type", "eq.weekly_full");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "2");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`素人API全件補完の実行状態を確認できません（HTTP ${response.status}）。`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("素人API全件補完の実行状態が不正です。");
  if (rows.length > 1) throw new Error("実行中の素人API全件補完が複数あります。重複を避けるため停止しました。");
  return rows[0] ?? null;
}

async function recoverDisconnectedTask(task, startedAt) {
  if (!task.jobName) return false;

  console.warn(`[接続断] ${task.label}の応答が切断されました。ジョブ状態を確認します。`);
  const deadline = Date.now() + 20 * 60_000;
  let lastStatus = null;

  while (Date.now() < deadline) {
    const job = await getJobStatus(task.jobName);
    lastStatus = job?.status ?? null;

    const jobUpdatedAt = job?.updated_at ? Date.parse(job.updated_at) : 0;
    const belongsToCurrentRun = Number.isFinite(jobUpdatedAt) && jobUpdatedAt >= startedAt - 60_000;

    if (job?.status === "completed" && belongsToCurrentRun) {
      console.warn(`[接続断復旧] ${task.label}はジョブ状態が完了のため成功扱いにします。`);
      return true;
    }

    if (job?.status === "failed" && belongsToCurrentRun) {
      throw new Error(job.error_message || `${task.label}のジョブが失敗しました。`);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 30_000));
  }

  throw new Error(
    `${task.label}の応答切断後、20分以内にジョブ完了を確認できませんでした（最後の状態: ${lastStatus ?? "不明"}）。`,
  );
}

async function run(taskName) {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const localScheduleToken = randomBytes(32).toString("hex");
  const distDirName = LOCAL_UPDATE_DIST_DIR;
  const distDirPath = resolve(process.cwd(), distDirName);
  const tsconfigPath = resolve(process.cwd(), "tsconfig.json");
  const originalTsconfig = await readFile(tsconfigPath, "utf8");
  let interrupted = false;

  if (await shouldBuildProductionServer(distDirPath)) {
    await runBuild(distDirName);
  } else {
    console.log(`[local-update] 既存の ${distDirName} を使用します。`);
  }

  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_DIST_DIR: distDirName,
        SCHEDULE_API_TOKEN: localScheduleToken,
        NODE_ENV: "production",
        FORCE_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.setEncoding("utf8");
  server.stderr?.setEncoding("utf8");
  server.stdout?.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
      console.log(`[next:stdout] ${line}`);
    }
  });
  server.stderr?.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
      console.error(`[next:stderr] ${line}`);
    }
  });
  server.once("error", (error) => {
    console.error(`[next:process-error] ${error?.code ?? "unknown"}: ${error?.message ?? error}`);
  });
  server.once("exit", (code, signal) => {
    console.log(`[next:process-exit] code=${code ?? "null"} signal=${signal ?? "null"}`);
  });
  const heartbeat = process.env.SCHEDULE_RUN_ID
    ? spawn(process.execPath, ["scripts/scheduled-update-heartbeat.mjs"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: "ignore",
        windowsHide: true,
      })
    : null;

  async function stopServer() {
    if (heartbeat && heartbeat.exitCode === null) heartbeat.kill();
    if (server.exitCode !== null) return;
    if (process.platform === "win32" && server.pid) {
      await new Promise((resolveStop) => {
        const killer = spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
          stdio: "ignore",
        });
        killer.once("exit", resolveStop);
        killer.once("error", resolveStop);
      });
      return;
    }
    server.kill("SIGTERM");
  }

  process.once("SIGINT", () => {
    interrupted = true;
    console.log("\n[停止] 現在の工程を終了します。保存済みデータは維持されます。");
    void stopServer();
  });

  async function waitForHttpReady(path, phase, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    const startedAt = Date.now();
    const targetUrl = `${baseUrl}${path}`;
    let lastFailure = null;
    let attempt = 0;
    console.log(
      `[readiness:start] ${new Date().toISOString()} phase=${phase} url=${targetUrl} timeout=${timeoutMs}ms`,
    );
    while (Date.now() < deadline) {
      attempt += 1;
      if (server.exitCode !== null) {
        console.error(
          `[readiness:server-exited] ${new Date().toISOString()} phase=${phase} attempt=${attempt} elapsed=${Date.now() - startedAt}ms exit=${server.exitCode}`,
        );
        throw new Error(
          `${describeReadinessFailure({ phase, error: `ローカルサーバーが終了しました（exit ${server.exitCode}）`, timeoutMs })}`,
        );
      }
      const attemptStartedAt = Date.now();
      try {
        // Next.js can need longer than five seconds to serve its first request
        // after a cold start. Repeatedly aborting that request can keep the
        // local server from becoming ready, so give it the remaining readiness
        // budget instead of imposing a shorter per-request timeout.
        const remainingMs = Math.max(1, deadline - Date.now());
        const response = await fetch(targetUrl, {
          signal: AbortSignal.timeout(remainingMs),
        });
        const body = await response.text();
        const elapsedMs = Date.now() - attemptStartedAt;
        if (response.ok) {
          console.log(
            `[readiness:ok] ${new Date().toISOString()} phase=${phase} attempt=${attempt} http=${response.status} request=${elapsedMs}ms total=${Date.now() - startedAt}ms body=${JSON.stringify(body.slice(0, 160))}`,
          );
          return;
        }
        lastFailure = describeReadinessFailure({ phase, status: response.status, body });
        console.warn(
          `[readiness:http-error] ${new Date().toISOString()} attempt=${attempt} request=${elapsedMs}ms total=${Date.now() - startedAt}ms ${lastFailure}`,
        );
      } catch (error) {
        const elapsedMs = Date.now() - attemptStartedAt;
        const cause = error?.cause;
        const errorDetail = [
          error?.name ?? "Error",
          error?.code ? `code=${error.code}` : null,
          cause?.code ? `causeCode=${cause.code}` : null,
          error?.message ?? String(error),
        ].filter(Boolean).join(" ");
        lastFailure = describeReadinessFailure({ phase, error: errorDetail });
        console.error(
          `[readiness:request-error] ${new Date().toISOString()} attempt=${attempt} request=${elapsedMs}ms total=${Date.now() - startedAt}ms ${lastFailure}`,
        );
      }
      if (phase === "browser") break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 750));
    }
    console.error(
      `[readiness:timeout] ${new Date().toISOString()} phase=${phase} url=${targetUrl} attempts=${attempt} elapsed=${Date.now() - startedAt}ms timeout=${timeoutMs}ms last=${lastFailure ?? "no-response"}`,
    );
    throw new Error(
      lastFailure ?? describeReadinessFailure({ phase, timeoutMs }),
    );
  }

  async function executeAmateurApiCatalog(task) {
    const headers = {
      "x-hakkutsu-schedule-token": localScheduleToken,
    };
    const send = async (body) => {
      const response = await postWithoutTimeout("http://127.0.0.1:" + port + task.path, {
        headers,
        body: JSON.stringify(body),
      });
      let result;
      try { result = JSON.parse(response.text); }
      catch { result = { message: response.text }; }
      if (!response.ok || !isSuccessfulTaskResponse(response.ok, result)) {
        throw new Error(result.message || result.error || (task.label + "に失敗しました（HTTP " + response.status + "）。"));
      }
      if (!result.run?.id || !result.run?.status) {
        throw new Error(task.label + "から有効な実行状況が返りませんでした。");
      }
      return result.run;
    };

    console.log("\n[開始] " + task.label);
    const activeRun = await getActiveAmateurApiCatalogRun();
    const action = getAmateurApiCatalogRunAction(activeRun);
    let run;
    if (action === "abort") {
      throw new Error("素人API全件補完に直近の実行中runがあります。重複を避けるため今回の開始を中止しました。");
    }
    if (action === "resume") {
      console.log(`[再開] 保存済みの素人API全件補完run ${activeRun.id} を継続します（${Number(activeRun.fetched_item_count ?? 0).toLocaleString("ja-JP")}件取得済み）。`);
      run = await send({ action: "continue", runId: activeRun.id });
    } else {
      run = await send({ action: "start", runType: "weekly_full" });
    }
    let pageCount = 0;
    while (run.status === "running" && !interrupted) {
      if (pageCount >= 1_000) {
        throw new Error(task.label + "が1,000ページを超えたため安全停止しました。保存済み進捗から再開できます。");
      }
      run = await send({ action: "continue", runId: run.id });
      pageCount += 1;
      console.log("[進捗] 素人API " + Number(run.fetched_item_count ?? 0).toLocaleString("ja-JP") + "/" + (run.total_count == null ? "件数未確定" : Number(run.total_count).toLocaleString("ja-JP")) + "件（今回" + pageCount + "ページ）");
      if (run.status === "running" && !interrupted) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 350));
      }
    }
    const completionError = getAmateurApiCatalogCompletionError(task.label, run, interrupted);
    if (completionError) throw new Error(completionError);
    console.log("[完了] " + task.label + " " + Number(run.fetched_item_count ?? 0).toLocaleString("ja-JP") + "件");
  }

  async function executeTask(name) {
    const task = TASKS[name];
    if (name === "amateur-api-catalog") {
      await executeAmateurApiCatalog(task);
      return;
    }
    let batch = 0;
    do {
      batch += 1;
      console.log(`\n[開始] ${task.label}${task.repeat ? `（バッチ${batch}）` : ""}`);
      const startedAt = Date.now();
      let response;
      try {
        response = await postWithoutTimeout(`${baseUrl}${task.path}`);
      } catch (error) {
        if (isConnectionReset(error) && await recoverDisconnectedTask(task, startedAt)) {
          break;
        }
        throw error;
      }
      const text = response.text;
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { message: text };
      }
      if (!isSuccessfulTaskResponse(response.ok, result)) {
        throw new Error(result.message || `${task.label}に失敗しました（HTTP ${response.status}）。`);
      }
      if (name === "ended-sale" && Number(result.deferredCount ?? 0) > 0) {
        console.log(
          `[情報] 終了セール更新は完了しました。価格を確認できなかった${result.deferredCount}件は別日で自動再確認します。` +
            "後続のランキング・スコア更新を継続します。",
        );
      }
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[完了] ${task.label} ${seconds}秒`);
      if (result.processedCount != null && result.totalCount != null) {
        console.log(`[進捗] ${result.processedCount}/${result.totalCount}`);
      }
      if (!task.repeat || result.completed !== false) break;
    } while (!interrupted);
  }

  try {
    console.log(`[local-update] localhost:${port} を使用します。`);
    await waitForHttpReady("/api/admin/server-health", "server", 60_000);
    await waitForHttpReady("/api/admin/browser-health", "browser", 60_000);
    const taskNames = taskName === "all"
      ? ALL_TASKS
      : (TASK_GROUPS[taskName] ?? [taskName]);
    const { succeededTasks, failedTasks, stoppedAfterFailure } = await runTaskSequence(
      taskNames,
      executeTask,
      () => interrupted,
    );

    for (const failure of failedTasks) {
      console.error(`\n[工程失敗] ${TASKS[failure.name].label}: ${failure.message}`);
      console.error(
        "[中断] 同時実行とデータ不整合を防ぐため、後続の更新工程は実行しません。",
      );
    }

    if (!interrupted) {
      console.log("\n[実行結果]");
      console.log(
        `  成功 ${succeededTasks.length}件: ${succeededTasks.join(", ") || "なし"}`,
      );
      console.log(
        `  失敗 ${failedTasks.length}件: ${failedTasks.map(({ name }) => name).join(", ") || "なし"}`,
      );

      for (const failure of failedTasks) {
        console.error(`  - ${failure.name}: ${failure.message}`);
      }

      if (failedTasks.length > 0) {
        process.exitCode = 1;
        console.error(
          stoppedAfterFailure
            ? "\n[工程中断] 失敗した工程で停止しました。後続工程は未実行です。"
            : "\n[一部失敗] 失敗した工程があります。",
        );
      } else {
        console.log(
          "\n[全工程完了] ローカル更新が終了しました。ローカルサーバーを停止します。",
        );
      }
    }
  } catch (error) {
    if (!interrupted) {
      console.error("\n[失敗]", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  } finally {
    await stopServer();
    await writeFileWithRetry(tsconfigPath, originalTsconfig);
  }
}
