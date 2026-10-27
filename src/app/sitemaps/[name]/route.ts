import {
  getAmateurActressSitemapEntries,
  getAmateurActressSitemapPaths,
  getCatalogSitemapEntries,
  getStaticSitemapEntries,
  getWorkSitemapEntries,
  getWorkSitemapPaths,
  renderSitemap,
  renderSitemapIndex,
} from "@/lib/seoSitemap";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type SitemapRouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(_request: Request, context: SitemapRouteContext) {
  const { name } = await context.params;

  if (name === "static.xml") {
    return renderSitemap(getStaticSitemapEntries());
  }

  if (name === "works.xml") {
    return renderSitemapIndex(await getWorkSitemapPaths());
  }

  if (name === "catalog.xml") {
    return renderSitemap(await getCatalogSitemapEntries());
  }

  const amateurActressChunk = /^amateur-actress-(\d+)\.xml$/.exec(name);
  if (amateurActressChunk) {
    const chunkNumber = Number.parseInt(amateurActressChunk[1], 10);
    const paths = await getAmateurActressSitemapPaths();
    if (chunkNumber < 1 || chunkNumber > paths.length) {
      return new Response("Not Found", { status: 404 });
    }

    return renderSitemap(await getAmateurActressSitemapEntries(chunkNumber));
  }

  const workChunk = /^works-(\d+)\.xml$/.exec(name);
  if (workChunk) {
    const chunkNumber = Number.parseInt(workChunk[1], 10);
    if (chunkNumber < 1 || chunkNumber > 1000) {
      return new Response("Not Found", { status: 404 });
    }

    return renderSitemap(await getWorkSitemapEntries(chunkNumber));
  }

  return new Response("Not Found", { status: 404 });
}

