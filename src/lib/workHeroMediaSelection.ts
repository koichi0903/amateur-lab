export type WorkHeroMediaSelection = "movie" | number;
export type WorkHeroMediaDirection = "left" | "right";

export function isWorkHeroImageViewerOpen(
  viewerOpen: boolean,
  selection: WorkHeroMediaSelection,
): selection is number {
  return viewerOpen && selection !== "movie";
}

export function getAdjacentWorkHeroMediaSelection(
  current: WorkHeroMediaSelection,
  direction: WorkHeroMediaDirection,
  imageCount: number,
): WorkHeroMediaSelection {
  if (direction === "right") {
    if (current === "movie") return imageCount ? 0 : "movie";
    return current < imageCount - 1 ? current + 1 : "movie";
  }

  if (current === "movie") {
    return imageCount ? imageCount - 1 : "movie";
  }
  return current > 0 ? current - 1 : "movie";
}
