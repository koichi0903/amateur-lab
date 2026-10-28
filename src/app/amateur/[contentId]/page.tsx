import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import FanzaAmateurDetailHero from "@/components/catalog/FanzaAmateurDetailHero";
import Breadcrumb from "@/app/components/Breadcrumb";
import { addConfirmedPerformersToAmateurItems, getFanzaAmateurCatalogWork, getFanzaAmateurRelatedWorks, getFanzaAmateurSamplePlayerUrl, type FanzaAmateurCatalogItem, type FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurCatalog";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

function displayText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function generateMetadata({ params }: { params: Promise<{ contentId: string }> }): Promise<Metadata> {
  const { contentId } = await params;
  const result = await getFanzaAmateurCatalogWork(contentId);
  if (!result) {
    return pageMetadata({
      title: "素人作品が見つかりません | 発掘LAB",
      description: "指定された素人作品は見つかりませんでした。",
      canonical: `/amateur/${encodeURIComponent(contentId)}`,
      robots: { index: false, follow: true },
    });
  }

  const { item } = result;
  const genres = (item.iteminfo?.genre ?? []).map(({ name }) => name.trim()).filter(Boolean).slice(0, 4);
  const price = displayText(item.prices?.price);
  const date = displayText(item.date);
  const detail = [
    date ? `発売日${date}` : "",
    price ? `現在価格${price}` : "",
    genres.length ? `ジャンル${genres.join("、")}` : "",
    "発掘LABで価格履歴とサンプル画像を確認できます。",
  ].filter(Boolean).join("。 ");

  return pageMetadata({
    title: `${item.title}｜FANZA素人作品の価格・詳細 | 発掘LAB`,
    description: `${item.title}の作品情報。${detail}`.slice(0, 160),
    canonical: `/amateur/${encodeURIComponent(item.content_id)}`,
    image: item.imageUrl || "/ogp-20261028.png",
    // Product pages currently have sparse, API-sourced copy and limited price history.
    // Keep them discoverable through internal links without indexing thousands of thin pages.
    robots: { index: false, follow: true },
  });
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || null;
  }
  return null;
}

function sampleImages(item: FanzaAmateurCatalogItem) {
  const raw = item.sampleImageURL;
  // sample_s contains lower-resolution copies of sample_l with matching
  // image numbers. Prefer the large set; use small images only as a fallback.
  const largeImages = raw?.sample_l?.image ?? [];
  const values = largeImages.length > 0 ? largeImages : (raw?.sample_s?.image ?? []);
  return [...new Set(values)].filter((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.endsWith(".dmm.co.jp");
    } catch {
      return false;
    }
  }).slice(0, 8);
}

export default async function FanzaAmateurWorkPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  let result: Awaited<ReturnType<typeof getFanzaAmateurCatalogWork>>;
  try {
    result = await getFanzaAmateurCatalogWork(contentId);
  } catch (error) {
    console.error("[fanza-amateur] work detail load failed", error instanceof Error ? error.message : "unknown");
    throw error;
  }
  if (!result) notFound();

  const { item, fetchedAt, priceHistory, mp4Url } = result;
  const [itemWithPerformers] = await addConfirmedPerformersToAmateurItems([item]);
  const rawItem = item as unknown as Record<string, unknown>;
  const samples = sampleImages(item);
  const relatedItems = await addConfirmedPerformersToAmateurItems(await getFanzaAmateurRelatedWorks(item));
  const relatedWorks: FanzaAmateurHomeCard[] = relatedItems.map((related) => ({
    item: related,
    priceHistory: [],
    priceWindowStartAt: fetchedAt,
    priceWindowEndAt: fetchedAt,
    lowestObservedPrice: null,
  }));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-100 py-8 pb-24 text-slate-950 md:pb-8">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
          <Breadcrumb variant="compact" items={[{ label: "トップ", href: "/" }, { label: "FANZA素人作品", href: "/amateur" }, { label: "作品詳細" }]} />
          <section className="mt-0 p-0 sm:p-8">
            <FanzaAmateurDetailHero item={itemWithPerformers} fetchedAt={fetchedAt} volume={textValue(rawItem.volume)} officialSampleEmbedUrl={getFanzaAmateurSamplePlayerUrl(item)} sampleMovieMp4Url={mp4Url} sampleImages={samples} priceHistory={priceHistory} />
          </section>

          {relatedWorks.length > 0 && <section className="mt-12">
            <div className="mb-5 flex items-center gap-3"><span className="h-7 w-1 rounded-full bg-pink-500" aria-hidden="true" /><h2 className="text-2xl font-black text-zinc-900">関連作品</h2></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {relatedWorks.map((related) => <FanzaAmateurTopCard key={related.item.content_id} card={related} showChart={false} sourcePage="amateur_detail" />)}
            </div>
          </section>}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Link href="/amateur" className="text-sm font-black text-pink-700 hover:underline">← 素人作品一覧へ戻る</Link><p className="text-xs text-slate-500">作品情報・価格はDMM APIの取得内容です。取得時刻を併記しています。</p></div>
        </div>
      </main>
    </>
  );
}

