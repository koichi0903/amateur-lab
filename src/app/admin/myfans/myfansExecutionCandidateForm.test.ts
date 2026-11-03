import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import { buildExecutionCandidateFormData } from "./myfansExecutionCandidateForm";

test("candidate persistence keeps productless source identity and posting metadata", () => {
  const candidate = {
    id: "candidate-1",
    body: "候補本文",
    quoteXUrl: "",
    sourceXUrl: "https://x.com/example/status/123",
    mediaPermalink: null,
    selfReply: "自己リプ",
    linkStrategy: "no_link",
    postType: "quote_post",
    reason: "source discovery",
    quoteCandidateId: null,
    product: null,
    growthStage: "emerging",
    ctaStrategy: "profile_cta",
    creativeVariantId: "variant-a",
    creativeStrategy: "text_only",
    creativeReason: "source evidence",
    cardPayload: { title: "card" },
    objective: "discovery",
    sourceAuthorLabel: "creator",
    sourceMediaType: "video",
    approvedMediaId: null,
    ogpCheckRequired: false,
    mediaPermissionStatus: "not_required",
    plannedSlot: "slot-1",
    marketPatternKey: null,
    globalContentFingerprint: null,
    approvedMediaName: "approved media",
    opportunity: null,
    affiliateUrl: "",
  } as unknown as ExecutionCandidate;

  const formData = buildExecutionCandidateFormData(candidate);
  const cardPayload = JSON.parse(String(formData.get("card_payload")));

  assert.equal(formData.get("action"), "post");
  assert.equal(formData.get("body"), "候補本文\n\nhttps://x.com/example/status/123");
  assert.equal(formData.get("quote_x_url"), "https://x.com/example/status/123");
  assert.equal(formData.get("source_x_url"), "https://x.com/example/status/123");
  assert.equal(formData.get("includes_pr"), "false");
  assert.equal(formData.get("media_permission_status"), "not_required");
  assert.equal(formData.get("planned_slot"), "slot-1");
  assert.equal(formData.get("objective"), "discovery");
  assert.equal(cardPayload.candidate_id, "candidate-1");
  assert.equal(cardPayload.attribution.source_author, "creator");
  assert.equal(formData.has("approved_media_id"), false);
  assert.equal(formData.has("global_content_fingerprint"), false);
});
