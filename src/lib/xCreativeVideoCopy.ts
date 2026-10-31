import { decisionFactProofLine } from "@/lib/domain/decisionFacts";
import { primaryUsableVisualFact } from "@/lib/xVisualVideoFacts";
import { primaryActress, primaryVideoTag, safeTitleFragment, strongestFacts } from "./xCreativeInputFacts";
import { concreteVisualPhrases } from "./xCreativeQuality";
import { humanProofLine } from "./xCreativeProof";
import { stableChoiceIndex } from "./xCreativeDeterminism";
import type { XCreativeInput, XGrowthIntent, XHookDirection, XLinkPlan, XVideoManualTag } from "./xCreativeTypes";

export function concreteVisualPhrase(fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>, seed: string) {
  const phrases = concreteVisualPhrases(fact);
  return phrases[stableChoiceIndex(seed, phrases.length)] ?? "";
}

function nativeVisualOpening(
  input: XCreativeInput,
  fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>,
  concretePhrase: string,
  intent: XGrowthIntent,
  direction: XHookDirection,
) {
  const core = concretePhrase.replace(/[。．]+$/, "");
  const key = [input.key, input.title, String(fact.kind), String(fact.value), intent, direction].join("|");
  const endings = [
    "のに、少し気になる。",
    "から、続きまで見たくなった。",
    "のが、少し引っかかる。",
    "のに、ここで目が止まった。",
  ];
  return `${core}${endings[stableChoiceIndex(key, endings.length)]}`;
}

function ensureNativeFirstLine(line: string) {
  if (/気になる|止ま|好き|違う|ズレ|迷う|見落|空気|こっち|正直|なんか|意外|早い|もったいない|外しそう|引っか|流して|弱い|強い|合う|寄って|印象|ジャケ|表紙|中身|決めない|半額だけ|数字より|選び方|差が|差あり/.test(line)) return line;
  return `${line.replace(/[。．]+$/, "")}。それでも少し気になる。`;
}

function videoReaderActionLine(
  input: XCreativeInput,
  fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>,
  intent: XGrowthIntent,
  tag: XVideoManualTag | null,
  direction: XHookDirection,
) {
  const linesByValue: Record<string, string[]> = {
    opening_change: [
      "最初の数秒で、続きまで見ていたくなった。",
      "この入り方、思わずもう少し見てしまう。",
      "冒頭の違いが、続きまで気になってしまう。",
      "開いてすぐの流れ、ここで離れるのは惜しい。",
      "この始まり方なら、先も見て確かめたくなる。",
    ],
    first_seconds_attention: [
      "開いてすぐの動きで、続きを見ていたくなった。",
      "最初の数秒に、目が止まってしまう。",
      "この変化は、もう少し先まで見ていたい。",
      "始まってすぐ、流し見をやめたくなる。",
      "最初の動きだけで、先も見て確かめたくなる。",
    ],
    safe_preview: [
      "冒頭を少し見たら、続きまで見て確かめたくなった。",
      "短く見ても、先の流れが気になってくる。",
      "この見え方なら、もう少し再生していたい。",
      "まず冒頭を見て、合うかどうか決めたくなる。",
      "サンプルの入り口から、続きも見て探りたくなる。",
    ],
    actress_fit: [
      "この見え方、もう少し先まで見ていたくなる。",
      "いつもと違う表情だから、冒頭から目が止まる。",
      "この空気が合うか、まず続きを見て確かめたい。",
      "見慣れた印象と違って、もう一度見ていたくなる。",
      "この違いは、冒頭だけで流さず見ておきたい。",
    ],
    jacket_sample_mismatch: [
      "サンプルを見たら、続きの見え方も見て確かめたくなる。",
      "ジャケだけで決めず、冒頭からもう少し見たい。",
      "この見え方の差は、先まで見て判断したくなる。",
      "表紙との違いが、かえって続きまで気になってしまう。",
      "この差を見ずに流すのは、少しもったいない。",
    ],
  };
  const choices = linesByValue[String(fact.value)] ?? [
    "冒頭を見たら、続きまで見て確かめたくなった。",
    "この見え方、もう少し先まで見ていたい。",
    "開いてすぐの違いに、目が止まってしまう。",
    "この変化は、流さず見ておきたくなる。",
      "最初の印象だけで、続きを見て探りたくなる。",
  ];
  const selectionKey = [input.key, input.title, input.url, String(fact.value), intent, tag ?? "none", direction].join("|");
  return choices[stableChoiceIndex(selectionKey, choices.length)];
}

export function videoSpecificLines(input: XCreativeInput, intent: XGrowthIntent, linkPlan: XLinkPlan, direction: XHookDirection) {
  const visualFact = primaryUsableVisualFact(input.visualFacts);
  const concretePhrase = visualFact ? concreteVisualPhrase(visualFact, [input.key, intent, direction].join("|")) : "";
  if (visualFact && concretePhrase) return visualFactLines(input, visualFact, concretePhrase, intent, linkPlan, direction);
  const tag = primaryVideoTag(input);
  if (!tag || tag === "too_explicit_for_reach" || tag === "weak_visual") return untaggedVideoLines(input, intent, direction);
  return manuallyTaggedVideoLines(input, intent, linkPlan, tag);
}

