import assert from "node:assert/strict";
import {
  firstMyfansAnalyticsLoadError,
  ignoreUnavailableOptionalMyfansTable,
} from "./myfansAnalyticsLoadErrors";

const first = { message: "creator query failed" };
const later = { message: "post query failed" };

assert.equal(firstMyfansAnalyticsLoadError([null, undefined, first, later]), first);
assert.equal(firstMyfansAnalyticsLoadError([null, undefined]), null);

assert.equal(
  ignoreUnavailableOptionalMyfansTable({ message: "myfans_post_product_linkage_evidence missing" }),
  null,
);
assert.equal(
  ignoreUnavailableOptionalMyfansTable({ message: "myfans_permanent_candidate_exclusions missing" }),
  null,
);
assert.equal(
  ignoreUnavailableOptionalMyfansTable({ message: "Could not find the table in the schema cache" }),
  null,
);
assert.deepEqual(
  ignoreUnavailableOptionalMyfansTable({ message: "connection refused" }),
  { message: "connection refused" },
);
