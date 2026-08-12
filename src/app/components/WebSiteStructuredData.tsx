import { SITE_URL } from "@/lib/seo";

export default function WebSiteStructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "発掘LAB",
    url: SITE_URL,
    description:
      "FANZA作品をレビュー・人気女優・ランキング・セール情報から独自分析する作品分析メディア",
    inLanguage: "ja",
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
