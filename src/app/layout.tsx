import type { Metadata, Viewport } from "next";
import "./globals.css";
import WebSiteStructuredData from "./components/WebSiteStructuredData";
import OrganizationStructuredData from "./components/OrganizationStructuredData";
import { SITE_URL } from "@/lib/seo";
import AgeGate from "@/components/compliance/AgeGate";
import PublicDisclosure from "@/components/compliance/PublicDisclosure";
import Footer from "@/components/layout/Footer";
import Analytics from "./components/Analytics";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "発掘LAB | FANZA作品の買い時・価格比較",

  description:
    "FANZA作品の現在価格、過去最安値、レビュー、セール終了時期を比較して、購入前の判断をサポートします。",
  alternates: { canonical: "/" },

  icons: {
  icon: [
    { url: "/favicon.ico" },
    { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
  ],
  apple: "/apple-touch-icon.png",
},
  manifest: "/site.webmanifest",

  robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
},

verification: {
  google: "RqNgPmvAuSMFhPc9FSpAwXN6UC57Co-GzYysdq_pCTI",
},

openGraph: {
    title: "発掘LAB | FANZA作品の買い時・価格比較",
    description:
      "FANZA作品の現在価格、過去最安値、レビュー、セール終了時期を比較して購入判断をサポートします。",
    url: "/",
    siteName: "発掘LAB",
    locale: "ja_JP",
    type: "website",
    images: [
    {
      url: "/ogp.png",
      width: 1200,
      height: 630,
      alt: "発掘LAB | FANZA作品の買い時・価格比較",
    },
  ],
  },

  twitter: {
  card: "summary_large_image",
  title: "発掘LAB | FANZA作品の買い時・価格比較",
  description:
    "FANZA作品の現在価格、過去最安値、レビュー、セール終了時期を比較して購入判断をサポートします。",
  images: ["/ogp.png"],
},
  other: {
    rating: "adult",
    "color-scheme": "light",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">

  <WebSiteStructuredData />
<OrganizationStructuredData />
<Analytics />
<AgeGate />
<PublicDisclosure />

<div className="flex-1">
  {children}
</div>
<Footer />
</body>
    </html>
  );
}