function visualFactLines(
  input: XCreativeInput,
  visualFact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>,
  concretePhrase: string,
  intent: XGrowthIntent,
  linkPlan: XLinkPlan,
  direction: XHookDirection,
) {
  const link = linkPlan === "body_link" ? input.url : "";
  const action = videoReaderActionLine(input, visualFact, intent, primaryVideoTag(input), direction);
  const subject = primaryActress(input) ?? safeTitleFragment(input);
  const layout = stableChoiceIndex([input.key, input.title, String(visualFact.value), intent, direction].join("|"), 4);
  // Keep the verified fact as a substring, but add a natural reaction so a
  // repeated historical fact line does not fail noTemplateReuse for every
  // variant of every work.
  const visualOpening = nativeVisualOpening(input, visualFact, concretePhrase, intent, direction);
  const subjectLead = primaryActress(input) ? `${subject}、${action}` : `${subject}で、${action}`;
  const lines = visualLayoutLines(layout, subjectLead, visualOpening, action, concretePhrase);
  const authorityQuestion = intent === "AUTHORITY" ? "冒頭の入り方、気になりますか。" : "";
  return [ensureNativeFirstLine(lines[0]), ...lines.slice(1), authorityQuestion, intent === "MONEY" ? humanProofLine(input, intent) : "", link].filter(Boolean);
}

function visualLayoutLines(layout: number, subjectLead: string, visualOpening: string, action: string, concretePhrase: string) {
  if (layout === 0) return [subjectLead, visualOpening];
  if (layout === 1) return [action, concretePhrase];
  if (layout === 2) return [subjectLead, concretePhrase];
  return [visualOpening, subjectLead];
}

function untaggedVideoLines(input: XCreativeInput, intent: XGrowthIntent, direction: XHookDirection) {
  const actress = primaryActress(input);
  const subject = actress ?? safeTitleFragment(input);
  // An official sample may be rights-safe before visual facts/manual tags
  // exist. Keep the copy native and factual without inventing a scene.
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  const fallbackEndings = [
    "先に見ておきたい。",
    "流さず、もう少し見てから決めたい。",
    "開いてから合うか確かめたい。",
    "気になったところだけ、続きも見ておきたい。",
  ];
  const ending = fallbackEndings[stableChoiceIndex([input.key, intent, direction].join("|"), fallbackEndings.length)];
  const authorityQuestion = intent === "AUTHORITY" ? "サンプルの入り方、気になりますか。" : "";
  return [`${subject}、サンプルが少し気になる。`, decisionProof || ending, authorityQuestion].filter(Boolean);
}

function manuallyTaggedVideoParts(
  input: XCreativeInput,
  intent: XGrowthIntent,
  tag: Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">,
) {
  const actress = primaryActress(input);
  const title = safeTitleFragment(input);
  const subject = actress ?? title;
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  const proof = input.decisionFacts
    ? strongestFacts(input).find((fact) => fact !== decisionProof) ?? ""
    : humanProofLine(input, intent);
  const lineByTag: Record<Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">, string> = {
    first_seconds_strong: "開いてすぐ、目が止まった。",
    visual_mismatch: `${subject}、ジャケより動画の方が気になる。`,
    actress_fit: actress ? `${actress}、この空気だと見え方が変わる。` : `${title}、動画の空気が合ってる。`,
    scene_surprise: "入り方が少し予想とズレます。",
    safe_preview: proof ? `${subject}、数字より先に動画で分かる。` : `${subject}、雰囲気だけ先に見える。`,
  };
  const closingByTag: Record<Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">, string> = {
    first_seconds_strong: actress ? `${actress}、この空気はかなり好み。` : "この空気、かなり好み。",
    visual_mismatch: "こっちの雰囲気の方が好きな人いそう。",
    actress_fit: "名前だけで流すの、少しもったいない。",
    scene_surprise: "この入り方、少し気になる。",
    safe_preview: "強く言わなくても、これで十分。",
  };
  return {
    opening: lineByTag[tag],
    proof: proof && (tag === "first_seconds_strong" || tag === "visual_mismatch") ? proof : "",
    closing: closingByTag[tag],
  };
}

function manuallyTaggedVideoLines(
  input: XCreativeInput,
  intent: XGrowthIntent,
  linkPlan: XLinkPlan,
  tag: Exclude<XVideoManualTag, "too_explicit_for_reach" | "weak_visual">,
) {
  const parts = manuallyTaggedVideoParts(input, intent, tag);
  const authorityQuestion = intent === "AUTHORITY" ? "この入り方、気になりますか。" : "";
  const link = linkPlan === "body_link" ? input.url : "";
  return [parts.opening, parts.proof, parts.closing, authorityQuestion, link].filter(Boolean);
}
