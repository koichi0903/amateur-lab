import { SITE_URL } from "@/lib/seo";

export default function OrganizationStructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "発掘LAB",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512x512.png`,
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
