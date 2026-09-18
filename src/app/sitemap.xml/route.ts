import {
  getWorkSitemapPaths,
  renderSitemapIndex,
} from "@/lib/seoSitemap";

export const revalidate = 3600;
// Sitemap entries depend on the runtime catalog. Do not query Supabase while
// producing the application build; serve the same sitemap from the server.
export const dynamic = "force-dynamic";

export async function GET() {
  const workSitemaps = await getWorkSitemapPaths();

  return renderSitemapIndex([
    "/sitemaps/static.xml",
    "/sitemaps/catalog.xml",
    ...workSitemaps,
  ]);
}
