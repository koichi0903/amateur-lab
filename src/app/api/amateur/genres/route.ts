import { NextResponse } from "next/server";
import { getFanzaAmateurGenreNames } from "@/lib/dmm/fanzaAmateurCatalog";

export const revalidate = 3600;

export async function GET() {
  try {
    const genres = await getFanzaAmateurGenreNames();
    return NextResponse.json({ genres }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("[fanza-amateur] genre options load failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "素人作品のジャンルを読み込めませんでした" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
