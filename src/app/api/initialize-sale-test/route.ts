import { NextResponse } from "next/server";

import { initializeSaleStatus } from "@/lib/admin/initializeSaleStatus";

export async function GET() {
  const result = await initializeSaleStatus();

  return NextResponse.json({
    saleItems: result.saleItems,
    matchedWorks: result.matchedWorks.length,
  });
}