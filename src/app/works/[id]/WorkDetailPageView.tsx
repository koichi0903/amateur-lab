import type { ComponentProps } from "react";
import type { Work } from "@/types/work";
import type { WorkDetailPriceOffer } from "@/lib/workDetailViewModel";
import Header from "@/components/layout/Header";
import Breadcrumb from "@/app/components/Breadcrumb";
import BreadcrumbJsonLd from "@/app/components/BreadcrumbJsonLd";
import ProductJsonLd from "@/app/components/ProductJsonLd";
import WorkPageViewTracker from "@/app/components/WorkPageViewTracker";
import WorkDetailHero from "@/app/components/WorkDetailHero";
import RelatedWorks from "@/app/components/RelatedWorks";
import MobilePurchaseBar from "@/app/components/MobilePurchaseBar";
import FanzaStyleWorkCard from "@/components/catalog/FanzaStyleWorkCard";

type WorkDetailHeroProps = ComponentProps<typeof WorkDetailHero>;

type Props = {
  work: Work;
  sampleImages: WorkDetailHeroProps["sampleImages"];
  sampleMovieUrl: WorkDetailHeroProps["sampleMovieUrl"];
  officialSampleEmbedUrl: WorkDetailHeroProps["officialSampleEmbedUrl"];
  priceHistory: WorkDetailHeroProps["priceHistory"];
  defaultPriceSeries: WorkDetailHeroProps["defaultPriceSeries"];
  relatedWorks: Work[];
  purchaseAlternatives: Work[];
  currentPrice: WorkDetailPriceOffer;
  mainMaker: string;
  displayPrice: number | null;
  discountRate: number;
};

function WorkBreadcrumbs({ work, mainMaker }: Pick<Props, "work" | "mainMaker">) {
  const items = [
    { label: "ホーム", href: "/" },
    ...(mainMaker ? [{ label: mainMaker, href: `/maker/${encodeURIComponent(mainMaker)}` }] : []),
    { label: work.title },
  ];

  return (
    <>
      <Breadcrumb variant="compact" items={items} />
      <BreadcrumbJsonLd
        items={[
          { name: "TOP", url: "/" },
          { name: work.title, url: `/works/${work.id}` },
        ]}
      />
      <ProductJsonLd work={work} />
    </>
  );
}

function PurchaseAlternativesSection({ works }: { works: Work[] }) {
  if (!works.length) return null;

  return (
    <section className="mt-8" aria-labelledby="purchase-alternatives-title">
      <div className="mb-4">
        <h2 id="purchase-alternatives-title" className="text-xl font-black text-zinc-900">価格を抑えて選びたい方へ</h2>
        <p className="mt-1 text-sm text-slate-600">表示中の作品より価格が低く、レビューが10件以上ある関連作品です。</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {works.map((candidate) => (
          <FanzaStyleWorkCard
            key={`purchase-alternative-${candidate.id}`}
            work={candidate}
            sourcePage="direct"
            showChart={false}
          />
        ))}
      </div>
    </section>
  );
}

export default function WorkDetailPageView({
  work,
  sampleImages,
  sampleMovieUrl,
  officialSampleEmbedUrl,
  priceHistory,
  defaultPriceSeries,
  relatedWorks,
  purchaseAlternatives,
  currentPrice,
  mainMaker,
  displayPrice,
  discountRate,
}: Props) {
  const alternativeIds = new Set(purchaseAlternatives.map((candidate) => candidate.id));
  const remainingRelatedWorks = relatedWorks.filter((candidate) => !alternativeIds.has(candidate.id));
  const ranking = typeof work.ranking === "number" ? work.ranking : null;
  const regularPrice = currentPrice.normal_price ?? work.price ?? null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-100 py-8 pb-24 md:pb-8">
        <WorkPageViewTracker
          workId={work.id}
          price={displayPrice}
          discountRate={discountRate}
          discoveryScore={null}
          ranking={ranking}
        />
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
          <WorkBreadcrumbs work={work} mainMaker={mainMaker} />
          <section className="mt-0 p-0 sm:p-8">
            <WorkDetailHero
              key={work.id}
              work={work}
              sampleImages={sampleImages}
              sampleMovieUrl={sampleMovieUrl}
              officialSampleEmbedUrl={officialSampleEmbedUrl}
              priceHistory={priceHistory}
              defaultPriceSeries={defaultPriceSeries}
              displayPrice={displayPrice}
              regularPrice={regularPrice}
              discountRate={discountRate}
            />
          </section>
          <PurchaseAlternativesSection works={purchaseAlternatives} />
          <RelatedWorks works={remainingRelatedWorks} />
        </div>
      </main>
      <MobilePurchaseBar
        work={work}
        displayPrice={displayPrice}
        displayDiscountRate={discountRate}
      />
    </>
  );
}
