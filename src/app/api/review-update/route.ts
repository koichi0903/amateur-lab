import { NextResponse } from "next/server";

import { updateReviewWorks } from "@/lib/admin/updateReviewWorks";

export const maxDuration = 300;

const REVIEW_BATCH_SIZE = 250;
const REVIEW_TIME_BUDGET_MS = 240_000;

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
    const result = await updateReviewWorks({
      maxItems: REVIEW_BATCH_SIZE,
      timeBudgetMs: REVIEW_TIME_BUDGET_MS,
    });

    const { success: successCount, ...reviewResult } = result;

    return NextResponse.json({
      success: true,
      ...reviewResult,
      successCount,
      message: result.completed
        ? "レビュー更新が完了しました。"
        : `レビュー更新中 ${result.processedCount}/${result.totalCount}`,
    });
  } catch (error) {
    console.error("review-update error:", error);

    return NextResponse.json(
      {
        success: false,
        message: `レビュー更新に失敗しました: ${errorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
