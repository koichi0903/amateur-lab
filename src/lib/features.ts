import { BookOpenCheck, Medal, Sparkles, UserRoundSearch, WalletCards, type LucideIcon } from "lucide-react";

export const featureCategories = {
  beginners: {
    label: "はじめて選ぶ方へ",
    title: "初心者向け・失敗しにくいFANZA作品",
    description: "無料サンプルがあり、レビュー平均4以上・レビュー5件以上の作品を掲載。評価とレビュー件数を見ながら候補を比べられます。",
    forWhom: ["何から見ればよいか迷う方", "サンプルを確認してから選びたい方"],
    selectionPoints: ["無料サンプルが登録された作品", "レビュー平均4以上・レビュー5件以上"],
    caution: "好みには個人差があります。サンプル、出演者、収録内容を確認してから購入してください。",
    icon: BookOpenCheck,
  },
  "under-500": {
    label: "ワンコイン",
    title: "500円以下で試せるFANZA作品",
    description: "販売価格が500円以下の作品を掲載し、レビュー平均の高い順に紹介します。同じ評価の作品はレビュー件数の多い順です。",
    forWhom: ["少額から試したい方", "まとめ買い前に好みを確かめたい方"],
    selectionPoints: ["セール中はセール価格、通常時は通常価格で500円以下", "レビュー平均順、同評価ならレビュー件数順"],
    caution: "価格は変動する場合があります。購入画面で最終価格と商品内容を確認してください。",
    icon: WalletCards,
  },
  "trusted-reviews": {
    label: "レビュー重視",
    title: "レビュー件数も多いFANZA高評価作品",
    description: "平均評価だけでなくレビュー件数も確認し、評価の根拠が比較的多いFANZA作品を紹介します。",
    forWhom: ["購入者評価を重視する方", "評価件数の少ない作品を避けたい方"],
    selectionPoints: ["レビュー平均4以上・レビュー20件以上", "レビュー平均順、同評価ならレビュー件数順"],
    caution: "レビューは購入者個人の感想です。作品内容やサンプルとの併用をおすすめします。",
    icon: Medal,
  },
  "actress-discovery": {
    label: "女優から発掘",
    title: "出演女優から見つけるFANZAおすすめ作品",
    description: "女優情報が登録された作品を、レビュー平均とレビュー件数の順に掲載。出演者から作品を探す入口として使えます。",
    forWhom: ["出演者から作品を探したい方", "新しい女優を発見したい方"],
    selectionPoints: ["女優情報が登録された作品", "レビュー平均順、同評価ならレビュー件数順"],
    caution: "複数出演作品を含みます。詳細ページの出演者欄で目当ての出演を確認してください。",
    icon: UserRoundSearch,
  },
  "hidden-gems": {
    label: "隠れた名作",
    title: "高評価のFANZA隠れた名作",
    description: "レビュー平均4以上・レビュー5件以上の作品から、ランキング上位100位以外または順位情報のない作品を掲載します。",
    forWhom: ["定番以外も発掘したい方", "ランキング順位だけで選びたくない方"],
    selectionPoints: ["ランキング上位100位を除外（順位未登録作品を含む）", "レビュー平均4以上・レビュー5件以上"],
    caution: "知名度の低さは品質を保証するものではありません。詳細情報を比較して選んでください。",
    icon: Sparkles,
  },
} as const satisfies Record<string, { label: string; title: string; description: string; forWhom: readonly string[]; selectionPoints: readonly string[]; caution: string; icon: LucideIcon }>;

export type FeatureCategory = keyof typeof featureCategories;

export function isFeatureCategory(value: string): value is FeatureCategory {
  return value in featureCategories;
}
