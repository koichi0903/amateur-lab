import { revalidatePath } from "next/cache";
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

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    tasks?: unknown;
  } | null;
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

  revalidatePath("/works/[id]", "page");
  for (const path of ["/actress/[name]", "/genre/[name]", "/maker/[name]", "/series/[name]"]) {
    revalidatePath(path, "page");
  }

  return NextResponse.json(
    { success: true, tasks, paths: [...paths] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
