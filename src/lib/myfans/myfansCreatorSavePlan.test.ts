import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansCreatorSavePlan, type MyfansCreatorSaveRecord } from "./myfansCreatorSavePlan.ts";

const record: MyfansCreatorSaveRecord = {
  display_name: "creator",
  myfans_url: "https://myfans.jp/creator/1",
  creator_x_url: "https://x.com/incoming",
  genre: "genre",
  activity_note: "note",
  x_url_source: "manual",
};

test("new creators insert normalized X identity fields", () => {
  assert.deepEqual(buildMyfansCreatorSavePlan({
    record,
    existing: null,
    existingXUrl: "",
    creatorXUrl: "https://x.com/incoming",
    sourceXHandle: "@incoming",
  }), {
    kind: "insert",
    record: { ...record, creator_x_url: "https://x.com/incoming", source_x_handle: "@incoming" },
  });
});

test("a conflicting X profile keeps the stored URL and returns its audit facts", () => {
  assert.deepEqual(buildMyfansCreatorSavePlan({
    record,
    existing: { id: 7, creator_x_url: "https://x.com/stored", source_x_handle: "@stored" },
    existingXUrl: "https://x.com/stored",
    creatorXUrl: "https://x.com/incoming",
    sourceXHandle: "@incoming",
  }), {
    kind: "x_url_conflict",
    creatorId: 7,
    source: "manual",
    existingXUrl: "https://x.com/stored",
    incomingXUrl: "https://x.com/incoming",
    displayName: "creator",
    genre: "genre",
    activityNote: "note X URL不一致のため既存URLを維持。",
  });
});

test("existing identity is preserved, while a newly added X profile is propagated to products", () => {
  const keepStored = buildMyfansCreatorSavePlan({
    record,
    existing: { id: 9, creator_x_url: "https://x.com/stored", source_x_handle: "@stored" },
    existingXUrl: "https://x.com/stored",
    creatorXUrl: "https://x.com/stored",
    sourceXHandle: "@stored",
  });
  assert.equal(keepStored.kind, "update");
  if (keepStored.kind === "update") {
    assert.equal(keepStored.record.creator_x_url, "https://x.com/stored");
    assert.equal(keepStored.record.source_x_handle, "@stored");
    assert.equal(keepStored.record.x_url_source, undefined);
    assert.equal(keepStored.syncProductsCreatorXUrl, null);
  }

  const addNew = buildMyfansCreatorSavePlan({
    record,
    existing: { id: 10, creator_x_url: null, source_x_handle: null },
    existingXUrl: "",
    creatorXUrl: "https://x.com/incoming",
    sourceXHandle: "@incoming",
  });
  assert.equal(addNew.kind, "update");
  if (addNew.kind === "update") {
    assert.equal(addNew.record.creator_x_url, "https://x.com/incoming");
    assert.equal(addNew.record.source_x_handle, "@incoming");
    assert.equal(addNew.syncProductsCreatorXUrl, "https://x.com/incoming");
  }
});

test("X profile comparison remains case-insensitive and preserves the stored value", () => {
  const plan = buildMyfansCreatorSavePlan({
    record,
    existing: { id: 11, creator_x_url: "https://x.com/Stored", source_x_handle: "@stored" },
    existingXUrl: "https://x.com/Stored",
    creatorXUrl: "https://x.com/stored",
    sourceXHandle: "@incoming",
  });

  assert.equal(plan.kind, "update");
  if (plan.kind === "update") {
    assert.equal(plan.record.creator_x_url, "https://x.com/Stored");
    assert.equal(plan.record.source_x_handle, "@stored");
    assert.equal(plan.syncProductsCreatorXUrl, null);
  }
});
