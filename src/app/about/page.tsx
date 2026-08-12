import type { Metadata } from "next";
import Breadcrumb from "@/app/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "発掘LABについて | 発掘LAB", description: "発掘LABの発掘スコア、AI分析、掲載データについて紹介します。", canonical: "/about" });

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
    本当におすすめできる作品を紹介する分析メディアです。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    人気ランキングだけでは分からない作品の魅力を、
    レビュー・女優・メーカー・シリーズ・セール情報など
    複数のデータを組み合わせて分析しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    「データで見つける、隠れた名作。」
    それが発掘LABのコンセプトです。
  </p>

  </div>
  
  <div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
  <h2 className="mb-6 text-3xl font-bold">
    📊 発掘スコアとは
  </h2>

  <p className="mb-6 leading-8 text-gray-700">
    発掘スコアは、作品の人気だけではなく、
    複数のデータを総合的に分析して算出する
    発掘LAB独自の評価指標です。
  </p>

  <div className="grid gap-4 md:grid-cols-2">

    <div className="rounded-xl bg-indigo-50 p-4">
      ⭐ レビュー評価
    </div>

    <div className="rounded-xl bg-pink-50 p-4">
      👩 人気女優
    </div>

    <div className="rounded-xl bg-green-50 p-4">
      🏭 人気メーカー
    </div>

    <div className="rounded-xl bg-yellow-50 p-4">
      📚 人気シリーズ
    </div>

    <div className="rounded-xl bg-blue-50 p-4">
      🔥 セール情報
    </div>

    <div className="rounded-xl bg-purple-50 p-4">
      🏆 ランキング
    </div>

  </div>

  <p className="mt-6 leading-8 text-gray-700">
    これらのデータを組み合わせることで、
    ランキングだけでは見つからない作品との出会いをサポートします。
  </p>
</div>

<div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
  <h2 className="mb-6 text-3xl font-bold">
    🤖 AI分析について
  </h2>

  <p className="leading-8 text-gray-700">
    発掘LABでは、レビュー評価・人気データ・作品情報などをもとに、
    AIによる作品分析・女優分析を提供しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    数字だけでは分からない作品の特徴や魅力を、
    分かりやすい文章でまとめることで、
    初めて作品を探す方でも比較しやすくしています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    今後もAI分析機能は継続的に改善し、
    より精度の高い作品分析を目指します。
  </p>
</div>

<div className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
  <h2 className="mb-6 text-3xl font-bold">
    📀 データについて
  </h2>

  <p className="leading-8 text-gray-700">
    発掘LABでは、作品情報・画像・価格などのデータ取得に
    DMMアフィリエイトAPIを利用しています。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    表示されている価格・レビュー・セール情報は変更される場合があります。
    最新の情報は各作品ページをご確認ください。
  </p>

  <p className="mt-4 leading-8 text-gray-700">
    発掘LABは、独自の分析アルゴリズムを用いて
    FANZA作品をデータ分析する情報メディアです。
  </p>
</div>

      </div>
    </main>
  );
}
