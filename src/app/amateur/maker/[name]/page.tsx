import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import AmateurEntityDetailPage from "@/components/catalog/AmateurEntityDetailPage";
import { pageMetadata } from "@/lib/seo";
import { getFanzaAmateurTaxonomy } from "@/lib/dmm/fanzaAmateurCatalog";

function decodeName(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string; sort?: string }> }): Promise<Metadata> {
  const [{ name: encodedName }, query] = await Promise.all([params, searchParams]);
  const name = decodeName(encodedName);
  const entity = (await getFanzaAmateurTaxonomy("maker")).find((item) => item.name === name);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const isDefaultView = page === 1 && (!query.sort || query.sort === "rank");
  const count = entity?.count ?? 0;
  return pageMetadata({
    title: `${name}｜FANZA素人作品のメーカー別一覧 | 発掘LAB`,
    description: `${name}のFANZA素人作品を人気順などで掲載。登録作品数は${count.toLocaleString("ja-JP")}件です。各作品の発売日・価格・サンプルを確認できます。`,
    canonical: `/amateur/maker/${encodeURIComponent(name)}`,
    image: entity?.imageUrl || "/ogp.png",
    robots: { index: Boolean(entity && count >= 24 && isDefaultView), follow: true },
  });
}

export default async function AmateurMakerDetailRoute({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ page?: string; sort?: string }> }) {
  const { name } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  return <><Header /><AmateurEntityDetailPage kind="maker" name={name} page={page} requestedSort={query.sort} /></>;
}
