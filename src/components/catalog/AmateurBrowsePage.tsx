import { getFanzaAmateurBrowsePage, getFanzaAmateurTaxonomy } from "@/lib/dmm/fanzaAmateurCatalog";
import { parseFanzaAmateurBrowsePageRequest, type FanzaAmateurBrowsePageMode, type FanzaAmateurBrowsePageParams } from "@/lib/dmm/fanzaAmateurBrowseRequest";
import { AmateurBrowseHeader } from "@/components/catalog/AmateurBrowseHeader";
import { AmateurBrowseResults } from "@/components/catalog/AmateurBrowseResults";

function formatTodayJa() {
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}年${value("month")}月${value("day")}日`;
}

export default async function AmateurBrowsePage({ mode, searchParams }: { mode: FanzaAmateurBrowsePageMode; searchParams: Promise<FanzaAmateurBrowsePageParams> }) {
  const params = await searchParams;
  const request = parseFanzaAmateurBrowsePageRequest(mode, params);
  const { query, performer, genre, genres, maker, page, maxPrice, minRating, sort, releaseFrom, releaseTo, minPrice } = request;
  const result = await getFanzaAmateurBrowsePage({ page, query, performer, genre, genres, maker, sort, campaignOnly: mode === "sale", maxPrice, minRating, releaseFrom, releaseTo, minPrice });
  const availableGenreOptions = mode === "personal" && !genre ? await getFanzaAmateurTaxonomy("genre") : [];
  const today = formatTodayJa();

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <AmateurBrowseHeader
        mode={mode}
        request={request}
        today={today}
        totalCount={result.totalCount}
        availableGenreOptions={availableGenreOptions}
      />
      <AmateurBrowseResults mode={mode} request={request} result={result} />
    </main>
  );
}