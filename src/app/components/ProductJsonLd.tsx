import { withHakkutsuSiteAffiliateId } from "@/lib/dmm/siteAffiliateUrl";

type Work = {
  title: string;
  image_url: string | null;
  product_id: string;
  maker: string | null;
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

    description: `${work.title}のレビュー・評価・現在価格・価格推移を掲載しています。`,

    sku: work.product_id,

  };

  if (work.image_url) jsonLd.image = [work.image_url];
  if (work.maker) jsonLd.brand = { "@type": "Brand", name: work.maker };
  if (price && price > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      price,
      priceCurrency: "JPY",
      ...(work.affiliate_url ? { url: withHakkutsuSiteAffiliateId(work.affiliate_url) } : {}),
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
