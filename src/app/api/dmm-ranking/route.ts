import { updateRanking } from "@/lib/admin/updateRanking";

export async function POST() {
  try {
    const ranking = await updateRanking();

    return Response.json(ranking);
  } catch (error) {
    console.error("dmm-ranking error:", error);

    return Response.json(
      {
        success: false,
        message: "ランキング更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}