import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_CACHE_TASKS, revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, body: string): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret && authorization === `Bearer ${secret}`) return true;

  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const timestamp = request.headers.get("x-hakkutsu-timestamp");
  const signature = request.headers.get("x-hakkutsu-signature");
  if (!signingSecret || !timestamp || !signature || !/^\d{13}$/.test(timestamp)) {
    return false;
  }
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!isAuthorized(request, body)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let payload: { tasks?: unknown } | null = null;
  try {
    payload = JSON.parse(body) as { tasks?: unknown };
  } catch {
    payload = null;
  }
  const tasks = Array.isArray(payload?.tasks)
    ? payload.tasks.filter(
        (task): task is string => typeof task === "string" && PUBLIC_CACHE_TASKS.has(task),
      )
    : [];

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "At least one known task is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await revalidatePublicCacheForTasks(tasks);

  return NextResponse.json(
    { success: true, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
