import assert from "node:assert/strict";
import test from "node:test";
import { getBijyoReservedActionSuccessMessage, runBijyoReservedAction } from "./bijyoReservedActionHelpers.ts";

test("reserved action messages keep posted, skip, exclusion, and manual outcomes distinct", () => {
  assert.equal(getBijyoReservedActionSuccessMessage("posted", {}), "投稿済みにしました。X投稿URLを計測に紐付けました。");
  assert.equal(getBijyoReservedActionSuccessMessage("skip", {}), "スキップして候補を補充しました。");
  assert.equal(getBijyoReservedActionSuccessMessage("exclude", {}), "今後の候補から外しました。");
  assert.equal(getBijyoReservedActionSuccessMessage("manual", { trim: { ok: false, error: "ffmpeg failed" } }), "手動追加は完了しましたが、trim準備に失敗しました。動画ボタンから再生成できます。\nffmpeg failed");
  assert.equal(getBijyoReservedActionSuccessMessage("manual", { trim: { ok: true } }), "手動追加・trim準備が完了しました。画面を更新します。");
});

test("posting requires an X post URL and cancels without sending or reloading", async () => {
  let requestCount = 0;
  let reloadCount = 0;
  const messages: string[] = [];
  const busy: boolean[] = [];

  await runBijyoReservedAction({
    action: "posted",
    promptXPostUrl: () => "  ",
    request: async () => { requestCount += 1; return {}; },
    setBusy: (value) => { busy.push(value); },
    setMessage: (value) => { messages.push(value); },
    setActionBlocked: () => {},
    isAlreadySelected: () => false,
    reload: () => { reloadCount += 1; },
  });

  assert.equal(requestCount, 0);
  assert.equal(reloadCount, 0);
  assert.deepEqual(messages, ["", "計測に必要なX投稿URLがないため、投稿済み登録を中止しました。"]);
  assert.deepEqual(busy, [true, false]);
});

test("posted action forwards the X post URL and reloads after saving", async () => {
  let promptCount = 0;
  let request: [string, string | null] | null = null;
  let reloadCount = 0;
  const messages: string[] = [];

  await runBijyoReservedAction({
    action: "posted",
    promptXPostUrl: () => { promptCount += 1; return "https://x.com/example/status/12345"; },
    request: async (action, xPostUrl) => { request = [action, xPostUrl]; return {}; },
    setBusy: () => {},
    setMessage: (value) => { messages.push(value); },
    setActionBlocked: () => {},
    isAlreadySelected: () => false,
    reload: () => { reloadCount += 1; },
  });

  assert.equal(promptCount, 1);
  assert.deepEqual(request, ["posted", "https://x.com/example/status/12345"]);
  assert.equal(reloadCount, 1);
  assert.deepEqual(messages, ["", "投稿済みにしました。X投稿URLを計測に紐付けました。"]);
});

test("skip sends no prompt, saves, refreshes, and restores the idle state", async () => {
  const requests: Array<[string, string | null]> = [];
  let promptCount = 0;
  let reloadCount = 0;
  const messages: string[] = [];
  const busy: boolean[] = [];

  await runBijyoReservedAction({
    action: "skip",
    promptXPostUrl: () => { promptCount += 1; return null; },
    request: async (action, xPostUrl) => { requests.push([action, xPostUrl]); return {}; },
    setBusy: (value) => { busy.push(value); },
    setMessage: (value) => { messages.push(value); },
    setActionBlocked: () => {},
    isAlreadySelected: () => false,
    reload: () => { reloadCount += 1; },
  });

  assert.deepEqual(requests, [["skip", null]]);
  assert.equal(promptCount, 0);
  assert.equal(reloadCount, 1);
  assert.deepEqual(messages, ["", "スキップして候補を補充しました。"]);
  assert.deepEqual(busy, [true, false]);
});

test("already-selected action errors block duplicate work and remain visible", async () => {
  let actionBlocked = false;
  const messages: string[] = [];
  let reloadCount = 0;

  await runBijyoReservedAction({
    action: "manual",
    promptXPostUrl: () => null,
    request: async () => { throw new Error("already selected"); },
    setBusy: () => {},
    setMessage: (value) => { messages.push(value); },
    setActionBlocked: (value) => { actionBlocked = value; },
    isAlreadySelected: (error) => error instanceof Error && error.message === "already selected",
    reload: () => { reloadCount += 1; },
  });

  assert.equal(actionBlocked, true);
  assert.deepEqual(messages, ["", "already selected"]);
  assert.equal(reloadCount, 0);
});
