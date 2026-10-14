import assert from "node:assert/strict";
import test from "node:test";
import { appendUniqueById, BIJYO_MANUAL_PAGE_SIZE, offsetPageBounds } from "./bijyoPagination.ts";

test("manual job pages use consecutive 20-row server offsets", () => {
  const first = offsetPageBounds(1, BIJYO_MANUAL_PAGE_SIZE);
  const second = offsetPageBounds(2, BIJYO_MANUAL_PAGE_SIZE);
  assert.deepEqual(first, { page: 1, offset: 0, limit: 20 });
  assert.deepEqual(second, { page: 2, offset: 20, limit: 20 });
});

test("manual job paging covers every row once, including the final partial page", () => {
  const ids = Array.from({ length: 45 }, (_, index) => index + 1);
  let loaded: Array<{ id: number }> = [];
  for (let page = 1; page <= 3; page += 1) {
    const { offset, limit } = offsetPageBounds(page, BIJYO_MANUAL_PAGE_SIZE);
    loaded = appendUniqueById(loaded, ids.slice(offset, offset + limit).map((id) => ({ id })));
  }
  assert.deepEqual(loaded.map(({ id }) => id), ids);
  assert.equal(new Set(loaded.map(({ id }) => id)).size, 45);
});

test("manual job pagination removes duplicate IDs at page boundaries", () => {
  assert.deepEqual(appendUniqueById([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]), [{ id: 1 }, { id: 2 }, { id: 3 }]);
});