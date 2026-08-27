export type CatalogIntentKind = "actress" | "genre" | "maker" | "series";

export type CatalogIntentWork = {
  id: number;
  title: string;
  image_url?: string | null;
  score: number | null;
  review_average: number | null;
  review_count: number | null;
  price: number | null;
  sale_price: number | null;
  discount_rate?: number | null;
  actress?: string | null;
  genre?: string | null;
  maker?: string | null;
  series?: string | null;
};

export type CatalogHighlight = {
  label: string;
  value: string;
  detail: string;
  workId: number;
};

export type RelatedCatalogLink = {
  kind: CatalogIntentKind;
  label: string;
  name: string;
  count: number;
};

export type CatalogIntentAnalysis = {
  summary: string;
  highlights: CatalogHighlight[];
  selectionPoints: string[];
  related: RelatedCatalogLink[];
};

const kindLabels: Record<CatalogIntentKind, string> = {
  actress: "女優",
  genre: "ジャンル",
  maker: "メーカー",
  series: "シリーズ",
};

const splitValues = (value: string | null) =>
  value?.split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((item) => item.trim()).filter(Boolean) ?? [];

const effectivePrice = (work: CatalogIntentWork) => {
  const price = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
  return typeof price === "number" && price > 0 ? price : null;
};

const formatPrice = (price: number) => `¥${price.toLocaleString("ja-JP")}`;

function relatedLinks(
  works: CatalogIntentWork[],
  currentKind: CatalogIntentKind,
  currentName: string,
): RelatedCatalogLink[] {
  const relatedKinds = (["actress", "genre", "maker", "series"] as const)
    .filter((kind) => kind !== currentKind);
  const links: RelatedCatalogLink[] = [];

  for (const kind of relatedKinds) {
    const counts = new Map<string, number>();
    for (const work of works) {
      for (const value of splitValues(work[kind] ?? null)) {
        if (value === currentName) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    links.push(
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
        .slice(0, 3)
        .map(([name, count]) => ({ kind, label: kindLabels[kind], name, count })),
    );
  }

  return links;
}

export function analyzeCatalogIntent({
  kind,
  name,
  works,
  relatedWorks,
}: {
  kind: CatalogIntentKind;
  name: string;
  works: CatalogIntentWork[];
  relatedWorks?: CatalogIntentWork[];
}): CatalogIntentAnalysis {
  const pricedWorks = works
    .map((work) => ({ work, price: effectivePrice(work) }))
    .filter((item): item is { work: CatalogIntentWork; price: number } => item.price !== null);
  const topWork = [...works]
    .filter((work) => (work.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const trustedReviewWork = [...works]
    .filter((work) => (work.review_count ?? 0) >= 10 && (work.review_average ?? 0) > 0)
    .sort((a, b) =>
      (b.review_average ?? 0) - (a.review_average ?? 0) ||
      (b.review_count ?? 0) - (a.review_count ?? 0)
    )[0];
  const lowestPriceWork = [...pricedWorks].sort((a, b) => a.price - b.price)[0];
  const saleCount = works.filter((work) =>
    (work.sale_price ?? 0) > 0 &&
    (work.price ?? 0) > 0 &&
    (work.sale_price ?? 0) < (work.price ?? 0)
  ).length;
  const reviewedCount = works.filter((work) => (work.review_count ?? 0) >= 10).length;
  const highScoreCount = works.filter((work) => (work.score ?? 0) >= 70).length;
  const underThousandCount = pricedWorks.filter((item) => item.price <= 1000).length;

  const highlights: CatalogHighlight[] = [];
  if (topWork) {
    highlights.push({
      label: "発掘スコア1位",
      value: `${topWork.score}点`,
      detail: topWork.title,
      workId: topWork.id,
    });
  }
  if (trustedReviewWork) {
    highlights.push({
      label: "レビュー評価上位",
      value: `${(trustedReviewWork.review_average ?? 0).toFixed(2)} / 5`,
      detail: `${trustedReviewWork.title}（${trustedReviewWork.review_count}件）`,
      workId: trustedReviewWork.id,
    });
  }
  if (lowestPriceWork) {
    highlights.push({
      label: "現在価格が安い作品",
      value: formatPrice(lowestPriceWork.price),
      detail: lowestPriceWork.work.title,
      workId: lowestPriceWork.work.id,
    });
  }

  const selectionPoints = [
    highScoreCount > 0 ? `発掘スコア70点以上は${highScoreCount}作品です。` : null,
    reviewedCount > 0 ? `レビュー10件以上の判断材料がある作品は${reviewedCount}作品です。` : null,
    saleCount > 0 ? `現在セール価格を取得している作品は${saleCount}作品です。` : null,
    underThousandCount > 0 ? `現在価格1,000円以下の作品は${underThousandCount}作品です。` : null,
  ].filter((item): item is string => item !== null);

  const basis = [
    topWork ? "発掘スコア" : null,
    trustedReviewWork ? "レビュー件数と平均評価" : null,
    lowestPriceWork ? "現在価格" : null,
  ].filter(Boolean).join("・");
  const summary = `${name}の登録${works.length}作品を${basis || "登録情報"}で比較しています。順位だけでなく、評価の根拠と価格条件を合わせて候補を選べます。`;

  return {
    summary,
    highlights,
    selectionPoints,
    related: relatedLinks(relatedWorks ?? works, kind, name),
  };
}
