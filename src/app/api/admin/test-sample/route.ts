import { NextResponse } from "next/server";
import { testSampleMovie } from "@/lib/admin/testSampleMovie";

export async function GET() {
  await testSampleMovie();

  return NextResponse.json({
    success: true,
  });
}