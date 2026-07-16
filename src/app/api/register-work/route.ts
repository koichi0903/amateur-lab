import { NextResponse } from "next/server";

import { registerWork } from "@/lib/admin/registerWork";

export async function POST(request: Request) {
  try {
    const item = await request.json();

    await registerWork(item);

    return NextResponse.json({
      success: true,
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