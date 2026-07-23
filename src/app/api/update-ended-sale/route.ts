import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";

export async function POST() {
  try {
    await updateEndedSaleWorks();

return Response.json({
  success: true,
  message: "終了セール更新が完了しました。",
});
  } catch (error) {
    console.error("update-ended-sale error:", error);

    return Response.json(
      {
        success: false,
        message: "終了セール更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}