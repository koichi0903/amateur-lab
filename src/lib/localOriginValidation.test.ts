import assert from "node:assert/strict";
import test from "node:test";
import { isLocalhost, isSameLocalOrigin, type LocalOriginValidationInput } from "./localOriginValidation";

function input(overrides: Partial<LocalOriginValidationInput> = {}): LocalOriginValidationInput {
  return {
    requestHostname: "localhost",
    host: "localhost:3000",
    requestProtocol: "http:",
    forwardedProtocol: null,
    origin: "http://localhost:3000",
    secFetchSite: "same-origin",
    ...overrides,
  };
}

test("accepts exact localhost origin and first forwarded protocol", () => {
  assert.equal(isSameLocalOrigin(input()), true);
  assert.equal(isSameLocalOrigin(input({
    requestProtocol: "http:",
    forwardedProtocol: "https, http",
    origin: "https://localhost:3000",
  })), true);
});

test("requires same-origin fetch metadata when the origin header is missing", () => {
  assert.equal(isSameLocalOrigin(input({ origin: null, secFetchSite: "same-origin" })), true);
  assert.equal(isSameLocalOrigin(input({ origin: null, secFetchSite: "cross-site" })), false);
});

test("rejects external, malformed, or mismatched local hosts and origins", () => {
  assert.equal(isSameLocalOrigin(input({ host: null })), false);
  assert.equal(isSameLocalOrigin(input({ requestHostname: "example.com" })), false);
  assert.equal(isSameLocalOrigin(input({ host: "example.com" })), false);
  assert.equal(isSameLocalOrigin(input({ host: "localhost:3001" })), false);
  assert.equal(isSameLocalOrigin(input({ origin: "http://localhost:3001" })), false);
  assert.equal(isSameLocalOrigin(input({ origin: "https://localhost:3000" })), false);
  assert.equal(isSameLocalOrigin(input({ origin: "not a URL" })), false);
  assert.equal(isSameLocalOrigin(input({ forwardedProtocol: "invalid" })), false);
});

test("recognizes only the supported loopback hostnames", () => {
  assert.equal(isLocalhost("LOCALHOST"), true);
  assert.equal(isLocalhost("127.0.0.1"), true);
  assert.equal(isLocalhost("::1"), true);
  assert.equal(isLocalhost("localhost.attacker.invalid"), false);
});
