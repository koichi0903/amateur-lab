import Navbar from "./components/Navbar";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import WebSiteStructuredData from "./components/WebSiteStructuredData";
import OrganizationStructuredData from "./components/OrganizationStructuredData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0D1B2A",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://amateur-lab.vercel.app"),

  title: "発掘LAB | FANZA作品分析メディア",

  description:
    "FANZA作品をレビュー・人気女優・ランキング・セール情報から独自分析。毎日更新される発掘スコアでおすすめ作品を紹介します。",

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

  openGraph: {
    title: "発掘LAB | FANZA作品分析メディア",
    description:
      "FANZA作品をレビュー・人気女優・ランキング・セール情報から独自分析。",
    url: "https://amateur-lab.vercel.app",
    siteName: "発掘LAB",
    locale: "ja_JP",
    type: "website",
    images: [
    {
      url: "/ogp.png",
      width: 1200,
      height: 630,
      alt: "発掘LAB | FANZA作品分析メディア",
    },
  ],
  },

  twitter: {
  card: "summary_large_image",
  title: "発掘LAB | FANZA作品分析メディア",
  description:
    "FANZA作品をレビュー・人気女優・ランキング・セール情報から独自分析。",
  images: ["/ogp.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">

  <WebSiteStructuredData />
  <OrganizationStructuredData />

  <Navbar />

  <main className="flex-1">
    {children}
  </main>

  <Footer />
</body>
    </html>
  );
}
