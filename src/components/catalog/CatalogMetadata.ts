import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import {
  getEntityIndexSummary,
  isEntityIndexable,
} from "@/lib/catalog/entityIndexSummaries";
import { getEntityWorksPage } from "@/lib/catalog/entityWorks";

export type CatalogKind = "maker" | "genre";

export function decodeCatalogName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function catalogMetadata(kind: CatalogKind, name: string, page = 1): Promise<Metadata> {
  const suffix = page > 1 ? ` ${page}ページ目` : "";
  let robots: Metadata["robots"] = { index: false, follow: true };

  try {
    const summary = await getEntityIndexSummary(kind, name);
    const pageResult = page === 1
      ? await getEntityWorksPage(kind, name, 1)
      : null;

    if (
      page === 1 &&
      pageResult &&
      !pageResult.error &&
      pageResult.works.length > 0 &&
      (kind === "genre" || kind === "maker" || (summary && isEntityIndexable(kind, summary)))
    ) {
      robots = undefined;
    }
  } catch {
    // Avoid indexing an error-thin page while quality data is unavailable.
  }

  const subject = name;
  return pageMetadata({
    title: kind === "genre"
      ? `${subject}のFANZA作品一覧${suffix} | 発掘LAB`
      : `${subject}のFANZA作品一覧${suffix} | 人気順・価格順で比較 | 発掘LAB`,
    description: `${subject}のFANZA作品を、人気順・発売日順・価格順で並び替えて探せます。現在価格、レビュー、価格推移も作品ごとに確認できます。`,
    canonical: `/${kind}/${encodeURIComponent(name)}${page > 1 ? `/page/${page}` : ""}`,
    robots,
  });
}
