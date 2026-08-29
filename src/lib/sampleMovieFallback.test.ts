import assert from "node:assert/strict";
import test from "node:test";
import {
  getSampleMovieFallbackCopy,
  isVrWork,
} from "./sampleMovieFallback.ts";

test("detects VR works from the title, genre, or series", () => {
  assert.equal(isVrWork({ title: "【VR】初めてのお泊まりデート" }), true);
  assert.equal(isVrWork({ genre: "ハイクオリティVR / VR専用" }), true);
  assert.equal(isVrWork({ series: "MOODYZ 8KVR" }), true);
});

test("does not classify an ordinary work as VR", () => {
  assert.equal(
    isVrWork({ title: "初めてのお泊まりデート", genre: "ドラマ" }),
    false,
  );
});

test("uses a non-committal label when official sample availability is unknown", () => {
  assert.deepEqual(
    getSampleMovieFallbackCopy({ title: "通常作品", genre: "ドラマ" }),
    {
      label: "FANZA公式で作品・サンプルを確認",
      note: "サンプル動画の提供状況は公式ページでご確認ください",
      deliveryMode: "official-page",
    },
  );
});
