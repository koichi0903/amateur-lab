import Link from "next/link";
import type { SaleValueCampaign } from "@/lib/saleValueCampaigns";

export default function SaleValueCampaignBanner({ campaign }: { campaign: SaleValueCampaign | null }) {
  if (!campaign) return null;

  const endsAt = new Date(campaign.endsAt);
  const endLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(endsAt);

  return (
    <div className="mt-4">
      <Link
        href={`/sale/value/${campaign.slug}`}
        className="group flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3 text-rose-950 shadow-sm transition hover:border-rose-300 hover:shadow-md sm:px-5"
        aria-label={`${campaign.name}、${endLabel}まで。記録上の最安値順で見る`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-black sm:text-base">{campaign.name}</span>
          <span className="mt-1 block text-xs font-bold text-rose-800 sm:text-sm">{endLabel}まで｜記録上の最安値順で見る</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-xl font-black text-rose-600 transition group-hover:translate-x-1">→</span>
      </Link>
    </div>
  );
}
