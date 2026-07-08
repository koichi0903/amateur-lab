type Work = {
  title: string;
  image_url: string | null;
  product_id: string;
  maker: string | null;
  review_average: number | null;
  review_count: number | null;
  sale_price: number | null;
  price: number | null;
};

type Props = {
  work: Work;
};

export default function ProductJsonLd({
  work,
}: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",

    name: work.title,

    image: work.image_url,

    description: `${work.title}のレビュー・評価・発掘スコアを掲載しています。`,

    sku: work.product_id,

    brand: {
      "@type": "Brand",
      name: work.maker,
    },

    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: work.review_average ?? 0,
      reviewCount: work.review_count ?? 0,
    },

    offers: {
      "@type": "Offer",
      price: work.sale_price ?? work.price ?? 0,
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd),
      }}
    />
  );
}