import { supabase } from "../../../lib/supabase";
import type { Metadata } from "next";
import WorkHero from "../../components/WorkHero";
import WorkInfo from "../../components/WorkInfo";
import AIAnalysis from "../../components/AIAnalysis";
import RelatedWorks from "../../components/RelatedWorks";
import PriceHistory from "@/app/components/PriceHistory";
import PriceTypes from "@/app/components/PriceTypes";
import Breadcrumb from "@/app/components/Breadcrumb";
import BreadcrumbJsonLd from "@/app/components/BreadcrumbJsonLd";
import Link from "next/link";
import ProductJsonLd from "@/app/components/ProductJsonLd";



export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  const { data: work } = await supabase
  .from("works")
  .select("*")
  .eq("id", id)
  .single();

const {
  data: priceHistory,
  error: priceHistoryError,
} = await supabase
  .from("price_history")
  .select("*")
  .eq("product_id", work?.product_id)
  .order("changed_at", {
  ascending: false,
})
  .limit(100)

console.log("priceHistory =", priceHistory);
console.log("priceHistoryError =", priceHistoryError);

  if (!work) {
    return {
      title: "作品情報 | 発掘LAB",
    };
  }

  return {
  title: `${work.title}｜レビュー・発掘スコア${work.score} | 発掘LAB`,
  description:
    `${work.title}のレビュー・評価・発掘スコアを掲載。女優「${work.actress}」出演作品を独自アルゴリズムで分析しています。`,

  alternates: {
    canonical: `/works/${id}`,
  },

  keywords: [
  work.title,
  work.actress,
  "FANZA",
  "レビュー",
  "AV",
  "発掘LAB",
  "おすすめ作品",
],

  openGraph: {
  title: `${work.title} | 発掘LAB`,
  description: `${work.title}のレビュー・評価・発掘スコアを掲載しています。`,
  type: "article",
  images: [work.image_url],
},
  
    };
}

export default async function WorkDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .single();

  const { data: priceHistory } = await supabase
  .from("price_history")
  .select("*")
  .eq("product_id", work?.product_id)
  .order("changed_at", {
  ascending: false,
})
  .limit(100)

  const { data: workPrices } = await supabase
  .from("work_prices")
  .select("*")
  .eq("product_id", work?.product_id)
  .order("display_name");

  if (!work) {
    return <div>作品が見つかりません</div>;
  }

  const mainActress =
  work.actress?.split(" / ")[0] || "";

const { data: relatedWorks } = await supabase
  .from("works")
  .select("*")
  .ilike(
    "actress",
    `%${mainActress}%`
  )
  .neq("id", work.id)
  .limit(6);

  const reasons: string[] = [];
const comments: string[] = [];

const points: string[] = [];

if ((work.review_average ?? 0) >= 4.7) {
  points.push(`レビュー評価${work.review_average}点`);
}

if ((work.ranking ?? 9999) <= 50) {
  points.push(`FANZAランキング${work.ranking}位`);
}

if ((work.discount_rate ?? 0) >= 30) {
  points.push(`${work.discount_rate}%OFFセール`);
}

if ((work.new_release_score ?? 0) >= 8) {
  points.push("発売直後");
}

let summary =
  "人気・評価・価格を総合分析した結果、おすすめできる作品です。";

if (points.length > 0) {
  summary +=
    "\n\n" +
    points.join("・") +
    " が評価されています。";
}

if ((work.review_average ?? 0) >= 4.7) {
  comments.push(
    `レビュー${work.review_average}点の非常に高評価作品です。`
  );
}

if ((work.ranking ?? 9999) <= 50) {
  comments.push(
    `現在FANZAランキング${work.ranking}位の人気作品です。`
  );
}

if ((work.discount_rate ?? 0) >= 50) {
  comments.push(
    `現在${work.discount_rate}%OFFセール中です。`
  );
}

if ((work.new_release_score ?? 0) >= 8) {
  comments.push(
    "発売から間もない注目作品です。"
  );
}

if ((work.actress_point ?? 0) >= 18) {
  comments.push(
    `${mainActress}出演の注目作品です。`
  );
}

if ((work.ranking ?? 9999) <= 100) {
  reasons.push("🏆 FANZAランキング上位");
}

if ((work.review_average ?? 0) >= 4.5) {
  reasons.push("⭐ 高評価レビュー");
}

if ((work.discount_rate ?? 0) >= 30) {
  reasons.push("💰 セール対象作品");
}

if ((work.actress_point ?? 0) >= 18) {
  reasons.push("👩 人気女優出演");
}

if ((work.new_release_score ?? 0) >= 8) {
  reasons.push("🆕 新作ボーナス対象");
}

  return (
  <main className="min-h-screen bg-gray-100 p-8">
  <div className="max-w-7xl mx-auto">


    <Breadcrumb
  items={[
    { label: "🏠 TOP", href: "/" },
    { label: work.title },
  ]}
/>

<BreadcrumbJsonLd
  items={[
    { name: "TOP", url: "/" },
    { name: work.title, url: `/works/${work.id}` },
  ]}
/>

<ProductJsonLd work={work} />

<WorkHero
      work={work}
      reasons={reasons}
    />

    <AIAnalysis
  summary={summary}
  comments={comments}
/>

    <WorkInfo work={work} />

<PriceHistory history={priceHistory ?? []} />

<PriceTypes prices={workPrices ?? []} />

<RelatedWorks works={relatedWorks} />

    <div className="mt-10 rounded-xl border bg-white p-6 shadow-sm">
  <h2 className="mb-4 text-2xl font-bold">
    🔗 関連ページ
  </h2>

  <div className="flex flex-wrap gap-3">

    {mainActress && (
      <Link
        href={`/actress/${encodeURIComponent(mainActress)}`}
        className="rounded-lg bg-pink-100 px-4 py-2 font-semibold hover:bg-pink-200"
      >
        👩 {mainActress}の作品一覧
      </Link>
    )}

    {work.genre && (
      <Link
        href={`/genre/${encodeURIComponent(work.genre)}`}
        className="rounded-lg bg-indigo-100 px-4 py-2 font-semibold hover:bg-indigo-200"
      >
        🏷 {work.genre}
      </Link>
    )}

    {work.maker && (
      <Link
        href={`/maker/${encodeURIComponent(work.maker)}`}
        className="rounded-lg bg-green-100 px-4 py-2 font-semibold hover:bg-green-200"
      >
        🏢 {work.maker}
      </Link>
    )}

    {work.series && (
      <Link
        href={`/series/${encodeURIComponent(work.series)}`}
        className="rounded-lg bg-yellow-100 px-4 py-2 font-semibold hover:bg-yellow-200"
      >
        📚 {work.series}
      </Link>
    )}

  </div>
</div>

  </div>
</main>
);
}