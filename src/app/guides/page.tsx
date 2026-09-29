import type { Metadata } from "next";
import Link from "next/link";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import { analyzerGuideArticles } from "@/lib/analyzerGuideContent";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FANZAガイド・使い方まとめ | 発掘LAB",
  description: "FANZAをお得に・賢く使うためのガイド記事一覧です。",
  canonical: "/guides",
});

const guideCards = [
  {
    guide: analyzerGuideArticles[0],
    badge: "入門",
    title: "FANZAライブチャットとは？動画との違いと楽しみ方を徹底解説",
    description: "リアルタイムで楽しめるFANZAライブチャットの基本から、ポイント購入・使い方・注意点まで詳しく解説します。",
  },
  {
    guide: analyzerGuideArticles[1],
    badge: "セール",
    title: "FANZAのセールはいつ？過去データから読み解くお得な買い時",
    description: "価格推移データをもとに、FANZAセールのパターンと傾向を分析。10円セール・半額セールを見逃さない方法を紹介します。",
  },
  {
    guide: analyzerGuideArticles[2],
    badge: "登録",
    title: "FANZAの登録方法・始め方【画像付きで手順を解説】",
    description: "FANZA（旧DMM.R18）の会員登録手順をわかりやすく解説。無料登録からコンテンツ購入まですべての流れを紹介します。",
  },
  {
    guide: analyzerGuideArticles[3],
    badge: "見放題",
    title: "FANZAの見放題サービスを比較｜FANZA TV・月額動画の選び方",
    description: "FANZA TV、FANZA TV Plus、月額動画の違いを整理し、自分に合う見放題サービスの選び方を解説します。",
  },
  {
    guide: analyzerGuideArticles[4],
    badge: "VR",
    title: "FANZA VRの始め方｜VR動画とVRchの違い・対応機器を解説",
    description: "FANZA VR動画の単品購入とVRch（月額VR）の違い、対応機器、再生方法を解説します。",
  },
] as const;

export default function GuidesPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="FANZAガイド・使い方まとめ"
          description="FANZAをお得に・賢く使うためのガイド記事一覧です。"
          url={`${SITE_URL}/guides`}
          items={guideCards.map(({ guide, title }) => ({ name: title, url: `${SITE_URL}/guides/${guide.slug}` }))}
        />
        <div className="mx-auto max-w-[740px] px-4 py-6 sm:px-6 sm:py-8">
          <span className="inline-flex rounded border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">広告・PR</span>
          <nav aria-label="パンくず" className="mt-5 text-xs font-bold text-slate-500">
            <Link href="/" className="hover:text-pink-600">ホーム</Link><span className="mx-2">/</span><span>ガイド</span>
          </nav>
          <h1 className="mt-7 text-2xl font-black tracking-tight sm:text-3xl">FANZAガイド・使い方まとめ</h1>
          <p className="mt-2 text-sm text-slate-400">FANZAをお得に・賢く使うためのガイド記事一覧です。</p>

          <div className="mt-8 space-y-4">
            {guideCards.map(({ guide, badge, title, description }) => (
              <Link key={guide.slug} href={`/guides/${guide.slug}`} className="block rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-pink-300 hover:shadow-md">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 rounded border border-pink-200 bg-pink-50 px-2 py-1 text-xs font-bold text-pink-600">{badge}</span>
                  <div className="min-w-0">
                    <h2 className="font-black text-slate-950">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
