import { NextResponse } from "next/server";

import { fillSampleMovieUrls } from "@/lib/admin/fillSampleMovieUrls";
import { formatUnknownError } from "@/lib/errorMessage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await fillSampleMovieUrls();

    return NextResponse.json({
      success: true,
      ...result,
      message: result.completed
        ? `サンプル動画補完が完了しました（今回 保存${result.saved}件・動画なし${result.missing}件）`
        : `サンプル動画補完を継続します（${result.processedCount}/${result.totalCount}件）`,
    });
  } catch (error) {
    const message = formatUnknownError(error);
    console.error(`[fill-sample-movie] ${message}`, error);
    return NextResponse.json(
      { success: false, completed: false, message },
      { status: 500 },
    );
  }
}
