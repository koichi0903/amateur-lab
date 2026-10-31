import { NextResponse } from "next/server";
import { searchDmmAffiliate } from "@/lib/dmm/dmmAffiliateSearch";

export async function GET(request: Request) {
  const apiId = process.env.DMM_API_ID?.trim();
  const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();

  if (!apiId || !affiliateId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "DMM_API_NOT_CONFIGURED",
          message: "DMM APIの設定がありません。管理者に確認してください。",
        },
      },
      { status: 503 },
    );
  }

  const outcome = await searchDmmAffiliate({
    apiId,
    affiliateId,
    requestUrl: request.url,
  });
  if (outcome.success) return NextResponse.json(outcome);

  const { status, ...body } = outcome;
  return NextResponse.json(body, { status });
}
