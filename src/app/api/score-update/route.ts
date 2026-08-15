import { updateScore } from "@/lib/admin/updateScore";

export async function POST() {
  try {
    const result = await updateScore();

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
        message:
          error instanceof Error
            ? `スコア更新に失敗しました: ${error.message}`
            : "スコア更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}
