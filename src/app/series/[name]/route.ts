type SeriesRouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(request: Request, { params }: SeriesRouteContext) {
  const { name } = await params;
  const destination = new URL("/search", request.url);
  destination.searchParams.set("q", name);

  return Response.redirect(destination, 307);
}
