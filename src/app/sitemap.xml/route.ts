import { renderSitemapIndex } from "@/lib/seoSitemap";

export const revalidate = 3600;

export function GET() {
  return renderSitemapIndex([
    "/sitemaps/static.xml",
    "/sitemaps/works.xml",
    "/sitemaps/catalog.xml",
  ]);
}
