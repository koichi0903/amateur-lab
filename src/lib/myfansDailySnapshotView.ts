export type PersistedDailyCandidateView = {
  id: string;
  optionLabel: string;
  optionName: string;
  optionRank: number;
  body: string;
  selfReply: string;
  sourceXUrl: string;
  quoteXUrl: string;
  sourceAuthorHandle: string;
  sourceCreator: string;
  myfansCreator: string;
  productCreator: string;
  sourceProductMatch: unknown;
  resolverEvidence: unknown;
  candidateType: string;
  monetizableStatus: string;
  monetizable: boolean;
  sourceSpecificityScore: number;
  candidateTitle: string;
  role: string;
  postType: string;
  postMode: string;
  linkStrategy: string;
  sourceMediaType: string;
  myfansTargetUrl: string;
  affiliateStatus: string;
  affiliateConnectionStatus: string;
  affiliateUrl: string;
  productId: number | null;
  productTitle: string;
  creativeStrategy: string;
  topicIdentity: string;
  reasonToCare: string;
  visualStatus: string;
  visualEvidence: string;
  quality: number | null;
  topicValue: number | null;
  noveltyLabel: string;
  sameSourceStatus: string;
  lastSameSourceDate: string | null;
  lastSameCreatorDate: string | null;
  pastBodySimilarityLabel: string;
  whySelected: string;
};

export type PersistedDailySlotView = {
  slot: string;
  postOrder: number;
  recommendedOption: string;
  candidates: PersistedDailyCandidateView[];
};

export type PersistedDailySnapshotView = {
  planId: number;
  planDate: string;
  revision: number | null;
  evaluatedAt: string | null;
  selectedOptions: Record<string, string>;
  slots: PersistedDailySlotView[];
  optionCount: number;
  selectedCount: number;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback: number | null = null) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function selectedOptionsFrom(strategyJson: Record<string, unknown>) {
  const value = strategyJson.daily_option_selection;
  return Object.fromEntries(Object.entries(asRecord(value)).filter(([, selected]) => typeof selected === "string" && selected.length > 0)) as Record<string, string>;
}

function restoreCandidate(raw: unknown, postOrder: number, index: number): PersistedDailyCandidateView {
  const row = asRecord(raw);
  const productId = asNumber(row.product_id);
  return {
    id: asString(row.id) || `persisted-${postOrder}-${index}`,
    optionLabel: asString(row.option_label) || String.fromCharCode(65 + index),
    optionName: asString(row.option_name) || "保存済み候補",
    optionRank: asNumber(row.option_rank, index + 1) ?? index + 1,
    body: asString(row.body),
    selfReply: asString(row.self_reply),
    sourceXUrl: asString(row.source_x_url),
    quoteXUrl: asString(row.quote_x_url),
    sourceAuthorHandle: asString(row.source_author_handle),
    sourceCreator: asString(row.source_creator),
    myfansCreator: asString(row.myfans_creator),
    productCreator: asString(row.product_creator),
    sourceProductMatch: row.source_product_match ?? null,
    resolverEvidence: row.resolver_evidence ?? null,
    candidateType: asString(row.candidate_type),
    monetizableStatus: asString(row.monetizable_status) || "unlinked",
    monetizable: row.monetizable === true,
    sourceSpecificityScore: asNumber(row.source_specificity_score, 0) ?? 0,
    candidateTitle: asString(row.candidate_title),
    role: asString(row.role),
    postType: asString(row.post_type),
    postMode: asString(row.post_mode),
    linkStrategy: asString(row.link_strategy),
    sourceMediaType: asString(row.source_media_type),
    myfansTargetUrl: asString(row.myfans_target_url),
    affiliateStatus: asString(row.affiliate_status) || "missing",
    affiliateConnectionStatus: asString(row.affiliate_connection_status),
    affiliateUrl: asString(row.affiliate_url),
    productId,
    productTitle: asString(row.product_title),
    creativeStrategy: asString(row.creative_strategy),
    topicIdentity: asString(row.topic_identity),
    reasonToCare: asString(row.reason_to_care),
    visualStatus: asString(row.visual_status) || "unavailable",
    visualEvidence: asString(row.visual_evidence),
    quality: asNumber(row.quality),
    topicValue: asNumber(row.topic_value),
    noveltyLabel: asString(row.novelty_label),
    sameSourceStatus: asString(row.same_source_status),
    lastSameSourceDate: typeof row.last_same_source_date === "string" ? row.last_same_source_date : null,
    lastSameCreatorDate: typeof row.last_same_creator_date === "string" ? row.last_same_creator_date : null,
    pastBodySimilarityLabel: asString(row.past_body_similarity_label),
    whySelected: asString(row.why_selected),
  };
}

export function restorePersistedDailySnapshot(input: {
  id: number;
  planDate: string;
  revision?: number | null;
  evaluatedAt?: string | null;
  strategyJson: Record<string, unknown> | null;
}): PersistedDailySnapshotView {
  const strategyJson = input.strategyJson ?? {};
  const rawSlots = Array.isArray(strategyJson.candidate_options) ? strategyJson.candidate_options : [];
  const slots = rawSlots.map((rawSlot, slotIndex) => {
    const slot = asRecord(rawSlot);
    const rawCandidates = Array.isArray(slot.candidates) ? slot.candidates : [];
    const postOrder = asNumber(slot.post_order, slotIndex + 1) ?? slotIndex + 1;
    return {
      slot: asString(slot.slot),
      postOrder,
      recommendedOption: asString(slot.recommended_option) || "A",
      candidates: rawCandidates.map((candidate, candidateIndex) => restoreCandidate(candidate, postOrder, candidateIndex)),
    };
  });
  const selectedOptions = selectedOptionsFrom(strategyJson);
  const selectedCount = slots.reduce((count, slot) => count + (selectedOptions[String(slot.postOrder)] ? 1 : 0), 0);
  return {
    planId: input.id,
    planDate: input.planDate,
    revision: input.revision ?? null,
    evaluatedAt: input.evaluatedAt ?? null,
    selectedOptions,
    slots,
    optionCount: slots.reduce((count, slot) => count + slot.candidates.length, 0),
    selectedCount,
  };
}
