import assert from "node:assert/strict";
import { parseXPostUrl } from "./xPostUrl.ts";

const postId = "2108542780159263207";

assert.deepEqual(parseXPostUrl(`https://x.com/bijyo1010/status/${postId}`), {
  handle: "bijyo1010",
  id: postId,
});
assert.deepEqual(parseXPostUrl(`https://x.com/bijyo1005/status/${postId}?s=20`), {
  handle: "bijyo1005",
  id: postId,
});
assert.deepEqual(parseXPostUrl(`https://twitter.com/Other_User/status/${postId}/?s=20`), {
  handle: "other_user",
  id: postId,
});

for (const value of [
  "http://x.com/bijyo1005/status/2108542780159263207",
  "https://x.com.evil.example/bijyo1005/status/2108542780159263207",
  "https://x.com/bijyo1005/status/",
  "https://x.com/bijyo1005/status/not-a-number",
  "https://x.com/bijyo1005/status/12345",
  "https://x.com/this_handle_is_too_long/status/2108542780159263207",
  "https://user:pass@x.com/bijyo1005/status/2108542780159263207",
]) {
  assert.equal(parseXPostUrl(value), null, `expected invalid URL: ${value}`);
}
