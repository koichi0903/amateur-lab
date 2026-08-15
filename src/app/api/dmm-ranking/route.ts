import { updateRanking } from "@/lib/admin/updateRanking";

export async function POST() {
  try {
    const ranking = await updateRanking();

    return Response.json({
      ...ranking,
      message: "ランキング更新が完了しました。",
    });
  } catch (error) {
    console.error("dmm-ranking error:", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? `ランキング更新に失敗しました: ${error.message}`
            : "ランキング更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}
