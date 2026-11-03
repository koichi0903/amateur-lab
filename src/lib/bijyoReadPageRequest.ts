type BijyoReadPageInput = {
  historyPage: string | null;
  reservedPage: string | null;
  manualPage: string | null;
};

type BijyoReadPageRequest =
  | { mode: "history"; page: number }
  | { mode: "reserved"; page: number }
  | { mode: "manual"; page: number }
  | { mode: "dashboard"; historyPage: number; reservedPage: number };

function pageNumber(value: string | null) {
  return Math.max(1, Number(value ?? "1") || 1);
}

export function resolveBijyoReadPageRequest(input: BijyoReadPageInput): BijyoReadPageRequest {
  const { historyPage, reservedPage, manualPage } = input;
  if (historyPage !== null && reservedPage === null) return { mode: "history", page: pageNumber(historyPage) };
  if (reservedPage !== null && historyPage === null) return { mode: "reserved", page: pageNumber(reservedPage) };
  if (manualPage !== null) return { mode: "manual", page: pageNumber(manualPage) };
  return { mode: "dashboard", historyPage: pageNumber(historyPage), reservedPage: pageNumber(reservedPage) };
}
