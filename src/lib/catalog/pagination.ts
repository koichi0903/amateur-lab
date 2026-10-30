export type PaginationItem = number | "ellipsis";

const MAX_VISIBLE_PAGE_NUMBERS = 15;
const PAGE_WINDOW_RADIUS = 2;

export function getPaginationItems(totalPages: number, currentPage: number): PaginationItem[] {
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const safeCurrentPage = Math.min(safeTotalPages, Math.max(1, Math.floor(currentPage)));

  if (safeTotalPages <= MAX_VISIBLE_PAGE_NUMBERS) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, safeTotalPages]);
  for (
    let page = Math.max(2, safeCurrentPage - PAGE_WINDOW_RADIUS);
    page <= Math.min(safeTotalPages - 1, safeCurrentPage + PAGE_WINDOW_RADIUS);
    page += 1
  ) {
    pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  for (const [index, page] of sortedPages.entries()) {
    if (index > 0 && page - sortedPages[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  }
  return items;
}
