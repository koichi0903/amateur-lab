type BreadcrumbItem = {
  name: string;
  url: string;
};

type Props = {
  items: BreadcrumbItem[];
};

const BASE_URL = "https://amateur-lab.vercel.app";

export default function BreadcrumbJsonLd({ items }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
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