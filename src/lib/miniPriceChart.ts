export type MiniPriceChartPoint = {
  price: number;
  changedAt: string;
  priceKind?: "regular" | "sale" | null;
  isCurrent?: boolean;
};

export type PositionedMiniPricePoint = MiniPriceChartPoint & {
  x: number;
  y: number;
  movement: "down" | "up" | "same";
};

export type MiniPriceChartGeometry = {
  points: PositionedMiniPricePoint[];
  stepPath: string;
  areaPath: string;
  lowY: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
};

const finiteTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export function buildMiniPriceChartGeometry(input: {
  points: MiniPriceChartPoint[];
  windowStartAt: string;
  windowEndAt: string;
  width: number;
  height: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}): MiniPriceChartGeometry {
  const top = input.top ?? 8;
  const right = input.right ?? 8;
  const bottom = input.bottom ?? 18;
  const left = input.left ?? 8;
  const plotRight = input.width - right;
  const plotBottom = input.height - bottom;
  const start = finiteTime(input.windowStartAt) ?? 0;
  const parsedEnd = finiteTime(input.windowEndAt) ?? start + 1;
  const end = Math.max(start + 1, parsedEnd);

  const sorted = input.points
    .map((point) => ({ point, time: finiteTime(point.changedAt) }))
    .filter(
      (entry): entry is { point: MiniPriceChartPoint; time: number } =>
        entry.time !== null && Number.isFinite(entry.point.price) && entry.point.price > 0,
    )
    .sort((a, b) => a.time - b.time);

  const prices = sorted.map(({ point }) => point.price);
  const minimum = prices.length ? Math.min(...prices) : 0;
  const maximum = prices.length ? Math.max(...prices) : minimum + 1;
  const rawRange = Math.max(1, maximum - minimum);
  const yMinimum = Math.max(0, minimum - rawRange * 0.12);
  const yMaximum = maximum + rawRange * 0.12;
  const yRange = Math.max(1, yMaximum - yMinimum);

  const points: PositionedMiniPricePoint[] = sorted.map(({ point, time }, index) => {
    const previous = sorted[index - 1]?.point.price;
    const movement =
      previous == null || previous === point.price
        ? "same"
        : point.price < previous
          ? "down"
          : "up";
    const x = left + ((Math.min(end, Math.max(start, time)) - start) / (end - start)) * (plotRight - left);
    const y = top + ((yMaximum - point.price) / yRange) * (plotBottom - top);
    return { ...point, x, y, movement };
  });

  const stepPath = points.length
    ? points.slice(1).reduce(
        (path, point) => `${path} H ${point.x.toFixed(2)} V ${point.y.toFixed(2)}`,
        `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`,
      )
    : "";
  const areaPath = stepPath
    ? `${stepPath} L ${points.at(-1)!.x.toFixed(2)} ${plotBottom.toFixed(2)} L ${points[0].x.toFixed(2)} ${plotBottom.toFixed(2)} Z`
    : "";
  const lowY = top + ((yMaximum - minimum) / yRange) * (plotBottom - top);

  return { points, stepPath, areaPath, lowY, plotBottom, plotLeft: left, plotRight };
}
