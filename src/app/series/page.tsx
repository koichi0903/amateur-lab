import { supabase } from "../../lib/supabase";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import { getAllWorks } from "@/lib/getAllWorks";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";

export default async function SeriesPage() {
 const data = await getAllWorks();

  const seriesCount: Record<string, number> = {};

  data?.forEach((work) => {
  if (!work.series) return;

const name = work.series;

seriesCount[name] =
  (seriesCount[name] || 0) + 1;

  });
       

  const ranking = Object.entries(seriesCount)
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
  <CollectionPageJsonLd
    title="シリーズ一覧 | 発掘LAB"
    description="シリーズ作品を独自スコア順に掲載しています。"
    url="https://amateur-lab.vercel.app/series"
  />

  <main className="min-h-screen bg-gray-100 p-8">
      
    <Breadcrumb
  items={[
    { label: "TOP", href: "/" },
    { label: "シリーズ" },
  ]}
/>

      <h1 className="text-3xl font-bold mb-6">
        📚 シリーズランキング
      </h1>

      {ranking.map(([name, count], index) => (
        <div
          key={name}
          className="border p-4 mb-2 rounded"
        >
          <Link
            href={`/series/${encodeURIComponent(name)}`}
          >
            <p className="font-bold text-blue-600 hover:underline">
              {index + 1}位 {name}
            </p>
          </Link>

          <p>
            登録作品数: {count}
          </p>
        </div>
      ))}
    </main>
</>
  );
}