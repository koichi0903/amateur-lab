import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { resolve } from "node:path";

const TASKS = {
  reserve: { label: "予約作品更新", path: "/api/update-reserve" },
  new: { label: "新作更新", path: "/api/update-new" },
  "semi-new": { label: "準新作更新", path: "/api/update-semi-new" },
  old: { label: "旧作更新", path: "/api/update-old" },
  sale: { label: "セール更新", path: "/api/update-sale" },
  "ended-sale": { label: "終了セール更新", path: "/api/update-ended-sale" },
  stage: { label: "Stage同期", path: "/api/sync/update-stage" },
  review: { label: "レビュー更新", path: "/api/review-update", repeat: true },
  ranking: { label: "ランキング更新", path: "/api/dmm-ranking" },
  score: { label: "スコア更新", path: "/api/score-update" },
  "missing-prices": { label: "価格補完", path: "/api/update-missing-prices" },
  "sample-movie": { label: "サンプル動画補完", path: "/api/admin/fill-sample-movie" },
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
  "daily-0030": ["reserve", "new", "old", "sale", "ended-sale", "ranking", "score"],
  "daily-1030": ["sale", "ended-sale", "ranking", "score"],
  "tue-fri-1800": ["review", "semi-new"],
  "sunday-1800": ["missing-prices", "sample-movie"],
};

function usage() {
  console.log("使い方: npm run update:local -- <task>");
  console.log(`task: all | ${Object.keys(TASK_GROUPS).join(" | ")} | ${Object.keys(TASKS).join(" | ")}`);
  console.log("価格補完と動画補完は長時間処理のため all には含まれません。");
}

const requestedTask = process.argv[2]?.trim().toLowerCase();
if (!requestedTask || (requestedTask !== "all" && !TASK_GROUPS[requestedTask] && !TASKS[requestedTask])) {
  usage();
  process.exitCode = 1;
} else {
  await run(requestedTask);
}

async function findAvailablePort() {
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

function postWithoutTimeout(url) {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest(
      url,
      {
        method: "POST",
        headers: { accept: "application/json" },
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
    request.end();
  });
}

async function run(taskName) {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const distDirName = `.next-local-update-${port}`;
  const distDirPath = resolve(process.cwd(), distDirName);
  const tsconfigPath = resolve(process.cwd(), "tsconfig.json");
  const originalTsconfig = await readFile(tsconfigPath, "utf8");
  let interrupted = false;

  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_DIST_DIR: distDirName, FORCE_COLOR: "1" },
      stdio: "inherit",
    },
  );

  async function stopServer() {
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

  async function waitForServer() {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) {
        throw new Error(`ローカルサーバーが終了しました（exit ${server.exitCode}）。`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/admin/browser-health`);
        if (response.ok) return;
      } catch {
        // Still starting.
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 750));
    }
    throw new Error("ローカルサーバーを60秒以内に起動できませんでした。");
  }

  async function executeTask(name) {
    const task = TASKS[name];
    let batch = 0;
    do {
      batch += 1;
      console.log(`\n[開始] ${task.label}${task.repeat ? `（バッチ${batch}）` : ""}`);
      const startedAt = Date.now();
      const response = await postWithoutTimeout(`${baseUrl}${task.path}`);
      const text = response.text;
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { message: text };
      }
      if (!response.ok || result.success === false) {
        throw new Error(result.message || `${task.label}に失敗しました（HTTP ${response.status}）。`);
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
    await waitForServer();
    const taskNames = taskName === "all"
      ? ALL_TASKS
      : (TASK_GROUPS[taskName] ?? [taskName]);
    const succeededTasks = [];
    const failedTasks = [];
    let stoppedAfterFailure = false;

    for (const name of taskNames) {
      if (interrupted) break;
      try {
        await executeTask(name);
        succeededTasks.push(name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedTasks.push({ name, message });
        console.error(
          `\n[工程失敗] ${TASKS[name].label}: ${message}`,
        );
        console.error(
          "[中断] 同時実行とデータ不整合を防ぐため、後続の更新工程は実行しません。",
        );
        stoppedAfterFailure = true;
        break;
      }
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
    await writeFile(tsconfigPath, originalTsconfig, "utf8");
    await rm(distDirPath, { recursive: true, force: true }).catch((error) => {
      console.warn(`[注意] 一時フォルダを削除できませんでした: ${error.message}`);
    });
  }
}
