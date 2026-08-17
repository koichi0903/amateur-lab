import { BookOpenCheck, Medal, Sparkles, UserRoundSearch, WalletCards, type LucideIcon } from "lucide-react";

export const featureCategories = {
  beginners: {
    label: "はじめて選ぶ方へ",
    title: "初心者向け・失敗しにくい作品",
    description: "レビュー評価、件数、発掘スコア、無料サンプルの有無から、比較しやすい作品を選びました。",
    forWhom: ["何から見ればよいか迷う方", "サンプルを確認してから選びたい方"],
    selectionPoints: ["レビュー平均と件数を両方確認", "発掘スコアと無料サンプルの有無を評価"],
    caution: "好みには個人差があります。サンプル、出演者、収録内容を確認してから購入してください。",
    icon: BookOpenCheck,
  },
  "under-500": {
    label: "ワンコイン",
    title: "500円以下で試せる作品",
    description: "代表価格が500円以下の作品を、評価と発掘スコアが高い順に紹介します。",
    forWhom: ["少額から試したい方", "まとめ買い前に好みを確かめたい方"],
    selectionPoints: ["現在の代表価格が500円以下", "同価格帯では評価とスコアを優先"],
    caution: "価格は変動する場合があります。購入画面で最終価格と商品内容を確認してください。",
    icon: WalletCards,
  },
  "trusted-reviews": {
    label: "レビュー重視",
    title: "レビュー件数も多い高評価作品",
    description: "平均評価だけでなくレビュー件数も確認し、評価の根拠が比較的多い作品を紹介します。",
    forWhom: ["購入者評価を重視する方", "評価件数の少ない作品を避けたい方"],
    selectionPoints: ["平均評価だけでなく件数も確認", "件数が同程度なら発掘スコアを優先"],
    caution: "レビューは購入者個人の感想です。作品内容やサンプルとの併用をおすすめします。",
    icon: Medal,
  },
  "actress-discovery": {
    label: "女優から発掘",
    title: "出演女優から見つけるおすすめ作品",
    description: "女優情報が登録され、発掘スコアの高い作品から新しい好みを探せます。",
    forWhom: ["出演者から作品を探したい方", "新しい女優を発見したい方"],
    selectionPoints: ["出演者情報が登録済み", "同じ出演者内で高スコア作品を優先"],
    caution: "複数出演作品を含みます。詳細ページの出演者欄で目当ての出演を確認してください。",
    icon: UserRoundSearch,
  },
  "hidden-gems": {
    label: "隠れた名作",
    title: "高評価の隠れた名作",
    description: "ランキング上位だけに偏らず、レビューと発掘スコアが高い作品を選びました。",
    forWhom: ["定番以外も発掘したい方", "ランキング順位だけで選びたくない方"],
    selectionPoints: ["ランキング上位への偏りを抑制", "評価、件数、発掘スコアを横断評価"],
    caution: "知名度の低さは品質を保証するものではありません。詳細情報を比較して選んでください。",
    icon: Sparkles,
  },
} as const satisfies Record<string, { label: string; title: string; description: string; forWhom: readonly string[]; selectionPoints: readonly string[]; caution: string; icon: LucideIcon }>;

export type FeatureCategory = keyof typeof featureCategories;

export function isFeatureCategory(value: string): value is FeatureCategory {
  return value in featureCategories;
}
