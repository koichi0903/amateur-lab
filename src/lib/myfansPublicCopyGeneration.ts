import { stableHash } from "@/lib/myfansHash";
import {
  completeSourcePhrase,
  humanObservationFromEvidence,
  reactionTypeFor,
  visualUnderstandingFor,
  weakAttentionCue,
} from "@/lib/myfansCreativeEvidence";
import { MYFANS_ATTENTION_VALUE_MINIMUM } from "@/lib/myfansTopicValue";
import type { HumanReactionType, MyfansLinkStrategy, PublicCopyFacts, VisualUnderstanding } from "@/lib/myfansXExecution";
function socialProofLine(facts: PublicCopyFacts) {
  const views = facts.publicMetrics.views;
  if (views && views >= 100_000) return `そりゃ${Math.floor(views / 10_000)}万表示いくよな、ってなる。`;
  if (views && views >= 50_000) return "ここまで伸びるのも分かる。";
  if ((facts.publicMetrics.likes ?? 0) >= 1000) return "いいねが集まるのも納得。";
  return "";
}

function humanReactionLine(reactionType: HumanReactionType, understanding: VisualUnderstanding, variant = 0) {
  const medium = understanding.mediaType === "video" ? "これ" : understanding.mediaType === "image" ? "この1枚" : "この投稿";
  const cue = understanding.concreteVisualCue && !weakAttentionCue(understanding.concreteVisualCue)
    ? understanding.concreteVisualCue
    : understanding.attentionMoment || understanding.humanObservation;
  if (cue) {
    const concreteByType: Record<HumanReactionType, string[]> = {
      surprise: [`え、${cue}から始まるのずるい。`, `${cue}って分かった瞬間に目が戻る。`, `${cue}だけで普通に見入った。`],
      agreement: [`${cue}なら最後まで見ちゃう。`, `${cue}が先に来たらそりゃ強い。`, `${cue}で入るの、かなりうまい。`],
      curiosity: [`${cue}で止めてくるのずるい。`, `${cue}のあと、普通に気になる。`, `${cue}から始まるなら一回開く。`],
      contrast: [`${cue}で急に見方が変わる。`, `${cue}があるから二度見した。`, `${cue}の切り替わりで目が戻る。`],
      immediacy: [`${cue}を冒頭に置くのうまい。`, `${cue}で一瞬持っていかれる。`, `${cue}だけで何が見どころか分かる。`],
      specific_appeal: [`${cue}が好きなら一発で分かる。`, `${cue}の見せ方、かなり刺さる。`, `${cue}で好みが一気に分かれる。`],
      unexpected: [`${cue}、思ったより引きがある。`, `${cue}が先に来るのちょっとずるい。`, `${cue}で予想より気になる。`],
      visual_clarity: [`${cue}だけで何系か分かる。`, `${cue}が先に見えるのうまい。`, `${cue}で見どころまで入ってくる。`],
    };
    return concreteByType[reactionType][variant % concreteByType[reactionType].length];
  }
  const byType: Record<HumanReactionType, string[]> = {
    surprise: [`え、${medium}普通に見入った。`, `これ流れてきたら一回開く。`, `最初に見た瞬間でちょっと持っていかれる。`],
    agreement: [`こういうの結局最後まで見ちゃう。`, `${medium}、伸びるのも分かる。`, `見たら強いところがすぐ分かる。`],
    curiosity: [`この入り方ずるい。`, `ここからどうなるのか気になるやつ。`, `一回開いてしまうタイプ。`],
    contrast: [`最初はさらっと見えるのに、途中で印象変わりそう。`, `ぱっと見より後から効いてくるタイプ。`, `普通に通り過ぎたのに戻りたくなる。`],
    immediacy: [`最初の数秒で持っていくの強い。`, `説明される前に見どころが来る。`, `一瞬で何が強いか分かるのずるい。`],
    specific_appeal: [`この近さが刺さる人は一瞬で分かる。`, `作り込みすぎてない感じが逆に残る。`, `見た瞬間に好みが分かれるの強い。`],
    unexpected: [`思ってたより引きが強い。`, `軽く見るつもりでも、これは残る。`, `予想よりちゃんと気になってしまう。`],
    visual_clarity: [`画像だけで伝わるの強い。`, `${medium}だけで見どころが分かる。`, `言葉で盛らなくても伝わるタイプ。`],
  };
  return byType[reactionType][variant % byType[reactionType].length];
}

