export function sourceCopySimilarity(body: string, sourceText: string) {
  const sourceTokens = sourceText.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter((token) => token.length >= 2);
  const bodyText = body.replace(/[^\p{L}\p{N}]+/gu, " ");
  if (sourceTokens.length < 3) return 0;
  const copied = sourceTokens.filter((token) => bodyText.includes(token)).length;
  return copied / sourceTokens.length;
}

const PUBLIC_COPY_LEAK_PATTERNS = [
  /browser/i,
  /visual表示/i,
  /検証|検証済み|確認済み候補/,
  /候補|公開候補/,
  /推定報酬|報酬率|expected reward|reward rate|affiliate economics/i,
  /Quality Gate|PASS|HOLD/i,
  /登録情報/,
  /正規URLと報酬条件/,
  /弱いvisual|visualは弱い/i,
  /システム|選定ルール|内部/,
  /止まりやすい|探す時間を減らしたい|反応と価格のズレ|判断材料|比較して見|好き嫌いが.*分かれ|〜向け|向けに/,
  /数字だけ浮いて見える|反応の強さが目に入る|数字の伸び方|同価格帯なら先に気になる|この反応は目立つ/,
  /validation|estimated reward|reward|audience intent|attention reason/i,
  /source text/i,
  /見た人の温度|元投稿の空気|空気を見ておきたい|反応が残った理由|まず確認したい|を見て判断したい|入口として強い|距離感で見せる|残り方が別物|流しにくい|さすがに一度確認したい/,
  /反応があるから|表示.*だから.*見たい|理由だけ確かめたい|先に元投稿/,
];

export function detectPublicCopyLeak(text: string) {
  const matches = PUBLIC_COPY_LEAK_PATTERNS.flatMap((pattern) => {
    const found = text.match(pattern);
    return found?.[0] ? [found[0]] : [];
  });
  return { hasLeak: matches.length > 0, matches };
}

export function publicCopyHardFail(text: string) {
  const rules: Array<[RegExp, string]> = [
    [/myfansアフィリエイト|X側で|単独の条件より/, "内部視点の公開文"],
    [/候補|判断|判断材料|確認済み|検証|検証済み|選定|分析|管理|内部|システム/, "内部判断語彙"],
    [/向けに|向けの|好き嫌いが|止まりやすい投稿|探す手間|探す時間|反応と価格のズレ|残す/, "管理者説明の露出"],
    [/表示[0-9０-９,，.．]+\s*\/\s*(いいね|RP)|いいね[0-9０-９,，.．]+\s*\/\s*(表示|RP)/, "metrics slash羅列"],
    [/^¥[0-9０-９,，.．]+.*(目立つ|反応|気になる)/m, "価格だけのhook"],
    [/数字だけ浮いて見える|反応の強さが目に入る|数字の伸び方|同価格帯なら先に気になる|この反応は目立つ|見ると印象が変わる|全体上位まで伸びた/, "v6数字分析表現"],
    [/報酬|reward|validation|Quality Gate|audience intent|Attention|visual/i, "system/reward語彙"],
    [/これ強い|一回止まる|見返したくなる|刺さるポイント|入口がある|入口がはっきり|こういう分かりやすい引き|分かりやすいから、知らなくても入りやすい/, "vague reaction phrase"],
    [/要素から入る|構図だけで空気が(だいぶ)?伝わる|から[^。！？!?]{0,18}が出る|で先に引けてる|分かりやすさで/, "v10自然文hard fail"],
    [/白いプロフィール画面|白っぽい部屋で動き出す|目に残る|目に入る、地味に強い|説明が少なくても手が止まる/, "low attention visual cue"],
    [/空気が(だいぶ)?伝わる|先を見たくなる|続きが気になる|引けてる|分かりやすさ|流れてきた理由がある|比べた時の違いが残る|方向性が分かる|方向性がはっきり|何が違うか分からない/, "汎用抽象結論"],
    [/見た人の温度|元投稿の空気|空気を見ておきたい|反応が残った理由|まず確認したい|を見て判断したい|入口として強い|距離感で見せる|残り方が別物|流しにくい|さすがに一度確認したい/, "分析者/第三者視点の抽象語"],
    [/反応があるから|表示.*だから.*見たい|理由だけ確かめたい|先に元投稿/, "バズ事実の解説だけ"],
    [/^.*向け/m, "audience label起点"],
  ];
  const reasons = rules.flatMap(([pattern, reason]) => pattern.test(text) ? [reason] : []);
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (new Set(lines).size < lines.length) reasons.push("同じ文を1投稿内で反復");
  return reasons;
}

