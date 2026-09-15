import { createHmac } from "node:crypto";

const FALLBACK_SITE_URLS = [
  "https://hakkutsu-lab.com",
  "https://amateur-lab.vercel.app",
];

export async function revalidateProduction(tasks: string[]): Promise<void> {
  if (tasks.length === 0) return;
  if (process.env.ENABLE_PRODUCTION_REVALIDATE !== "true") return;

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const siteUrls = configuredSiteUrl ? [configuredSiteUrl] : FALLBACK_SITE_URLS;
  const cronSecret = process.env.CRON_SECRET?.trim();
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cronSecret && !signingSecret) {
    throw new Error("キャッシュ更新用の認証設定がありません");
  }

  const body = JSON.stringify({ tasks });
  const timestamp = Date.now().toString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  } else if (signingSecret) {
    headers["x-hakkutsu-timestamp"] = timestamp;
    headers["x-hakkutsu-signature"] = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }

  const failures: string[] = [];
  for (const siteUrl of siteUrls) {
    try {
      const endpoint = new URL("/api/admin/revalidate", siteUrl);
      if (["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
        throw new Error("本番URLではありません");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return;
    } catch (error) {
      failures.push(`${siteUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`本番キャッシュの更新に失敗しました: ${failures.join(" / ")}`);
}
