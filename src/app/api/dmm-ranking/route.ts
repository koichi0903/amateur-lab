import { updateRanking } from "@/lib/admin/updateRanking";

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
        message: `ランキング更新に失敗しました: ${errorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
