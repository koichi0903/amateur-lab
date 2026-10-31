import assert from "node:assert/strict";
import test from "node:test";
import { projectFanzaAmateurMp4AttemptCompletion } from "./fanzaAmateurMp4CompletionProjection";

test("a found movie is saved as found and clears the previous error", () => {
  assert.deepEqual(
    projectFanzaAmateurMp4AttemptCompletion({
      movieUrl: "https://sample.test/video.mp4",
      failure: "stale error",
      attemptCount: 1,
      checkedAt: "2026-10-31T12:00:00.000Z",
    }),
    {
      update: {
        mp4_url: "https://sample.test/video.mp4",
        mp4_status: "found",
        mp4_checked_at: "2026-10-31T12:00:00.000Z",
        mp4_last_error: null,
      },
      kind: "found",
    },
  );
});

test("a nonterminal miss keeps the item pending and records its failure", () => {
  assert.deepEqual(
    projectFanzaAmateurMp4AttemptCompletion({
      movieUrl: null,
      failure: "MP4リンク未検出（試行 2/3）",
      attemptCount: 2,
      checkedAt: "2026-10-31T12:00:00.000Z",
    }),
    {
      update: {
        mp4_url: null,
        mp4_status: "pending",
        mp4_checked_at: "2026-10-31T12:00:00.000Z",
        mp4_last_error: "MP4リンク未検出（試行 2/3）",
      },
      kind: "failed",
    },
  );
});

test("the third miss becomes terminal with the established user-facing reason", () => {
  assert.deepEqual(
    projectFanzaAmateurMp4AttemptCompletion({
      movieUrl: null,
      failure: "transport error",
      attemptCount: 3,
      checkedAt: "2026-10-31T12:00:00.000Z",
    }),
    {
      update: {
        mp4_url: null,
        mp4_status: "no_video",
        mp4_checked_at: "2026-10-31T12:00:00.000Z",
        mp4_last_error: "3回の取得試行でMP4リンクを確認できませんでした。",
      },
      kind: "no_video",
    },
  );
});
