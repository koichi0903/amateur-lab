import { supabase } from "../../../lib/supabase";
import type { Metadata } from "next";
import WorkHero from "../../components/WorkHero";
import WorkInfo from "../../components/WorkInfo";
import AIAnalysis from "../../components/AIAnalysis";
import RelatedWorks from "../../components/RelatedWorks";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  const { data: work } = await supabase
    .from("works")
    .select("title, actress, score")
    .eq("id", id)
    .single();

  if (!work) {
    return {
      title: "作品情報 | 発掘LAB",
    };
  }

  return {
    title: `${work.title}｜レビュー・発掘スコア${work.score} | 発掘LAB`,
    description:
      `${work.title}のレビュー・評価・発掘スコアを掲載。女優「${work.actress}」出演作品を独自アルゴリズムで分析しています。`,
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
  "人気・評価・価格を総合分析した結果、現在おすすめできる作品です。";

if (points.length > 0) {
  summary +=
    " 特に「" +
    points.join("・") +
    "」が高く評価されています。";
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

    <WorkHero
      work={work}
      reasons={reasons}
    />

    <AIAnalysis
  summary={summary}
  comments={comments}
/>

    <WorkInfo work={work} />

    <RelatedWorks works={relatedWorks} />

  </div>
</main>
);
}