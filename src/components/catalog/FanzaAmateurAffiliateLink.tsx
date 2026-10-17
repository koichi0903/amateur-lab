"use client";

export default function FanzaAmateurAffiliateLink({ href, contentId, sourcePage, price }: {
  href: string;
  contentId: string;
  sourcePage: "amateur" | "amateur_detail";
  price?: number | null;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex h-14 min-h-12 items-center justify-center rounded-xl bg-pink-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-pink-700"
      onClick={() => {
        window.gtag?.("event", "amateur_affiliate_click", {
          content_id: contentId,
          source_page: sourcePage,
          affiliate_id: "991",
        });
      }}
    >
      FANZAで見る{price != null ? `（¥${price.toLocaleString("ja-JP")}）` : ""}
    </a>
  );
}
