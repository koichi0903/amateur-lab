import { updateMissingPrices } from "@/lib/admin/updateMissingPrices";

export async function POST() {
  try {
    const result = await updateMissingPrices();

    return Response.json({
      success: true,
      ...result,
      message: "価格補完完了",
    });
  } catch (error) {
    console.error("[update-missing-prices]", error);
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "価格補完に失敗しました",
      },
      { status: 500 }
    );
  }
}
