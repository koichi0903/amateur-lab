import assert from "node:assert/strict";
import test from "node:test";
import { parsePpm } from "./xVideoPpm";

test("parses P6 comments and preserves pixel color, brightness, histogram, and detail metrics", () => {
  const header = Buffer.from("P6\n# fixture\n2 1\n255\n", "ascii");
  const pixels = Buffer.from([255, 0, 0, 0, 0, 255]);
  const result = parsePpm(Buffer.concat([header, pixels]));

  assert.equal(result.red, 0.5);
  assert.equal(result.green, 0);
  assert.equal(result.blue, 0.5);
  assert.ok(Math.abs(result.brightness - 0.1424) < 1e-12);
  assert.deepEqual(result.histogram, [0.5, 0.5, 0, 0, 0, 0, 0, 0]);
  assert.ok(Math.abs(result.detail - 0.1404) < 1e-12);
  assert.ok(Math.abs(result.colorVariance - 0.00492804) < 1e-12);
});

test("rejects non-binary PPM output", () => {
  assert.throws(() => parsePpm(Buffer.from("P3\n1 1\n255\n0 0 0", "ascii")), /ffmpeg did not return PPM/);
});

test("reads CRLF header separators without treating them as pixel bytes", () => {
  const header = Buffer.from("P6\r\n1 1\r\n255\r\n", "ascii");
  const pixels = Buffer.from([12, 34, 56]);
  const result = parsePpm(Buffer.concat([header, pixels]));

  assert.equal(result.red, 12 / 255);
  assert.equal(result.green, 34 / 255);
  assert.equal(result.blue, 56 / 255);
});

test("consumes the LF header delimiter but preserves whitespace-valued first pixel bytes", () => {
  const header = Buffer.from("P6\n1 1\n255\n", "ascii");
  const result = parsePpm(Buffer.concat([header, Buffer.from([10, 20, 30])]));

  assert.equal(result.red, 10 / 255);
  assert.equal(result.green, 20 / 255);
  assert.equal(result.blue, 30 / 255);
});

test("rejects incomplete headers and pixel data", () => {
  assert.throws(() => parsePpm(Buffer.from("P6\n# no line ending", "ascii")), /ffmpeg did not return PPM/);
  assert.throws(() => parsePpm(Buffer.from("P6\n2 1\n255\n\x01\x02\x03", "binary")), /ffmpeg did not return PPM/);
});
