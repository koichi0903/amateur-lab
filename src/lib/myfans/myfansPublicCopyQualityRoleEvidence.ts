import type { MyfansPublicCopyQualityInput } from "./myfansPublicCopyQualityTypes";
import { discoveryInsightFor, isValidRevenueProduct, roleFor } from "./myfansCopyHelpers";
import { discoveryInsightFromTopic } from "./myfansTopicValue";
import type { DailyRole } from "./myfansTopicValue";

function insightTextAppears(body: string, insight: ReturnType<typeof discoveryInsightFromTopic> | ReturnType<typeof discoveryInsightFor>) {
  return Boolean(insight && body.includes(insight.line.split("。")[0] ?? ""));
}

function discoveryFactMissingFor(input: MyfansPublicCopyQualityInput, topicInsight: ReturnType<typeof discoveryInsightFromTopic>) {
  return input.postType === "ranking_note"
    && !topicInsight
    && !input.product.popularity_rank
    && input.product.likes_count <= 0
    && input.product.saves_count <= 0
    && !input.product.is_new
    && !input.quote;
}

function discoveryConcreteFor(
  input: MyfansPublicCopyQualityInput,
  isDiscovery: boolean,
  sourceTextGrounded: boolean,
  discoveryInsight: ReturnType<typeof discoveryInsightFor>,
  topicInsight: ReturnType<typeof discoveryInsightFromTopic>,
) {
  const discoveryPattern = /(新着なのに|新着で|人気[0-9０-９]+位|全体上位|中央値|同価格帯|いいね[0-9０-９,，]+に対して保存|X側で[0-9０-９]+万表示|X表示[0-9０-９,，]+|[0-9０-９]+万表示|[0-9０-９]+千表示|[0-9０-９]+いいね|反応が残っている|見た人の温度|元投稿の空気|¥[0-9０-９,，]+)/;
  return isDiscovery && (
    insightTextAppears(input.body, discoveryInsight)
    || sourceTextGrounded
    || discoveryPattern.test(input.body)
    || insightTextAppears(input.body, topicInsight)
  );
}

function authorityValueFor(input: MyfansPublicCopyQualityInput, isAuthority: boolean, topicInsight: ReturnType<typeof discoveryInsightFromTopic>) {
  const authorityPattern = /(今日残すなら|全体上位|中央値|同価格帯|verified visual|ここまで揃う|数字と見た目|先に見る理由|分かれ方|残った|もう一方は|要点|X側で[0-9０-９]+万表示|¥[0-9０-９,，]+)/;
  const profilePromise = /(探す手間を減らします|プロフィールにまとめます)$/m;
  const hasConcreteValue = authorityPattern.test(input.body) || insightTextAppears(input.body, topicInsight);
  return isAuthority && hasConcreteValue && !profilePromise.test(input.body.trim());
}

type QualityRoleEvidenceContext = {
  readerCuriosity: number;
  sourceTextGrounded: boolean;
};

function qualityRoleTopicInsightFor(input: MyfansPublicCopyQualityInput) {
  return input.topicValue?.verdict === "PASS" ? discoveryInsightFromTopic(input.topicValue) : null;
}

function qualityRoleFirstLineGateFailedFor(role: DailyRole, isDiscovery: boolean, context: QualityRoleEvidenceContext) {
  const attentionOrDiscovery = role === "ATTENTION" || isDiscovery;
  return attentionOrDiscovery && !isDiscovery && context.readerCuriosity < 25 && !context.sourceTextGrounded;
}

function qualityRoleDiscoveryFactsFor(
  input: MyfansPublicCopyQualityInput,
  isDiscovery: boolean,
  sourceTextGrounded: boolean,
  discoveryInsight: ReturnType<typeof discoveryInsightFor>,
  topicInsight: ReturnType<typeof discoveryInsightFromTopic>,
) {
  return {
    discoveryFactMissing: discoveryFactMissingFor(input, topicInsight),
    discoveryConcrete: discoveryConcreteFor(input, isDiscovery, sourceTextGrounded, discoveryInsight, topicInsight),
    discoveryMethodTalk: isDiscovery && /(比較して見る|見て残す|反応と価格を見て|分析|判断材料|候補|条件を確認)/.test(input.body),
  };
}

function qualityRoleRevenueValidFor(input: MyfansPublicCopyQualityInput, isRevenue: boolean) {
  return isRevenue && isValidRevenueProduct(input.product) && /^https:\/\/mfco\.link\/r\//.test(input.product.affiliate_url);
}

function qualityRoleGenericPhraseCountFor(input: MyfansPublicCopyQualityInput) {
  return input.body.match(/(目立つ|気になる|見て残す|判断材料|刺さるポイント|入口がある)/g)?.length ?? 0;
}

export function qualityRoleEvidenceFor(input: MyfansPublicCopyQualityInput, context: QualityRoleEvidenceContext) {
  const role = roleFor(input.postType, input.linkStrategy, input.creativeStrategy);
  const isDiscovery = role === "DISCOVERY";
  const isAuthority = role === "AUTHORITY";
  const isRevenue = role === "REVENUE";
  const discoveryInsight = discoveryInsightFor(input.product, input.quote, 0);
  const topicInsight = qualityRoleTopicInsightFor(input);
  const discoveryFacts = qualityRoleDiscoveryFactsFor(input, isDiscovery, context.sourceTextGrounded, discoveryInsight, topicInsight);
  const authorityValue = authorityValueFor(input, isAuthority, topicInsight);
  return {
    role,
    isDiscovery,
    isAuthority,
    isRevenue,
    firstLineGateFailed: qualityRoleFirstLineGateFailedFor(role, isDiscovery, context),
    ...discoveryFacts,
    authorityValue,
    revenueValid: qualityRoleRevenueValidFor(input, isRevenue),
    genericPhraseCount: qualityRoleGenericPhraseCountFor(input),
    discoveryInsight,
    topicInsight,
  };
}
