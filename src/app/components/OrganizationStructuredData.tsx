export default function OrganizationStructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "発掘LAB",
    url: "https://amateur-lab.vercel.app",
    logo: "https://amateur-lab.vercel.app/icon.png",
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