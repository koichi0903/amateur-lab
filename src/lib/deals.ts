import type { LucideIcon } from "lucide-react";
import { BadgePercent, Clock3, Gem, PlayCircle, Star, WalletCards } from "lucide-react";

export const dealCategories = {
  "ending-soon": {
    label: "終了間近",
    title: "まもなく終了するセール",
    description: "終了予定が近いセール作品を、終了時刻の早い順に確認できます。",
    decisionGuide: ["終了日時が近い順", "終了前にサンプルと価格を再確認"],
    caution: "終了予定は変更される場合があります。購入画面の表示を最終確認してください。",
    icon: Clock3,
    accent: "amber",
  },
  "lowest-price": {
    label: "過去最安",
    title: "過去最安の作品",
    description: "取得済みの価格履歴と比べて、現在価格が最安水準の作品です。",
    decisionGuide: ["発掘LABの取得価格履歴で最安", "現在価格と通常価格を比較"],
    caution: "過去最安は発掘LABが取得できた期間内での判定です。全販売期間の最安を保証しません。",
    icon: Gem,
    accent: "emerald",
  },
  "under-1000": {
    label: "1,000円以下",
    title: "1,000円以下で買える作品",
    description: "代表価格が1,000円以下の作品を、価格の安い順に紹介します。",
    decisionGuide: ["現在の代表価格が1,000円以下", "安い順に比較可能"],
    caution: "商品形態や収録内容が異なります。価格だけでなく詳細も比較してください。",
    icon: WalletCards,
    accent: "indigo",
  },
  "high-rated": {
    label: "高評価セール",
    title: "レビュー高評価のセール作品",
    description: "レビュー件数があり、平均評価4.0以上のセール作品を厳選します。",
    decisionGuide: ["平均4.0以上かつレビューあり", "値引きと購入者評価を同時比較"],
    caution: "レビューは個人の感想です。サンプルと作品情報も合わせて確認してください。",
    icon: Star,
    accent: "rose",
  },
  "sample-available": {
    label: "サンプルあり",
    title: "サンプル動画を確認できる作品",
    description: "購入前に無料サンプル動画を確認できる作品を集めました。",
    decisionGuide: ["無料サンプルの登録を確認", "画質や雰囲気を購入前に判断"],
    caution: "サンプルは本編の一部です。収録時間や商品形式は詳細ページで確認してください。",
    icon: PlayCircle,
    accent: "sky",
  },
  "best-discount": {
    label: "割引率が高い",
    title: "割引率が高いセール作品",
    description: "現在セール中の作品を割引率の高い順に紹介します。",
    decisionGuide: ["割引率が高い順", "通常価格と現在価格を併記"],
    caution: "割引率が高くても最安とは限りません。現在価格と内容を基準に判断してください。",
    icon: BadgePercent,
    accent: "pink",
  },
} as const satisfies Record<string, {
  label: string;
  title: string;
  description: string;
  decisionGuide: readonly string[];
  caution: string;
  icon: LucideIcon;
  accent: string;
}>;

export type DealCategory = keyof typeof dealCategories;

export function isDealCategory(value: string): value is DealCategory {
  return value in dealCategories;
}
