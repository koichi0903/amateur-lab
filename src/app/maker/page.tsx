import { supabase } from "../../lib/supabase";
import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import { getAllWorks } from "@/lib/getAllWorks";

export default async function MakerPage() {
  const data = await getAllWorks();

  const makerCount: Record<string, number> = {};

  data?.forEach((work) => {
  if (!work.maker) return;

  const name = work.maker;
  makerCount[name] = (makerCount[name] || 0) + 1;

  });
       

  const ranking = Object.entries(makerCount)
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen p-8">
      
      <Breadcrumb
  items={[
    { label: "TOP", href: "/" },
    { label: "メーカー" },
  ]}
/>

      <h1 className="text-3xl font-bold mb-6">
        🏢 メーカーランキング
      </h1>

      {ranking.map(([name, count], index) => (
        <div
          key={name}
          className="border p-4 mb-2 rounded"
        >
          <Link
            href={`/maker/${encodeURIComponent(name)}`}
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
  );
}