function concreteCueForWhyAngle(understanding: VisualUnderstanding) {
  return understanding.concreteVisualCue && !weakAttentionCue(understanding.concreteVisualCue)
    ? understanding.concreteVisualCue
    : understanding.attentionMoment || understanding.humanObservation;
}

function whyAngleForConcreteCue(
  reactionType: HumanReactionType,
  understanding: VisualUnderstanding,
  cue: string,
  proof: string,
  variant: number,
) {
  if (reactionType === "curiosity") return "ここからどうなるのか気になってしまう。";
  if (reactionType === "agreement") return `${cue}で一気に持っていく。`;
  if (reactionType === "contrast") return understanding.visibleChangeOrContrast || "そのズレで見返したくなる。";
  if (reactionType === "specific_appeal") return "合う人には早い段階で刺さる。";
  if (reactionType === "visual_clarity") return "説明より先に好みが分かる。";
  if (reactionType === "immediacy") return understanding.mediaType === "video" ? "冒頭にこれを置かれると強い。" : "1枚目でこれを置かれると強い。";
  if (proof && variant % 4 === 0) return proof;
  return "だから反応が集まるのも分かる。";
}

function whyAngleWithoutConcreteCue(
  reactionType: HumanReactionType,
  understanding: VisualUnderstanding,
  proof: string,
  variant: number,
) {
  if (reactionType === "curiosity") return understanding.mediaType === "video" ? "冒頭だけで一回開いてしまう。" : "この切り取りだけで気になってしまう。";
  if (reactionType === "agreement") return "見せ方が分かりやすいから、知らなくても入りやすい。";
  if (reactionType === "contrast") return understanding.motionCue || "ぱっと見と残り方に差がある。";
  if (reactionType === "specific_appeal") return "刺さるポイントが一瞬で伝わる。";
  if (reactionType === "visual_clarity") return "説明より先に雰囲気が入ってくる。";
  if (reactionType === "immediacy") return "冒頭だけで続きを見たくなる。";
  if (proof && variant % 4 === 0) return proof;
  return "こういう分かりやすい引きは強い。";
}

export function whyAngleLine(reactionType: HumanReactionType, understanding: VisualUnderstanding, facts: PublicCopyFacts, variant = 0) {
  const proof = socialProofLine(facts);
  const cue = concreteCueForWhyAngle(understanding);
  if (cue) {
    return whyAngleForConcreteCue(reactionType, understanding, cue, proof, variant);
  }
  return whyAngleWithoutConcreteCue(reactionType, understanding, proof, variant);
}

