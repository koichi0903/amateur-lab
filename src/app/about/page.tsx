import type { Metadata } from "next";
import Breadcrumb from "@/app/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "発掘LABについて｜FANZA作品の価格・レビュー分析 | 発掘LAB", description: "発掘LABがFANZA作品の情報、価格、レビュー、セール情報をどのように掲載しているか紹介します。", canonical: "/about" });

export default async function AboutPage() {

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-6xl p-8">

        <Breadcrumb
  items={[
    { label: "🏠 TOP", href: "/" },
    { label: "🔬 発掘LABについて" },
  ]}
/>

        <h1 className="mb-4 text-5xl font-black">
          🔬 発掘LABについて
        </h1>

        <p className="mb-10 text-xl text-gray-600">
          データで見つける、隠れた名作。
        </p>

        <div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
  <h2 className="mb-4 text-3xl font-bold">
    🔬 発掘LABとは
  </h2>

  <p className="leading-8 text-gray-700">
    発掘LABは、FANZA作品を独自の分析データから評価し、
    作品情報や価格を比較しやすく整理する情報メディアです。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    作品情報、レビュー、女優、メーカー、シリーズ、価格、セール情報などを
    作品ページや検索ページで確認できるように掲載しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    「データで見つける、隠れた名作。」
    それが発掘LABのコンセプトです。
  </p>

  </div>
  
<div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
  <h2 className="mb-6 text-3xl font-bold">
    📀 データについて
  </h2>

  <p className="leading-8 text-gray-700">
    発掘LABでは、作品情報・画像・価格などのデータを取得し、ページに表示しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    表示されている価格・レビュー・セール情報は変更される場合があります。
    最新の情報は各作品ページをご確認ください。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    価格やセール情報は変わる場合があるため、購入前にFANZA公式ページをご確認ください。
  </p>
</div>

<div className="mb-8 rounded-2xl border border-pink-100 bg-white p-8 shadow-sm">
  <h2 className="mb-6 text-3xl font-bold">
    広告・アフィリエイトについて
  </h2>

  <p className="leading-8 text-gray-700">
    発掘LABはアフィリエイト広告を利用しています。作品ページからFANZAへ移動し、
    商品を購入された場合、発掘LABに紹介料が支払われることがあります。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    アフィリエイトリンクを経由しても、お客様の購入価格が上がることはありません。
    ランキングや検索結果は、各ページに表示されるデータと条件に基づいて掲載しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    表示価格、セール期間、販売状況は変更される場合があります。購入前にFANZA公式ページで
    最新情報をご確認ください。
  </p>
</div>

      </div>
    </main>
  );
}
