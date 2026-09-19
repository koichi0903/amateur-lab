import assert from "node:assert/strict";
import { mergePersistedQuoteMediaEvidence } from "./myfansQuoteCandidateEvidence.ts";

const existingVideo = {
  media_type: "video",
  media_permalink: "https://x.com/creator/status/1/video/1",
  media_count: 1,
  quote_visual_ready: true,
  media_permalink_validation_status: "verified_video_permalink",
  media_permalink_verified_at: "2026-09-18T00:00:00.000Z",
  visual_score: 100,
  has_image: false,
  has_video: true,
};

const refreshedWithoutMedia = mergePersistedQuoteMediaEvidence(existingVideo, {
  media_type: "none",
  media_permalink: null,
  media_count: 0,
  quote_visual_ready: false,
  media_permalink_validation_status: "not_media",
  media_permalink_verified_at: null,
  visual_score: 0,
  has_image: false,
  has_video: false,
});
assert.deepEqual(refreshedWithoutMedia, existingVideo);

const strongerIncomingImage = mergePersistedQuoteMediaEvidence(existingVideo, {
  media_type: "image",
  media_permalink: "https://x.com/creator/status/1/photo/1",
  media_count: 1,
  quote_visual_ready: true,
  media_permalink_validation_status: "verified_image_permalink",
  media_permalink_verified_at: "2026-09-19T00:00:00.000Z",
  visual_score: 85,
  has_image: true,
  has_video: false,
});
assert.equal(strongerIncomingImage.media_type, "image");
assert.equal(strongerIncomingImage.media_permalink, "https://x.com/creator/status/1/photo/1");
