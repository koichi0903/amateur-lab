import type { NextRequest } from "next/server";

type SeriesRouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(request: NextRequest, { params }: SeriesRouteContext) {
  const { name } = await params;
  const destination = new URL("/search", request.url);
  destination.searchParams.set("q", name);

  return Response.redirect(destination, 307);
}
