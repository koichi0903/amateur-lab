import type { MyfansProduct } from "@/lib/myfansAnalytics";
import type { MyfansCreativeStrategy, MyfansLinkStrategy } from "./myfansGrowthStrategy";

export function shortTitle(title: string) {
  const compact = title
    .replace(/\[[^\]]{10,}\]/g, "")
    .replace(/【[^】]{18,}】/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}...` : compact || "myfans作品";
}

function productSignalList(product: MyfansProduct) {
  const rows = [
    product.is_new ? "新着" : "",
    product.price > 0 ? `¥${product.price.toLocaleString("ja-JP")}` : "",
    product.popularity_rank ? `人気${product.popularity_rank}位` : "",
    product.likes_count > 0 ? `いいね${product.likes_count.toLocaleString("ja-JP")}` : "",
    product.saves_count > 0 ? `保存${product.saves_count.toLocaleString("ja-JP")}` : "",
  ].filter(Boolean);
  return rows.length ? rows : ["条件確認中"];
}

export function inferAngle(product: MyfansProduct) {
  const source = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (/巨乳|cup|カップ|爆乳|胸|乳/.test(source)) return "体型の分かりやすさ";
  if (/人妻|熟女|夫婦|妻|ママ/.test(source)) return "背徳感と生活感";
  if (/顔出し|完全顔|透明感|港区|女子大|jd|ol/.test(source)) return "人物像の強さ";
  if (/主観|ハメ撮り|個人|素人|vlog/.test(source)) return "距離感の近さ";
  if (/割引|sale|セール|削除|限定|明日まで/.test(source)) return "今見る理由";
  return "タイトルで刺さる人がはっきりしているところ";
}

export function inferAudience(product: MyfansProduct) {
  const source = `${product.title} ${product.genre} ${product.selection_reason}`.toLowerCase();
  if (/巨乳|cup|カップ|爆乳|胸|乳/.test(source)) return "分かりやすい体型訴求で選びたい人";
  if (/人妻|熟女|夫婦|妻|ママ/.test(source)) return "背徳感や生活感のある作品が好きな人";
  if (/顔出し|完全顔|透明感|港区|女子大|jd|ol/.test(source)) return "人物の雰囲気まで見て選びたい人";
  if (/主観|ハメ撮り|個人|素人|vlog/.test(source)) return "作り込みより距離感を重視する人";
  return "タイトルと条件を見て直感で選びたい人";
}

export function angleAppeal(product: MyfansProduct) {
  const angle = inferAngle(product);
  if (angle === "体型の分かりやすさ") return "好みが一瞬で判断できる";
  if (angle === "背徳感と生活感") return "設定より空気感で残る";
  if (angle === "人物像の強さ") return "誰が出ているかで選びやすい";
  if (angle === "距離感の近さ") return "作り込みより近さで刺さる";
  if (angle === "今見る理由") return "後回しにしにくい条件がある";
  return "刺さる人とスルーする人が分かれやすい";
}










export function dataStoryScore(product: MyfansProduct) {
  let score = 0;
  const reasons: string[] = [];
  if (product.popularity_rank && product.popularity_rank <= 10) { score += 30; reasons.push(`人気${product.popularity_rank}位`); }
  if (product.is_new) { score += 14; reasons.push("新着"); }
  if (product.saves_count >= 20) { score += Math.min(22, Math.round(product.saves_count / 4)); reasons.push(`保存${product.saves_count}`); }
  if (product.likes_count >= 100) { score += Math.min(18, Math.round(product.likes_count / 20)); reasons.push(`いいね${product.likes_count}`); }
  if (product.price > 0 && product.price <= 1500) { score += 16; reasons.push(`低価格¥${product.price.toLocaleString("ja-JP")}`); }
  if (product.reward_rate >= 80 || product.plan_signup_reward > 0) { score += 10; reasons.push("収益条件あり"); }
  return { score: Math.min(100, score), reasons };
}



function hasPermittedMedia(product: MyfansProduct) {
  return ["permitted_image", "permitted_video", "permitted_image_video"].includes(product.media_permission_status ?? "");
}

type MyfansCreativeDecision = {
  strategy: MyfansCreativeStrategy;
  reason: string;
  instruction: string;
  ogpCheckRequired: boolean;
  quoteXUrl: string;
};

function creativeDecision(
  strategy: MyfansCreativeStrategy,
  reason: string,
  instruction: string,
  ogpCheckRequired = false,
  quoteXUrl = "",
): MyfansCreativeDecision {
  return { strategy, reason, instruction, ogpCheckRequired, quoteXUrl };
}

function quotePostDecision(postType: string, quoteXUrl: string): MyfansCreativeDecision | null {
  if (!((postType === "discovery_interest" || postType === "profile_cta" || postType === "comparison_review") && quoteXUrl)) return null;
  return creativeDecision(
    "quote_post",
    "creator本人のX投稿を独立したGrowth Topicとして使うため。",
    "creator本人のX投稿を引用します。本文に元投稿本文は再掲しません。",
    false,
    quoteXUrl,
  );
}

function permittedMediaDecision(product: MyfansProduct): MyfansCreativeDecision | null {
  if (!hasPermittedMedia(product)) return null;
  return creativeDecision(
    "permitted_media",
    "creator個別許諾が登録されているため。許諾メモの範囲外では使いません。",
    "許諾メモを確認し、その範囲の画像/動画だけを添付します。",
  );
}

function affiliateOgpDecision(product: MyfansProduct, linkStrategy: MyfansLinkStrategy): MyfansCreativeDecision | null {
  if (linkStrategy === "reply_link" && product.affiliate_url) {
    return creativeDecision(
      "myfans_ogp",
      "Revenue枠は正規mfco.linkを自己リプに置き、myfans側の正規OGP表示を使うため。",
      "本投稿はフックだけ出し、自己リプに#PRとmfco.linkを貼ります。X上でOGP表示を確認します。",
      true,
    );
  }
  if (linkStrategy === "body_link" && product.affiliate_url) {
    return creativeDecision(
      "myfans_ogp",
      "本文リンク検証では正規mfco.linkのOGP表示を確認できるため。",
      "X投稿画面でOGPが出ることを確認し、出ない場合は自己リプ型へ切り替えます。",
      true,
    );
  }
  return null;
}

function insufficientDataCardDecision(postType: string, story: ReturnType<typeof dataStoryScore>): MyfansCreativeDecision {
  if (postType === "ranking_note") {
    return creativeDecision(
      "text_only",
      `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。${story.reasons.length ? story.reasons.join(" / ") : "一目で伝わる順位差・価格差・反応差が不足"}。`,
      "カードは作らずtext onlyで発見の意味だけを出します。",
    );
  }
  if (postType === "discovery_interest") {
    return creativeDecision(
      "text_only",
      `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。カード化しても注目理由が強くなりません。`,
      "画像カードは使わず、本文の具体的な発見で反応を見ます。",
    );
  }
  return creativeDecision(
    "text_only",
    `CARD NOT RECOMMENDED: Data Story Score ${story.score}/100。比較カードにするだけの明確な差が不足しています。`,
    "カードを生成せず、発掘アカウントとしての判断基準を本文で出します。",
  );
}

function recommendedDataCardDecision(postType: string, quoteXUrl: string, story: ReturnType<typeof dataStoryScore>): MyfansCreativeDecision {
  if (postType === "ranking_note") {
    return creativeDecision(
      "ranking_card",
      `CARD RECOMMENDED: Data Story Score ${story.score}/100。${story.reasons.join(" / ")}を1枚で見せられるため。`,
      "カードを生成して添付します。作品画像/動画は取り込みません。",
    );
  }
  if (postType === "discovery_interest") {
    return creativeDecision(
      "discovery_card",
      quoteXUrl
        ? "creator本人のX投稿URLは候補として残しつつ、初見の発見枠は無断素材なしのテキストカードで止めるため。"
        : "引用元がない発見枠でも、条件カードなら無断素材なしで目に止められるため。",
      quoteXUrl
        ? "カードを生成して添付します。引用候補URLは必要時の代替素材として扱い、元投稿本文は再掲しません。"
        : "カードを生成して添付するか、カードなしのtext onlyで反応を測ります。",
    );
  }
  return creativeDecision(
    "comparison_card",
    quoteXUrl
      ? "プロフィール誘導は引用だけに頼らず、向いている人の違いをテキストカードで見せる方がフォロー理由になるため。"
      : "比較・失敗回避のフォロー理由を、テキスト情報だけで見せられるため。",
    "カードを生成して添付します。価格、条件、見る前チェックだけを使い、作品画像/動画は取り込みません。",
  );
}

function dataCardDecision(product: MyfansProduct, postType: string, quoteXUrl: string): MyfansCreativeDecision | null {
  if (postType !== "ranking_note" && postType !== "discovery_interest" && postType !== "comparison_review" && postType !== "profile_cta") return null;
  const story = dataStoryScore(product);
  return story.score < 60
    ? insufficientDataCardDecision(postType, story)
    : recommendedDataCardDecision(postType, quoteXUrl, story);
}

function conservativeTextDecision(): MyfansCreativeDecision {
  return creativeDecision(
    "text_only",
    "引用元、正規OGP、許諾素材、カード向きデータが不足しているため安全側へ倒します。",
    "画像/動画は添付せず本文だけで投稿します。",
  );
}

export function decideCreativeStrategy(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy, quoteXUrlOverride = ""): MyfansCreativeDecision {
  const quoteXUrl = quoteXUrlOverride;
  const quoteDecision = quotePostDecision(postType, quoteXUrl);
  if (quoteDecision) return quoteDecision;
  const mediaDecision = permittedMediaDecision(product);
  if (mediaDecision) return mediaDecision;
  const affiliateDecision = affiliateOgpDecision(product, linkStrategy);
  if (affiliateDecision) return affiliateDecision;
  return dataCardDecision(product, postType, quoteXUrl) ?? conservativeTextDecision();
}

export function mediaPlanFor(product: MyfansProduct, postType: string, linkStrategy: MyfansLinkStrategy) {
  const creative = decideCreativeStrategy(product, postType, linkStrategy);
  if (creative.strategy === "quote_post") {
    return {
      label: "creator X投稿の引用",
      asset: "引用",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "myfans_ogp") {
    return {
      label: "myfans正規OGP",
      asset: "mfco.link OGP",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "permitted_media") {
    return {
      label: "許諾済み画像/動画",
      asset: "許諾済み素材",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  if (creative.strategy === "ranking_card" || creative.strategy === "comparison_card" || creative.strategy === "discovery_card") {
    return {
      label: creative.strategy === "ranking_card" ? "自作ランキングカード" : creative.strategy === "comparison_card" ? "自作比較カード" : "自作発見カード",
      asset: "テキスト画像",
      instruction: creative.instruction,
      reason: creative.reason,
    };
  }
  return {
    label: "画像/動画は任意",
    asset: "なし、または承認済み素材",
    instruction: "素材許可がある時だけ添付。ない時は本文のフックと条件で反応を見る。",
    reason: "フォロワー0期は無理に素材を使うより、型ごとの反応差を安全に測るため。",
  };
}

function cardKindFor(strategy: MyfansCreativeStrategy): "ranking" | "comparison" | "discovery" {
  if (strategy === "ranking_card") return "ranking";
  if (strategy === "comparison_card") return "comparison";
  return "discovery";
}

function cardHeadlineFor(strategy: MyfansCreativeStrategy, rank: string, price: string) {
  if (strategy === "ranking_card") return rank || price || "数字で見る1本";
  if (strategy === "comparison_card") return "向いてる人が分かれる1本";
  return "見るポイントは1つ";
}

function cardPrimaryFor(strategy: MyfansCreativeStrategy, product: MyfansProduct, audience: string) {
  if (strategy === "ranking_card") return `${angleAppeal(product)}か、数字と並べて見る`;
  if (strategy === "comparison_card") return `${audience} / 合わない人はここで切れる`;
  return `${angleAppeal(product)}か`;
}

function cardSubtitleFor(strategy: MyfansCreativeStrategy) {
  if (strategy === "ranking_card") return "数字で先に見る";
  if (strategy === "comparison_card") return "見る前チェック";
  return "好みで止まる発見";
}

function cardEngagementFor(product: MyfansProduct) {
  return {
    likes: product.likes_count > 0 ? `いいね ${product.likes_count.toLocaleString("ja-JP")}` : "",
    saves: product.saves_count > 0 ? `保存 ${product.saves_count.toLocaleString("ja-JP")}` : "",
  };
}

function cardCheckFor(postType: string) {
  if (postType === "ranking_note") return "数字は入口。保存理由まで見る";
  if (postType === "comparison_review" || postType === "profile_cta") return "合う人/合わない人を先に分ける";
  return "好みの軸を先に見る";
}

export function cardPayloadFor(product: MyfansProduct, postType: string, strategy: MyfansCreativeStrategy) {
  const creatorName = product.myfans_creators?.display_name ?? "";
  const angle = inferAngle(product);
  const audience = inferAudience(product);
  const signals = productSignalList(product);
  const price = product.price > 0 ? `¥${product.price.toLocaleString("ja-JP")}` : "";
  const rank = product.popularity_rank ? `人気 ${product.popularity_rank}位` : "";
  const cardKind = cardKindFor(strategy);
  const headline = cardHeadlineFor(strategy, rank, price);
  const primary = cardPrimaryFor(strategy, product, audience);
  const engagement = cardEngagementFor(product);
  return {
    kind: strategy,
    title: shortTitle(product.title),
    creator: creatorName,
    cardKind,
    headline,
    primary,
    subtitle: cardSubtitleFor(strategy),
    price,
    reward: "",
    rank,
    likes: engagement.likes,
    saves: engagement.saves,
    chip1: signals[0] ?? "",
    chip2: signals[1] ?? "",
    chip3: signals[2] ?? "",
    angle,
    audience,
    audienceLine: `向いてる人: ${audience}`,
    check: cardCheckFor(postType),
    footer: "@lumi_reviw / myfans発掘・比較",
  };
}

