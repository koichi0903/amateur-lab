import { updateReviewWorks } from "@/lib/admin/updateReviewWorks";

export async function POST() {
  try {
    await updateReviewWorks();

    return Response.json({
      success: true,
      message: "レビュー更新完了",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: "レビュー更新失敗",
      },
      {
        status: 500,
      }
    );
  }
}