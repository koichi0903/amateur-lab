import { NextResponse } from "next/server";

import { updateAllWorks } from "@/lib/admin/updateAllWorks";

export async function GET() {
  try {
    await updateAllWorks();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Error",
      },
      {
        status: 500,
      }
    );
  }
}