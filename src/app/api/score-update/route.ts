import { updateScore } from "@/lib/admin/updateScore";

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
        message: `スコア更新に失敗しました: ${errorMessage(error)}`,
      },
      {
        status: 500,
      },
    );
  }
}