export function machineLikeCopyIssue(text: string) {
  if ((text.match(/です。|ます。/g) ?? []).length >= 2) return "ですます調の反復";
  if ((text.match(/人なら/g) ?? []).length >= 1) return "読者ラベルの直書き";
  if ((text.match(/数字|反応|比較|発見|条件/g) ?? []).length >= 5) return "抽象語の連打";
  if (/理由がある|違いが残る|方向性が分かる|方向性がはっきり/.test(text)) return "具体差のない抽象結論";
  if (/数字[\s\S]*解説[\s\S]*(プロフィール|自己リプ|詳細)/.test(text)) return "数字＋解説＋CTAテンプレ";
  return "";
}

function normalizedTemplateLine(text: string) {
  return text
    .split(/\n+/)[0]
    .replace(/[0-9０-９,，.．]+/g, "0")
    .replace(/¥0/g, "¥")
    .replace(/(表示|いいね|保存|人気|RP)0/g, "$10")
    .replace(/\s+/g, "")
    .slice(0, 34);
}

function endingTone(text: string) {
  const compact = text.replace(/\s+/g, "");
  return compact.slice(-8);
}

const REPEATED_REACTION_PHRASES = ["地味に強い", "説明が少なくても手が止まる", "盛って言わなくても", "動画を見る前から引っかかりがある", "合う人にはすぐ分かる", "タイムラインで見たら"];

function repeatedReactionPhrase(body: string, previous: string) {
  for (const phrase of REPEATED_REACTION_PHRASES) {
    if (body.includes(phrase) && previous.includes(phrase)) return phrase;
  }
  return "";
}

function repeatedMetricTemplate(body: string, previous: string) {
  return /表示[0-9,]+\/いいね[0-9,]+/.test(body.replace(/\s+/g, ""))
    && /表示[0-9,]+\/いいね[0-9,]+/.test(previous.replace(/\s+/g, ""));
}

function issueAgainstPrevious(body: string, previous: string, first: string, ending: string, lines: string[]) {
  const previousFirst = normalizedTemplateLine(previous);
  const previousLines = previous.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (first && first === previousFirst) return "同じ1行目構文が続いています";
  if (lines.some((line) => line.length >= 12 && previousLines.includes(line))) return "同じ文が別投稿にも出ています";
  const phrase = repeatedReactionPhrase(body, previous);
  if (phrase) return `同じreaction phraseが別投稿にも出ています: ${phrase}`;
  if (ending && ending === endingTone(previous) && first.slice(0, 8) === previousFirst.slice(0, 8)) return "同じ語尾が続いています";
  if (repeatedMetricTemplate(body, previous) && first.slice(0, 6) === previousFirst.slice(0, 6)) return "数字テンプレの見え方が近すぎます";
  return "";
}

function dailyCopyLimitIssue(body: string, previousBodies: string[]) {
  const todayBodies = [body, ...previousBodies];
  const startsWithThisVideo = todayBodies.filter((text) => /^この動画/.test(text.trim())).length;
  if (startsWithThisVideo > 2) return "「この動画」始まりは同日2回までです";
  if ((body.match(/します/g) ?? []).length >= 2) return "宣言文の連発が残っています";
  return "";
}

export function hasPublicCopyDiversityIssue(body: string, previousBodies: string[]) {
  const first = normalizedTemplateLine(body);
  const ending = endingTone(body);
  const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const previous of previousBodies) {
    const issue = issueAgainstPrevious(body, previous, first, ending, lines);
    if (issue) return issue;
  }
  return dailyCopyLimitIssue(body, previousBodies);
}
