type Props = {
  title: string;
  description: string;
  url: string;
};

export default function CollectionPageJsonLd({
  title,
  description,
  url,
}: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",

    name: title,
    description,
    url,
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