function humanObservationVariants(understanding: VisualUnderstanding, facts: PublicCopyFacts, variant = 0) {
  const translated = understanding.attentionMoment || understanding.humanObservation || humanObservationFromEvidence(facts.quoteVisualAnalysis, facts.visualContext, variant);
  if (!translated || understanding.visualAnalysisStatus !== "verified" || weakAttentionCue(translated)) return [];
  const momentFamilies: Array<[RegExp, string[][]]> = [
    [/制服っぽい写真から入る/, [
      ["制服っぽい写真から始まると、そこで一気に雰囲気が決まる。", "ただの紹介より、先に人の感じが出るのがいい。"],
      ["階段の写真で制服っぽさが先に来るの、普通に引きがある。", "プロフィール画面より、その前の一枚のほうが気になる。"],
    ]],
    [/海辺で赤と黒だけぱっと浮く/, [
      ["海辺で赤と黒だけぱっと浮くの、見た瞬間に強い。", "明るい場所なのに色で一回目が戻る。"],
      ["砂浜の明るさに赤と黒がはっきり出てる。", "これだけ伸びてるのも少し分かる。"],
    ]],
    [/ベッド越しの距離が近い/, [
      ["ベッド越しの距離が近いと、それだけで場面が伝わる。", "盛って言わなくても、好きな人にはそこで刺さる。"],
      ["白いベッドより、向かい合ってる近さのほうが先に来る。", "この距離感は説明される前に分かる。"],
    ]],
    [/白いベッドに青いランジェリーが出る/, [
      ["白いベッドに青が入るだけで、ぱっと見の印象がかなり変わる。", "色が先に残るから、細かい説明はいらない。"],
      ["ベッドの白さに青いランジェリーが乗ると、そこだけ先に見える。", "これは好きな人なら一瞬で分かる。"],
    ]],
    [/くまっぽい小物と踊り出しのゆるさ/, [
      ["くまっぽい小物と踊り出しのゆるさ、最初から少し気になる。", "作り込みすぎてない感じが逆に残る。"],
      ["踊り出しが軽いのに、小物で妙に印象が残る。", "こういうゆるい入り方は最後まで見てしまう。"],
    ]],
    [/引きから近めに変わる/, [
      ["引きで見せてから近めに変わるの、そこで見方が変わる。", "最初だけで判断しにくいから、少し先まで見たくなる。"],
      ["最初は引きなのに、途中で距離が詰まる。", "この変わり方は流してると戻りたくなる。"],
    ]],
  ];
  const matched = momentFamilies.find(([pattern]) => pattern.test(translated))?.[1];
  if (matched) return matched;
  const copyFamilies = [
    [
      `${translated}。`,
      "こういう入り方だと、説明が少なくても手が止まる。",
    ],
    [
      `${translated}のがいい。`,
      facts.visualContext === "video" ? "動きの前置きが短いから、そのまま見てしまう。" : "色と距離で先に引っかかるから、文字を読む前に止まる。",
    ],
    [
      `${translated}。`,
      "盛って言わなくても、好きな人にはそこで刺さる。",
    ],
    [
      `${translated}、地味に強い。`,
      facts.visualContext === "video" ? "最初から全部説明しない感じが逆に気になる。" : "ぱっと見で場面が伝わる一枚は強い。",
    ],
  ];
  return copyFamilies.map((lines) => {
    const adjusted = facts.publicMetrics.views && facts.publicMetrics.views >= 100_000 && variant % 5 === 0
      ? [lines[0], "これだけ伸びてるのも少し分かる。"]
      : lines;
    return adjusted;
  });
}

function isRevenueCopyPost(postType: string) {
  return postType === "reply_link_sales" || postType === "body_link_sales";
}

function revenueCopyLines(firstLine: string, postType: string) {
  return [
    `${firstLine}${postType === "body_link_sales" ? " #PR" : ""}`,
    postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。",
  ];
}

function sourceDrivenCopyLines(facts: PublicCopyFacts, sourceSnippet: string, postType: string, variant: number) {
  const sourceLines = [
    [`「${sourceSnippet}」って出てきたら、普通に二度見する。`, facts.visualContext === "video" ? "続きがあるなら見に行く人多そう。" : "この一言だけで好みが分かれる。"],
    [`「${sourceSnippet}」はさすがに目が止まる。`, facts.visualContext === "video" ? "何が起きるのか一回見たくなる。" : "写真を見る前にちょっと構えるやつ。"],
    [`タイムラインで「${sourceSnippet}」は強い。`, "好きな人ならそこで戻ると思う。"],
    [`「${sourceSnippet}」だけでだいぶクセが出てる。`, "合うかどうか、読んだ瞬間に分かれる。"],
    [`「${sourceSnippet}」って言われたら、少し先まで見たくなる。`, facts.visualContext === "video" ? "冒頭だけで閉じにくいやつ。" : "この切り取りなら一回開く。"],
    [`「${sourceSnippet}」の時点で、もう人を選んでる。`, "刺さる人にはかなり早い。"],
    [`「${sourceSnippet}」が先に見えるの、ずるい。`, facts.visualContext === "video" ? "動画の中身を盛らなくても続きが気になる。" : "画像の前に文で止まる。"],
    [`「${sourceSnippet}」で流れてきたら、たぶん戻る。`, "短いのに引っかかりがある。"],
  ];
  const selected = sourceLines[(variant + stableHash(sourceSnippet)) % sourceLines.length];
  if (isRevenueCopyPost(postType)) return revenueCopyLines(selected[0], postType);
  return selected;
}

