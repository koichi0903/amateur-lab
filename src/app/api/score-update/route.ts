import { updateScore } from "@/lib/admin/updateScore";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";

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
    await revalidatePublicCacheForTasks(["score"], { workIds: result.workIds });

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
