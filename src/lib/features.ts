import { BookOpenCheck, Medal, Sparkles, UserRoundSearch, WalletCards, type LucideIcon } from "lucide-react";

export const featureCategories = {
  beginners: {
    label: "はじめて選ぶ方へ",
    title: "初心者向け・失敗しにくい作品",
    description: "レビュー評価、件数、発掘スコア、無料サンプルの有無から、比較しやすい作品を選びました。",
    icon: BookOpenCheck,
  },
  "under-500": {
    label: "ワンコイン",
    title: "500円以下で試せる作品",
    description: "代表価格が500円以下の作品を、評価と発掘スコアが高い順に紹介します。",
    icon: WalletCards,
  },
  "trusted-reviews": {
    label: "レビュー重視",
    title: "レビュー件数も多い高評価作品",
    description: "平均評価だけでなくレビュー件数も確認し、評価の根拠が比較的多い作品を紹介します。",
    icon: Medal,
  },
  "actress-discovery": {
    label: "女優から発掘",
    title: "出演女優から見つけるおすすめ作品",
    description: "女優情報が登録され、発掘スコアの高い作品から新しい好みを探せます。",
    icon: UserRoundSearch,
  },
  "hidden-gems": {
    label: "隠れた名作",
    title: "高評価の隠れた名作",
    description: "ランキング上位だけに偏らず、レビューと発掘スコアが高い作品を選びました。",
    icon: Sparkles,
  },
} as const satisfies Record<string, { label: string; title: string; description: string; icon: LucideIcon }>;

export type FeatureCategory = keyof typeof featureCategories;

export function isFeatureCategory(value: string): value is FeatureCategory {
  return value in featureCategories;
}
