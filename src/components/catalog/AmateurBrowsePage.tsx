import {
  getFanzaAmateurBrowsePage,
  getFanzaAmateurTaxonomy,
} from "@/lib/dmm/fanzaAmateurCatalog";
import {
  parseFanzaAmateurBrowsePageRequest,
  type FanzaAmateurBrowsePageMode,
  type FanzaAmateurBrowsePageParams,
} from "@/lib/dmm/fanzaAmateurBrowseRequest";
import { AmateurBrowseHeader } from "@/components/catalog/AmateurBrowseHeader";
import { AmateurBrowseResults } from "@/components/catalog/AmateurBrowseResults";

function formatTodayJa() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}年${value("month")}月${value("day")}日`;
}

export default async function AmateurBrowsePage({
  mode,
  searchParams,
}: {
  mode: FanzaAmateurBrowsePageMode;
  searchParams: Promise<FanzaAmateurBrowsePageParams>;
}) {
  const request = parseFanzaAmateurBrowsePageRequest(mode, await searchParams);
  const result = await getFanzaAmateurBrowsePage({
    page: request.page,
    query: request.query,
    performer: request.performer,
    genre: request.genre,
    genres: request.genres,
    maker: request.maker,
    sort: request.sort,
    campaignOnly: mode === "sale",
    maxPrice: request.maxPrice,
    minRating: request.minRating,
    releaseFrom: request.releaseFrom,
    releaseTo: request.releaseTo,
    minPrice: request.minPrice,
  });
  const availableGenreOptions =
    mode === "personal" && !request.genre
      ? await getFanzaAmateurTaxonomy("genre")
      : [];

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <AmateurBrowseHeader
        mode={mode}
        request={request}
        today={formatTodayJa()}
        totalCount={result.totalCount}
        availableGenreOptions={availableGenreOptions}
      />
      <AmateurBrowseResults mode={mode} request={request} result={result} />
    </main>
  );
}
