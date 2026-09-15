import { NextResponse } from "next/server";

import { registerWork } from "@/lib/admin/registerWork";

export async function POST(request: Request) {
  try {
    const item = await request.json();

    const registered = await registerWork(item);

    return NextResponse.json({
      success: registered,
      message: registered ? "作品を登録しました" : "作品は登録済みです",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}
