import { updateScore } from "@/lib/admin/updateScore";
import { updateRanking } from "@/lib/playwright/updateRanking";
import { updateLongHitRanking } from "@/lib/playwright/updateLongHitRanking";

export async function POST() {
  try {

await updateRanking();

await updateLongHitRanking();

const result = await updateScore();

    return Response.json({
      ...result,
      message: "スコア更新完了",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: "スコア更新失敗",
      },
      {
        status: 500,
      }
    );
  }
}