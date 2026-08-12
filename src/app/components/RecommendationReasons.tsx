import type { RecommendReason } from "@/lib/analyzers/recommendAnalyzer";

const styles = {
  green: "border-green-200 text-green-700",
  amber: "border-amber-200 text-amber-700",
  pink: "border-pink-200 text-pink-700",
  indigo: "border-indigo-200 text-indigo-700",
};

export default function RecommendationReasons({ reasons }: { reasons: RecommendReason[] }) {
  const desktopColumns = reasons.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2";
  const content = reasons.length ? <div className={`mt-4 grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-4 ${desktopColumns}`}>
    {reasons.map((reason) => (
      <div key={reason.category} className={`flex min-w-0 flex-col rounded-xl border bg-white p-3 md:rounded-2xl md:p-4 ${styles[reason.color]}`}>
        <div className="line-clamp-2 min-h-10 text-sm font-black leading-5">{reason.title}</div>
        <div className="mt-1.5 line-clamp-3 min-h-[3.75rem] break-words text-[11px] leading-5 text-zinc-600 md:mt-2 md:text-xs">{reason.description}</div>
      </div>
    ))}
  </div> : <p className="mt-4 text-sm leading-7 text-zinc-600">現在の実データでは、表示基準を満たすおすすめ理由はありません。</p>;

  return (
    <>
      <details className="group min-w-0 md:hidden">
        <summary className="w-full cursor-pointer list-none rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-center text-sm font-black text-pink-700">
          <span className="group-open:hidden">おすすめポイントを見る</span>
          <span className="hidden group-open:inline">おすすめポイントを閉じる</span>
        </summary>
        <div className="mt-3 min-w-0 rounded-2xl border border-pink-100 bg-pink-50 p-3">
          <h3 className="text-lg font-black text-pink-700">おすすめポイント</h3>
          {content}
        </div>
      </details>

      <div className="hidden min-w-0 flex-col rounded-2xl border border-pink-100 bg-pink-50 p-5 md:flex">
        <h3 className="text-lg font-black text-pink-700">おすすめポイント</h3>
        {content}
      </div>
    </>
  );
}
