import {
  getCatalogSitemapEntries,
  getStaticSitemapEntries,
  getWorkSitemapEntries,
  renderSitemap,
} from "@/lib/seoSitemap";

export const revalidate = 3600;

type SitemapRouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(_request: Request, context: SitemapRouteContext) {
  const { name } = await context.params;

  if (name === "static.xml") {
    return renderSitemap(getStaticSitemapEntries());
  }

  if (name === "works.xml") {
    return renderSitemap(await getWorkSitemapEntries());
  }

  if (name === "catalog.xml") {
    return renderSitemap(await getCatalogSitemapEntries());
  }

  return new Response("Not Found", { status: 404 });
}
