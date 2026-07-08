import { NextResponse } from "next/server";

import { updateSaleList } from "@/lib/admin/updateSaleList";

export async function GET() {
  const productIds = await updateSaleList();

  return NextResponse.json({
    updated: productIds?.length ?? 0,
  });
}