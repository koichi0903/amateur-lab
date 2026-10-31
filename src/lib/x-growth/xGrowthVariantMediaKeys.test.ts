import assert from "node:assert/strict";
import test from "node:test";
import type { XCreativeVariant } from "../xCreativeEngine.ts";
import { buildVariantMediaKeys } from "./xGrowthVariantMediaKeys.ts";

function genome(topic: string, hook: string): XCreativeVariant["creativeGenome"] {
  return {
    topic,
    intent: "REACH",
    hook,
    proof: "proof",
    structure: "structure",
    emotion: "curiosity",
    length: "short",
    media: "image",
    cta: "link",
    linkStrategy: "tracked",
    postingSlot: "night",
  };
}

test("image media keys retain ordered image, destination, body, and fingerprint identities", () => {
  assert.deepEqual(buildVariantMediaKeys({ workId: 42, imageUrl: " https://image.test/a.jpg " }, {
    mediaType: "existing_link_image",
    url: " https://product.test/work/42 ",
    bodyText: "本文",
    creativeGenome: genome("作品", "画像"),
  }), [
    "image_url:https://image.test/a.jpg",
    "destination_url:https://product.test/work/42",
    "body:本文",
    `fingerprint:${JSON.stringify(genome("作品", "画像"))}`,
  ]);
});

test("image variants fall back to the work identity when the image URL is blank", () => {
  assert.deepEqual(buildVariantMediaKeys({ workId: 7, imageUrl: "  " }, {
    mediaType: "data_card",
    url: "",
    bodyText: " ",
    creativeGenome: genome("", ""),
  }), [
    "work:7",
    `fingerprint:${JSON.stringify(genome("", ""))}`,
  ]);
});

test("sample movie keys include a valid asset id and trimmed source URL before common keys", () => {
  assert.deepEqual(buildVariantMediaKeys({
    workId: 9,
    mediaAsset: { id: 12 },
    sampleMovieUrl: " https://sample.test/movie.mp4 ",
  }, {
    mediaType: "sample_movie",
    url: "https://product.test/work/9",
    bodyText: "動画本文",
    creativeGenome: genome("動画", "冒頭"),
  }), [
    "media_asset:12",
    "sample_movie_url:https://sample.test/movie.mp4",
    "destination_url:https://product.test/work/9",
    "body:動画本文",
    `fingerprint:${JSON.stringify(genome("動画", "冒頭"))}`,
  ]);
});

test("sample movie key generation omits invalid assets and empty URLs", () => {
  assert.deepEqual(buildVariantMediaKeys({ workId: 9, mediaAsset: { id: 0 }, sampleMovieUrl: "  " }, {
    mediaType: "sample_movie",
    url: "",
    bodyText: "本文",
    creativeGenome: genome("動画", ""),
  }), [
    "body:本文",
    `fingerprint:${JSON.stringify(genome("動画", ""))}`,
  ]);
});
