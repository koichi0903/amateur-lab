import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KNOWN_TASKS = new Set([
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
  "missing-prices",
  "sample-movie",
]);

const ENTITY_PATHS = ["/actress", "/genre", "/maker", "/series"];
const CATALOG_TASKS = new Set(["reserve", "new", "semi-new", "old", "stage"]);
const PRICE_TASKS = new Set(["sale", "ended-sale", "missing-prices"]);
const DISCOVERY_TASKS = new Set(["review", "ranking", "score"]);
const WORK_DETAIL_CACHE_TAG = "work-detail";

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
        (task): task is string => typeof task === "string" && KNOWN_TASKS.has(task),
      )
    : [];

  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "At least one known task is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const paths = new Set(["/"]);
  if (tasks.some((task) => CATALOG_TASKS.has(task))) {
    for (const path of ["/new", "/ranking", "/features", ...ENTITY_PATHS, "/sitemap.xml"]) {
      paths.add(path);
    }
  }
  if (tasks.some((task) => PRICE_TASKS.has(task))) {
    for (const path of ["/sale", "/deals", "/ranking"]) paths.add(path);
  }
  if (tasks.some((task) => DISCOVERY_TASKS.has(task))) {
    for (const path of ["/ranking", "/features", ...ENTITY_PATHS]) paths.add(path);
  }
  for (const path of paths) revalidatePath(path);

  revalidateTag(WORK_DETAIL_CACHE_TAG, "max");
  revalidateTag("home-daily-discovery", "max");
  revalidateTag("hero-price-drop", "max");
  revalidateTag("ai-discoveries", "max");
  revalidateTag("latest-daily-update", "max");
  revalidateTag("home-ranking", "max");
  revalidateTag("home-catalog", "max");
  revalidateTag("deals", "max");
  revalidatePath("/works/[id]", "page");
  for (const path of ["/actress/[name]", "/genre/[name]", "/maker/[name]", "/series/[name]"]) {
    revalidatePath(path, "page");
  }

  return NextResponse.json(
    { success: true, tasks, paths: [...paths] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