function reactionDrivenCopyLines(
  facts: PublicCopyFacts,
  understanding: VisualUnderstanding,
  reactionType: HumanReactionType,
  postType: string,
  linkStrategy: MyfansLinkStrategy,
  variant: number,
) {
  const first = humanReactionLine(reactionType, understanding, variant);
  const second = whyAngleLine(reactionType, understanding, facts, variant);
  const lines = isRevenueCopyPost(postType) ? revenueCopyLines(first, postType) : [first, second];
  if (linkStrategy === "profile_cta" && second === socialProofLine(facts)) return [first, "好みならプロフィールまで見たくなる。"];
  return lines;
}

export function buildPublicCopyV8(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  const reactionType = reactionTypeFor(facts, variant);
  const sourceSnippet = completeSourcePhrase(facts.sourceText, 34);
  if (facts.sourceText && sourceSnippet.length >= 6) return sourceDrivenCopyLines(facts, sourceSnippet, postType, variant);
  return reactionDrivenCopyLines(facts, understanding, reactionType, postType, linkStrategy, variant);
}

function buildPublicCopyV9(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  const cue = understanding.concreteVisualCue;
  if (!cue || understanding.visualAnalysisStatus !== "verified") return buildPublicCopyV8(facts, postType, linkStrategy, variant);
  const context = understanding.visibleChangeOrContrast || understanding.cameraDistanceOrFraming || understanding.compositionOrStyle || understanding.textOverlayCue || understanding.motionCue;
  const firstOptions = [
    `${cue}から入るの強い。`,
    `${cue}で一回止まる。`,
    `${cue}だけで見どころが分かる。`,
  ];
  const secondOptions = [
    context ? `${context}で一回目が戻る。` : "最後まで見てしまう始まり方。",
    "これは続きまで確認したくなる。",
    context ? `${context}からもう少し見たくなる。` : "こういう入りは手が止まるの分かる。",
  ];
  const isRevenue = postType === "reply_link_sales" || postType === "body_link_sales";
  const first = firstOptions[variant % firstOptions.length];
  const second = isRevenue
    ? (postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。")
    : secondOptions[variant % secondOptions.length];
  return [`${first}${postType === "body_link_sales" ? " #PR" : ""}`, second];
}

export function buildPublicCopyV10(facts: PublicCopyFacts, postType: string, linkStrategy: MyfansLinkStrategy, variant = 0) {
  const understanding = visualUnderstandingFor(facts);
  if (understanding.visualAnalysisStatus !== "verified" || !understanding.attentionMoment || understanding.attentionValue.score < MYFANS_ATTENTION_VALUE_MINIMUM) return buildPublicCopyV8(facts, postType, linkStrategy, variant);
  const isRevenue = postType === "reply_link_sales" || postType === "body_link_sales";
  const variants = humanObservationVariants(understanding, facts, variant);
  const selectedIndex = (variant + stableHash(understanding.rawVisualEvidence || understanding.humanObservation)) % Math.max(1, variants.length);
  const selected = variants[selectedIndex] ?? buildPublicCopyV9(facts, postType, linkStrategy, variant);
  if (!isRevenue) return selected;
  return [`${selected[0]}${postType === "body_link_sales" ? " #PR" : ""}`, postType === "body_link_sales" ? "気になる人だけ詳細へ。" : "気になる人だけ自己リプへ。"];
}
