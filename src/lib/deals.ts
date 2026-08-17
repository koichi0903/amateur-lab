import type { LucideIcon } from "lucide-react";
import { BadgePercent, Clock3, Gem, PlayCircle, Star, WalletCards } from "lucide-react";

export const dealCategories = {
  "ending-soon": {
    label: "終了間近",
    title: "まもなく終了するセール",
    description: "終了予定が近いセール作品を、終了時刻の早い順に確認できます。",
    icon: Clock3,
    accent: "amber",
  },
  "lowest-price": {
    label: "過去最安",
    title: "過去最安の作品",
    description: "取得済みの価格履歴と比べて、現在価格が最安水準の作品です。",
    icon: Gem,
    accent: "emerald",
  },
  "under-1000": {
    label: "1,000円以下",
    title: "1,000円以下で買える作品",
    description: "代表価格が1,000円以下の作品を、価格の安い順に紹介します。",
    icon: WalletCards,
    accent: "indigo",
  },
  "high-rated": {
    label: "高評価セール",
    title: "レビュー高評価のセール作品",
    description: "レビュー件数があり、平均評価4.0以上のセール作品を厳選します。",
    icon: Star,
    accent: "rose",
  },
  "sample-available": {
    label: "サンプルあり",
    title: "サンプル動画を確認できる作品",
    description: "購入前に無料サンプル動画を確認できる作品を集めました。",
    icon: PlayCircle,
    accent: "sky",
  },
  "best-discount": {
    label: "割引率が高い",
    title: "割引率が高いセール作品",
    description: "現在セール中の作品を割引率の高い順に紹介します。",
    icon: BadgePercent,
    accent: "pink",
  },
} as const satisfies Record<string, {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}>;

export type DealCategory = keyof typeof dealCategories;

export function isDealCategory(value: string): value is DealCategory {
  return value in dealCategories;
}
