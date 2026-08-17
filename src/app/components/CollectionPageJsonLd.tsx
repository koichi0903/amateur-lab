type Props = {
  title: string;
  description: string;
  url: string;
  items?: Array<{
    name: string;
    url: string;
    image?: string | null;
  }>;
};

export default function CollectionPageJsonLd({ title, description, url, items = [] }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url,
    ...(items.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              url: item.url,
              ...(item.image ? { image: item.image } : {}),
            })),
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
