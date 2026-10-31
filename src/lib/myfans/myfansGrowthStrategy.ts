export type MyfansLinkStrategy = "body_link" | "reply_link" | "profile_cta" | "no_link";
export type MyfansGrowthStage = "day_1_7" | "day_8_14" | "day_15_30";
export type MyfansObjective = "impression" | "profile_visit" | "follow" | "click" | "conversion";
export type MyfansCreativeStrategy = "quote_post" | "myfans_ogp" | "comparison_card" | "ranking_card" | "discovery_card" | "revenue_data_card" | "text_only" | "permitted_media";
export type MyfansCandidateType = "Growth" | "Monetizable Growth" | "Revenue";
export type MyfansMonetizableStatus = "unlinked" | "linked_no_affiliate" | "linked_affiliate_ready";

export type RotationItem = { postType: string; linkStrategy: MyfansLinkStrategy; objective: MyfansObjective; cta: string; slot: string; role: string };

export const MYFANS_PROFILE_GUIDE = {
  handle: "@lumi_reviw",
  displayName: "るみ | myfans発掘と比較",
  bio: "myfansの新着、反応が強い投稿、価格の違いを毎日見て、探す前に役立つ発見だけ短く残します。18歳未満は見ないでください。PRを含む場合があります。",
  pinnedPost:
    "myfansを大量に探す前に、ここだけ見れば当たりを付けられる場所にします。\n\n毎日見るところ\n1. 新着なのに反応が出ている投稿\n2. 価格と内容のズレが大きいもの\n3. ひと目で好みが分かれる強い投稿\n4. PRはPRとして分けて明記\n\n成人向けです。18歳未満は見ないでください。",
  role:
    "フォロワー0期は販売アカウントに見せすぎず、発掘・比較アカウントとしてフォロー理由を作る。",
};

export const MYFANS_GROWTH_TARGETS = {
  followersMin: 50,
  followersMax: 100,
  postsOver1000Min: 3,
  postsOver1000Max: 5,
  postsOver5000: 1,
  clicks: 1,
  conversions: 1,
};

export const MYFANS_30_DAY_STRATEGY: Record<MyfansGrowthStage, {
  label: string;
  postsPerDay: string;
  normalPrRatio: string;
  linkMix: Record<MyfansLinkStrategy, number>;
  changeRule: string;
  focus: string;
}> = {
  day_1_7: {
    label: "Day1-7",
    postsPerDay: "4本固定",
    normalPrRatio: "通常3 : PR1",
    linkMix: { no_link: 2, profile_cta: 1, reply_link: 1, body_link: 0 },
    changeRule: "50表示未満が同じ型で3回続いたら、その型を翌日から止める。",
    focus: "まず表示とプロフィール遷移を作る。直リンク販売は1日1本だけ。",
  },
  day_8_14: {
    label: "Day8-14",
    postsPerDay: "3-5本可変",
    normalPrRatio: "通常2-3 : PR1-2",
    linkMix: { no_link: 1, profile_cta: 1, reply_link: 1, body_link: 1 },
    changeRule: "24時間300表示以上の型を翌日に1本増やし、50表示未満の型を減らす。",
    focus: "プロフィール誘導、自己リプ、本文リンクの差を見る。",
  },
  day_15_30: {
    label: "Day15-30",
    postsPerDay: "3-6本可変",
    normalPrRatio: "Growth50% / Revenue30% / LTV20%",
    linkMix: { no_link: 1, profile_cta: 1, reply_link: 2, body_link: 1 },
    changeRule: "7日/30日Learningで勝ち型だけ再利用。CVが出た型は同ジャンルで横展開する。",
    focus: "伸びた通常投稿にだけ収益導線を足し、フォローと売上を同時に取る。",
  },
};

export const ROTATION: Record<MyfansGrowthStage, RotationItem[]> = {
  day_1_7: [
    { postType: "discovery_interest", linkStrategy: "no_link", objective: "impression", cta: "保存用の発見メモ", slot: "12:10", role: "露出を作る" },
    { postType: "ranking_note", linkStrategy: "no_link", objective: "impression", cta: "日間ランキングの観測メモ", slot: "17:40", role: "比較で見られる理由を作る" },
    { postType: "profile_cta", linkStrategy: "profile_cta", objective: "profile_visit", cta: "過去の発掘メモはプロフィールにまとめています", slot: "20:10", role: "プロフィールへ送る" },
    { postType: "reply_link_sales", linkStrategy: "reply_link", objective: "click", cta: "気になる人だけ自己リプへ", slot: "23:00", role: "リンク型を小さく試す" },
  ],
  day_8_14: [
    { postType: "comparison_review", linkStrategy: "profile_cta", objective: "follow", cta: "迷う人向けにプロフィールへ", slot: "12:20", role: "比較でフォロー理由を作る" },
    { postType: "discovery_interest", linkStrategy: "no_link", objective: "impression", cta: "保存用の発見メモ", slot: "17:50", role: "露出の土台を残す" },
    { postType: "reply_link_sales", linkStrategy: "reply_link", objective: "click", cta: "詳細は自己リプ", slot: "20:40", role: "自己リプリンクを試す" },
    { postType: "body_link_sales", linkStrategy: "body_link", objective: "click", cta: "詳細を見る", slot: "23:10", role: "本文リンクを少量試す" },
  ],
  day_15_30: [
    { postType: "winner_reuse", linkStrategy: "reply_link", objective: "conversion", cta: "前に反応がよかった型で再掲", slot: "12:10", role: "勝ち型を再利用する" },
    { postType: "comparison_review", linkStrategy: "body_link", objective: "click", cta: "詳細を見る", slot: "20:30", role: "クリック効率を取りにいく" },
    { postType: "profile_cta", linkStrategy: "profile_cta", objective: "follow", cta: "今後の発掘メモはプロフィールから", slot: "23:00", role: "フォロー導線を残す" },
    { postType: "discovery_interest", linkStrategy: "no_link", objective: "impression", cta: "保存用の発見メモ", slot: "17:40", role: "露出の土台を残す" },
  ],
};

export function getGrowthStage(day: number): MyfansGrowthStage {
  if (day <= 7) return "day_1_7";
  if (day <= 14) return "day_8_14";
  return "day_15_30";
}

export function getOperationDay(startDate = process.env.MYFANS_X_OPERATION_START_DATE) {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(start)) return 1;
  const now = Date.now();
  return Math.min(30, Math.max(1, Math.floor((now - start) / 86_400_000) + 1));
}
