import assert from "node:assert/strict";
import test from "node:test";
import { parseAmateurXVideoRequest } from "./amateurXVideoRequest.ts";

test("amateur X video request keeps empty trim end and fractional bounds", () => {
  assert.deepEqual(parseAmateurXVideoRequest(new URLSearchParams("jobId=12")), {
    ok: true,
    value: { jobId: 12, trimStartSeconds: 0, trimEndSeconds: null },
  });
  assert.deepEqual(parseAmateurXVideoRequest(new URLSearchParams("jobId=12&trimStart=34.15&trimEnd=57.5")), {
    ok: true,
    value: { jobId: 12, trimStartSeconds: 34.15, trimEndSeconds: 57.5 },
  });
  assert.deepEqual(parseAmateurXVideoRequest(new URLSearchParams("jobId=12&trimEnd=%20")), {
    ok: true,
    value: { jobId: 12, trimStartSeconds: 0, trimEndSeconds: null },
  });
});

test("amateur X video request rejects unsafe ids and invalid trim ranges", () => {
  for (const query of [
    "jobId=0",
    "jobId=1.5",
    "jobId=9007199254740992",
    "jobId=1&trimStart=-0.1",
    "jobId=1&trimStart=600.1",
    "jobId=1&trimStart=8&trimEnd=8",
    "jobId=1&trimStart=8&trimEnd=7.9",
    "jobId=1&trimStart=8&trimEnd=NaN",
  ]) {
    assert.deepEqual(parseAmateurXVideoRequest(new URLSearchParams(query)), { ok: false }, query);
  }
});
