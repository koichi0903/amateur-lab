import { supabase } from "../../lib/supabase";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import { getAllWorks } from "@/lib/getAllWorks";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";

export default async function ActressPage() {
 const data = await getAllWorks();

  const actressCount: Record<string, number> = {};

  data?.forEach((work) => {
    if (!work.actress) return;

    work.actress
      .split(" / ")
      .forEach((name: string) => {
        actressCount[name] =
          (actressCount[name] || 0) + 1;
      });
  });

  const ranking = Object.entries(actressCount)
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
  <CollectionPageJsonLd
    title="女優一覧 | 発掘LAB"
    description="人気女優別におすすめ作品を一覧表示しています。"
    url="https://amateur-lab.vercel.app/actress"
  />

  <main className="min-h-screen bg-gray-100 p-8">
     
    <Breadcrumb
  items={[
    { label: "TOP", href: "/" },
    { label: "女優" },
  ]}
/>

      <h1 className="text-3xl font-bold mb-6">
        🏆 女優ランキング
      </h1>

      {ranking.map(([name, count], index) => (
        <div
          key={name}
          className="border p-4 mb-2 rounded"
        >
          <Link
  href={`/actress/${encodeURIComponent(name)}`}
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