import { updateScore } from "@/lib/admin/updateScore";

export async function POST() {
  try {
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