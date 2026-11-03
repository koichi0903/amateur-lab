import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";
import { updateRanking } from "@/lib/admin/updateRanking";
import { simpleErrorMessage } from "@/lib/errorMessage";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    const ranking = await updateRanking();
    await revalidatePublicCacheForTasks(["ranking"], { workIds: ranking.workIds });

    return Response.json({
      ...ranking,
      message: "ランキング更新が完了しました。",
    });
  } catch (error) {
    console.error("dmm-ranking error:", error);

    return Response.json(
      {
        success: false,
        message: `ランキング更新に失敗しました: ${simpleErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
