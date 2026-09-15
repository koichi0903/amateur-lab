import {
  getWorkSitemapPaths,
  renderSitemapIndex,
} from "@/lib/seoSitemap";

export const revalidate = 3600;

export async function GET() {
  const workSitemaps = await getWorkSitemapPaths();

  return renderSitemapIndex([
    "/sitemaps/static.xml",
    "/sitemaps/catalog.xml",
    ...workSitemaps,
  ]);
}
