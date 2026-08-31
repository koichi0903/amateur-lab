import { updateScore } from "@/lib/admin/updateScore";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { revalidatePath, revalidateTag } from "next/cache";

const SCORE_CACHE_TAGS = [
  "home-daily-discovery",
  "hero-price-drop",
  "home-price-insights",
  "ai-discoveries",
  "latest-daily-update",
  "home-ranking",
  "home-catalog",
  "deals",
] as const;

function revalidateScorePages() {
  if (process.env.ENABLE_BROAD_SCORE_REVALIDATE !== "true") {
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidateTag("home-ranking", "max");
    return;
  }

  for (const path of [
    "/",
    "/ranking",
    "/features",
    "/actress",
    "/genre",
    "/maker",
    "/series",
    "/sitemap.xml",
  ]) {
    revalidatePath(path);
  }

  for (const tag of SCORE_CACHE_TAGS) {
    revalidateTag(tag, tag === "home-price-insights" ? "max" : { expire: 0 });
  }

  revalidateTag("work-detail", "max");
  revalidatePath("/works/[id]", "page");
  for (const path of [
    "/actress/[name]",
    "/genre/[name]",
    "/maker/[name]",
    "/series/[name]",
  ]) {
    revalidatePath(path, "page");
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    const result = await updateScore();
    // A standalone score run must refresh public pages too. The local runner
    // also does this after the request, but keeping the guarantee here covers
    // direct API calls and manual retries.
    revalidateScorePages();

    return Response.json({
      ...result,
      success: true,
      message: "スコア更新が完了しました。",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: `スコア更新に失敗しました: ${errorMessage(error)}`,
      },
      {
        status: 500,
      },
    );
  }
}
