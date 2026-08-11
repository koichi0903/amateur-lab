import Link from "next/link";
import WorkImage from "../WorkImage";

type Insight = {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  works?: Record<string, unknown> | null;
};

const configurations: Record<string, { label: string; accent: string; badge: string }> = {
  PRICE_DROP: { label: "急上昇ランキング", accent: "text-rose-600", badge: "bg-rose-50 text-rose-600" },
  LOWEST_PRICE: { label: "今日の最安値", accent: "text-emerald-600", badge: "bg-emerald-50 text-emerald-600" },
  REVIEW_INCREASE: { label: "レビュー急増", accent: "text-amber-600", badge: "bg-amber-50 text-amber-600" },
  RANK_UP: { label: "初ランクイン", accent: "text-blue-600", badge: "bg-blue-50 text-blue-600" },
  RECOMMEND: { label: "AIおすすめ", accent: "text-violet-600", badge: "bg-violet-50 text-violet-600" },
};

export default function InsightCard({ insight }: { insight: Insight }) {
  const work = insight.works ?? {};
  const workId = String(work.id ?? "");
  const title = String(work.title ?? insight.title ?? "注目作品");
  const imageUrl = typeof work.image_url === "string" ? work.image_url : null;
  const score = Number(work.score ?? 0);
  const config = configurations[insight.type ?? ""] ?? configurations.RECOMMEND;
  const content = (
    <>
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${config.badge}`}>{config.label}</div>
      <p className="mt-3 line-clamp-2 h-10 text-sm font-bold leading-5 text-slate-700">{insight.description ?? insight.title ?? "AIが注目の動きを検知しました"}</p>
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <WorkImage src={imageUrl} alt={title} className="object-cover transition duration-300 group-hover:scale-105" sizes="260px" />
      </div>
      <h3 className="mt-3 line-clamp-2 h-10 text-sm font-black leading-5">{title}</h3>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>発掘スコア <strong className={`text-base ${config.accent}`}>{score > 0 ? score : "-"}</strong></span>
        <span>レビュー {String(work.review_average ?? "-")}</span>
      </div>
    </>
  );

  const className = "group block w-[82vw] max-w-[320px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:w-[320px] lg:w-auto lg:max-w-none";
  return workId ? <Link href={`/works/${workId}`} className={className}>{content}</Link> : <article className={className}>{content}</article>;
}
