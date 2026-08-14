import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error("空きポートを取得できませんでした。"));
      });
    });
  });
}

const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const argumentsList = process.argv.slice(2);
const countFlagIndex = argumentsList.indexOf("--count");
const countValue =
  countFlagIndex >= 0 ? Number(argumentsList[countFlagIndex + 1]) : undefined;
const positionalArgument = argumentsList.find(
  (argument, index) =>
    argument !== "--count" && index !== countFlagIndex + 1,
);
const productId = positionalArgument?.trim();
const limit = Number.isFinite(countValue)
  ? Math.min(Math.max(Math.trunc(countValue), 1), 100)
  : productId
    ? 1
    : 10;
const distDirName = `.next-local-playwright-${port}`;
const distDirPath = resolve(process.cwd(), distDirName);
const tsconfigPath = resolve(process.cwd(), "tsconfig.json");
const originalTsconfig = await readFile(tsconfigPath, "utf8");
let interrupted = false;

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDirName,
      FORCE_COLOR: "1",
    },
    stdio: "inherit",
  },
);

console.log(`[local-playwright] localhost:${port} を使用します。`);
console.log(
  productId
    ? `[local-playwright] 作品 ${productId} を更新します。`
    : `[local-playwright] 古い作品から${limit}件更新します。Ctrl+Cで停止できます。`,
);

process.once("SIGINT", () => {
  interrupted = true;
  console.log("\n[停止] 現在のローカル更新を終了します。保存済みデータは維持されます。");
  void stopServer();
});

async function waitForServer() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `ローカルサーバーが起動前に終了しました（exit ${server.exitCode}）。`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/admin/browser-health`);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error("ローカルサーバーの起動を60秒以内に確認できませんでした。");
}

async function stopServer() {
  if (server.exitCode !== null) return;

  if (process.platform === "win32" && server.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    return;
  }

  server.kill("SIGTERM");
}

try {
  await waitForServer();
  const chunkSize = 10;
  const results = [];
  const processedProductIds = [];

  while (!interrupted && results.length < limit) {
    const remaining = limit - results.length;
    const response = await fetch(`${baseUrl}/api/admin/local-playwright-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        productId
          ? { productId }
          : {
              limit: Math.min(chunkSize, remaining),
              excludeProductIds: processedProductIds,
            },
      ),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message ?? `更新に失敗しました（HTTP ${response.status}）。`);
    }

    const chunkResults = result.results ?? [];
    if (chunkResults.length === 0) break;

    results.push(...chunkResults);
    processedProductIds.push(...chunkResults.map((item) => item.productId));
    console.log(
      `[進捗] ${results.length}/${limit}件（今回 更新${result.succeeded} / 利用不可${result.unavailable ?? 0} / 失敗${result.failed}）`,
    );

    if (productId) break;
  }

  const succeeded = results.filter((item) => item.status === "updated").length;
  const unavailable = results.filter(
    (item) => item.status === "unavailable",
  ).length;
  const failed = results.filter((item) => item.status === "failed").length;
  console.log(
    `\n[完了] 更新${succeeded}件 / 利用不可${unavailable}件 / 失敗${failed}件`,
  );
  for (const item of results) {
    const marker =
      item.status === "updated"
        ? "  ✓"
        : item.status === "unavailable"
          ? "  -"
          : "  ✗";
    console.log(
      `${marker} ${item.productId}${item.message ? `: ${item.message}` : ""}`,
    );
  }
  if (failed > 0) process.exitCode = 1;
} catch (error) {
  if (!interrupted) {
    console.error("\n[失敗]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
} finally {
  await stopServer();
  await writeFile(tsconfigPath, originalTsconfig, "utf8");
  await rm(distDirPath, { recursive: true, force: true }).catch((error) => {
    console.warn(
      `[注意] 一時フォルダを削除できませんでした: ${error.message}`,
    );
  });
}
