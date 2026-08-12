type Work = {
  title: string;
  image_url: string | null;
  product_id: string;
  maker: string | null;
  review_average: number | null;
  review_count: number | null;
  sale_price: number | null;
  price: number | null;
  affiliate_url?: string | null;
};

type Props = {
  work: Work;
};

export default function ProductJsonLd({
  work,
}: Props) {
  const price = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",

    name: work.title,

    description: `${work.title}のレビュー・評価・発掘スコアを掲載しています。`,

    sku: work.product_id,

  };

  if (work.image_url) jsonLd.image = [work.image_url];
  if (work.maker) jsonLd.brand = { "@type": "Brand", name: work.maker };
  if (work.review_average && work.review_average > 0 && work.review_count && work.review_count > 0) {
    jsonLd.aggregateRating = { "@type": "AggregateRating", ratingValue: work.review_average, reviewCount: work.review_count };
  }
  if (price && price > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      price,
      priceCurrency: "JPY",
      ...(work.affiliate_url ? { url: work.affiliate_url } : {}),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  );
}
