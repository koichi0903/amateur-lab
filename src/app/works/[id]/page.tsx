import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

  const { data: relatedWorks } = await supabase
  .from("works")
  .select("*")
  .eq("actress", work.actress)
  .neq("id", work.id)
  .limit(3);

  return (
    <main className="min-h-screen p-8">
      {work.image_url && (
  <img
    src={work.image_url}
    alt={work.title}
    className="w-80 rounded-lg mb-6"
  />
)}
      <h1 className="text-4xl font-bold">
        {work.title}
      </h1>

      <p className="mt-4">
        ジャンル: {work.genre}
      </p>

      <p className="mt-2">
  女優: {work.actress}
</p>

      <p className="mt-2">
        発掘スコア: {work.score}
      </p>

     <div className="mt-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
  <h2 className="font-bold text-lg mb-2">
    📝 発掘メモ
  </h2>

  <p>
    {work.memo || "発掘メモはありません"}
  </p>
</div>
      
      {work.affiliate_url && (
  <a
    href={work.affiliate_url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block bg-pink-600 text-white px-6 py-3 rounded mt-6"
  >
    ▶ FANZAで見る
  </a>
)}


{relatedWorks && relatedWorks.length > 0 && (
  <div className="mt-10">
    <h2 className="text-2xl font-bold mb-4">
      関連作品
    </h2>

    {relatedWorks.map((related) => (
      <div
        key={related.id}
        className="border p-4 mb-3 rounded"
      >
        {related.image_url && (
          <img
            src={related.image_url}
            alt={related.title}
            className="w-32 rounded mb-2"
          />
        )}

        <Link href={`/works/${related.id}`}>
          <p className="font-bold text-blue-600 hover:underline">
            {related.title}
          </p>
        </Link>

        <p>
  女優: {
    related.actress
      ?.split(" / ")
      .slice(0, 5)
      .join(" / ")
  }
  {related.actress?.split(" / ").length > 5 && " ..."}
</p>
        <p>
  ジャンル: {
    related.genre
      ?.split(" / ")
      .slice(0, 4)
      .join(" / ")
  }
  {related.genre?.split(" / ").length > 4 && " ..."}
</p>
      </div>
    ))}
  </div>
)}
    </main>
  );
}
