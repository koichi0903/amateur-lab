import { NextResponse } from "next/server";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

export async function POST() {
  try {
    await updatePlaywrightItem("sone00672");

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