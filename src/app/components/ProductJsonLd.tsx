type Props = {
  work: any;
};

export default function ProductJsonLd({ work }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",

    name: work.title,

    image: work.image_url,

    description:
      `${work.title}のレビュー・評価・発掘スコアを掲載しています。`,

    sku: work.product_id,

    brand: {
      "@type": "Brand",
      name: work.maker,
    },

    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: work.review_average || 0,
      reviewCount: work.review_count || 0,
    },

    offers: {
      "@type": "Offer",
      price: work.sale_price || work.price,
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