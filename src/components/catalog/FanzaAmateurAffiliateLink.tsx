"use client";

import { trackFanzaAmateurAffiliateClick } from "@/lib/trackFanzaAmateurAffiliateClick";

export default function FanzaAmateurAffiliateLink({ href, contentId, sourcePage, placement = "detail-sidebar", price }: {
  href: string;
  contentId: string;
  sourcePage: "amateur" | "amateur_detail";
  placement?: "listing-card" | "detail-sidebar";
  price?: number | null;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex h-14 min-h-12 items-center justify-center rounded-xl bg-pink-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-pink-700"
      onClick={() => trackFanzaAmateurAffiliateClick({ contentId, sourcePage, placement })}
    >
      FANZAで見る{price != null ? `（¥${price.toLocaleString("ja-JP")}）` : ""}
    </a>
  );
}
