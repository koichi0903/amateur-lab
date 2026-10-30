import Link from "next/link";
import { ArrowRight, Clock3, PlayCircle, Star } from "lucide-react";
import WorkImage from "@/components/home/WorkImage";
import CompareButton from "@/components/comparison/CompareButton";
import { workDetailHref, type AffiliateSource } from "@/lib/affiliateTracking";
import type { Work } from "@/types/work";
import { buildDealWorkCardPresentation } from "./dealWorkCardPricing";

export type DealWork = Pick<
  Work,
  | "id"
  | "title"
  | "genre"
  | "image_url"
  | "price"
  | "sale_price"
  | "list_price"
  | "discount_rate"
  | "is_on_sale"
  | "review_average"
  | "review_count"
  | "sale_end_at"
  | "lowest_price"
  | "is_lowest_price"
> & { sample_movie_url?: string | null };

function DealWorkCardMedia({ work, source, discountRate, isRecordedLow }: { work: DealWork; source: AffiliateSource; discountRate: number; isRecordedLow: boolean }) {
  return <Link href={workDetailHref(work.id, source)} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
    <WorkImage
      src={work.image_url}
      alt={work.title}
      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 280px"
      unoptimized
      className="object-cover transition duration-300 group-hover:scale-105"
    />
    {discountRate > 0 && <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">{discountRate}%OFF</span>}
    {work.sample_movie_url && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-black text-white"><PlayCircle size={12} /> サンプルあり</span>}
    {isRecordedLow && <span className="absolute bottom-2 right-2 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">過去最安</span>}
  </Link>;
}

function DealWorkCardReview({ work }: { work: DealWork }) {
  return <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
    {work.review_average > 0 && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"><Star size={11} fill="currentColor" /> {work.review_average.toFixed(2)}（{work.review_count}件）</span>}
  </div>;
}

function DealWorkCardReasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5">{reasons.map((reason) => <span key={reason} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">✓ {reason}</span>)}</div>;
}

function DealWorkCardPrice({
  isSale,
  currentPrice,
  regularPrice,
  saleEnd,
}: {
  isSale: boolean;
  currentPrice: number;
  regularPrice: number | null;
  saleEnd: string | null;
}) {
  return <>
    {regularPrice && currentPrice > 0 && <p className="text-[11px] font-bold text-slate-400 line-through">通常 ¥{regularPrice.toLocaleString("ja-JP")}</p>}
    <p className={`text-lg font-black ${isSale ? "text-rose-600" : "text-slate-950"}`}>{currentPrice > 0 ? `¥${currentPrice.toLocaleString("ja-JP")}` : "価格未取得"}</p>
    {saleEnd && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-700"><Clock3 size={11} /> {saleEnd}終了予定</p>}
  </>;
}

export default function DealWorkCard({
  work,
  source = "deals",
}: {
  work: DealWork;
  source?: AffiliateSource;
}) {
  const presentation = buildDealWorkCardPresentation(work);

  return (
    <article className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
      <DealWorkCardMedia work={work} source={source} discountRate={presentation.discountRate} isRecordedLow={presentation.isRecordedLow} />

      <h2 className="mt-3 line-clamp-2 min-h-10 break-all text-sm font-black leading-5">
        <Link href={workDetailHref(work.id, source)} className="hover:text-pink-600">{work.title}</Link>
      </h2>

      <DealWorkCardReview work={work} />
      <DealWorkCardReasons reasons={presentation.purchaseReasons} />

      <div className="mt-auto pt-3">
        <DealWorkCardPrice isSale={presentation.isSale} currentPrice={presentation.currentPrice} regularPrice={presentation.regularPrice} saleEnd={presentation.saleEnd} />
        <CompareButton
          workId={work.id}
          compact
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
        />
        <Link href={workDetailHref(work.id, source)} className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-black text-pink-600">
          価格・サンプルを確認 <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
