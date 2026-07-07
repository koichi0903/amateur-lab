import { NextResponse } from "next/server";

import { getSaleItems } from "@/lib/playwright/getSaleItems";

export async function GET() {
  const result = await getSaleItems();

  console.log("総ページ数:", result.totalPages);
  console.log("取得件数:", result.productIds.length);
  console.log(result.productIds.slice(0, 10));

  return NextResponse.json(result);
}