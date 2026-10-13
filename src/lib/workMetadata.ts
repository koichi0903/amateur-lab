type WorkMetadataInput = {
  title: string;
  price: number | null;
  sale_price: number | null;
  review_average: number | null;
  review_count: number | null;
};

function compactTitle(title: string, maxCharacters = 70): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > maxCharacters
    ? `${characters.slice(0, maxCharacters - 1).join("")}…`
    : normalized;
}

export function buildWorkMetaDescription(work: WorkMetadataInput): string {
  const currentPrice = (work.sale_price ?? 0) > 0 ? work.sale_price ?? 0 : work.price ?? 0;
  const priceSentence = currentPrice > 0
    ? `現在価格は${currentPrice.toLocaleString("ja-JP")}円。`
    : "";
  const reviewSentence = (work.review_count ?? 0) > 0
    ? (work.review_average ?? 0) > 0
      ? `レビュー平均${(work.review_average ?? 0).toFixed(1)}（${work.review_count}件）。`
      : `レビュー${work.review_count}件。`
    : "";

  return `${compactTitle(work.title)}のFANZA価格情報。${priceSentence}価格推移・過去最安値を確認できます。${reviewSentence}購入時期の参考に。`;
}
