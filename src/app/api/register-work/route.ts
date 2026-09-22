import { NextResponse } from "next/server";

import { registerWork } from "@/lib/admin/registerWork";

export async function POST(request: Request) {
  try {
    const item = await request.json();

    const registration = await registerWork(item);

    return NextResponse.json({
      ...registration,
    }, {
      status: registration.status === "failed" ? 500 : registration.status === "partial" ? 422 : 200,
    });
  } catch (error) {
    console.error("register-work request failed", error instanceof Error ? error.message : "unknown");

    return NextResponse.json(
      {
        success: false,
        status: "failed",
        retryable: false,
        message: "登録処理に失敗しました。",
        verification: null,
      },
      {
        status: 500,
      }
    );
  }
}
