import { AlertCircle, CheckCircle2, PenLine } from "lucide-react";
import type { EntityEditorialProfile } from "@/lib/editorialContent";

export default function EntityEditorialGuide({
  name,
  profile,
}: {
  name: string;
  profile: EntityEditorialProfile | undefined;
}) {
  if (!profile) return null;

  return (
    <section className="mb-10 border-y border-slate-200 bg-white px-5 py-7 sm:px-7" aria-labelledby="entity-editorial-title">
      <div className="flex items-center gap-2 text-xs font-black text-indigo-700">
        <PenLine size={15} /> 発掘LAB編集部の確認ポイント
      </div>
      <h2 id="entity-editorial-title" className="mt-2 break-words text-2xl font-black text-slate-950">
        {name}の作品を選ぶ前に
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">{profile.lead}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
        <div>
          <h3 className="text-sm font-black text-slate-950">比較する順番</h3>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {profile.priorities.map((priority, index) => (
              <li key={priority} className="flex gap-2 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-3 text-sm font-bold leading-6 text-slate-700">
                <span className="text-emerald-700">{index + 1}</span><span>{priority}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-4">
          <p className="flex items-center gap-2 text-xs font-black text-amber-800"><AlertCircle size={15} />購入前の注意</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{profile.caution}</p>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-500"><CheckCircle2 size={14} className="text-emerald-600" />価格・レビュー・順位は取得済みデータに応じて更新されます。</p>
    </section>
  );
}
