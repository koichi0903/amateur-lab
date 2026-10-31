import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "./proxy.ts";

const mutableEnv = process.env as Record<string, string | undefined>;

function request(
  pathname: string,
  host = "127.0.0.1",
  method = "GET",
) {
  return new NextRequest(`http://${host}${pathname}`, { method });
}

test("allows the local production update runner health checks", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  delete mutableEnv.ADMIN_USERNAME;
  delete mutableEnv.ADMIN_PASSWORD;
  mutableEnv.NODE_ENV = "production";

  try {
    const serverHealth = await proxy(request("/api/admin/server-health"));
    const browserHealth = await proxy(request("/api/admin/browser-health"));

    assert.equal(serverHealth.headers.get("x-middleware-next"), "1");
    assert.equal(browserHealth.headers.get("x-middleware-next"), "1");
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
  }
});

test("allows public amateur genre API without admin authentication", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  delete mutableEnv.ADMIN_USERNAME;
  delete mutableEnv.ADMIN_PASSWORD;
  mutableEnv.NODE_ENV = "production";

  try {
    const response = await proxy(request("/api/amateur", "example.com"));

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("www-authenticate"), null);
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalAdminUsername === undefined) delete mutableEnv.ADMIN_USERNAME;
    else mutableEnv.ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminPassword === undefined) delete mutableEnv.ADMIN_PASSWORD;
    else mutableEnv.ADMIN_PASSWORD = originalAdminPassword;
  }
});

test("does not bypass unrelated admin authentication in local production mode", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  delete mutableEnv.ADMIN_USERNAME;
  delete mutableEnv.ADMIN_PASSWORD;
  mutableEnv.NODE_ENV = "production";

  try {
    const response = await proxy(request("/api/admin/sensitive-operation"));

    assert.equal(response.status, 503);
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
  }
});

test("does not allow the local update runner from a non-loopback host", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  delete mutableEnv.ADMIN_USERNAME;
  delete mutableEnv.ADMIN_PASSWORD;
  mutableEnv.NODE_ENV = "production";

  try {
    const response = await proxy(request("/api/admin/server-health", "example.com"));

    assert.equal(response.status, 503);
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
  }
});

test("allows only loopback POSTs for scheduled catalog updates", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  delete mutableEnv.ADMIN_USERNAME;
  delete mutableEnv.ADMIN_PASSWORD;
  mutableEnv.NODE_ENV = "production";

  try {
    const localPost = await proxy(
      request("/api/admin/fanza-amateur-api-catalog", "127.0.0.1", "POST"),
    );
    const localGet = await proxy(
      request("/api/admin/fanza-amateur-api-catalog", "127.0.0.1", "GET"),
    );
    const remotePost = await proxy(
      request("/api/admin/fanza-amateur-api-catalog", "example.com", "POST"),
    );

    assert.equal(localPost.headers.get("x-middleware-next"), "1");
    assert.equal(localGet.status, 503);
    assert.equal(remotePost.status, 503);
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalAdminUsername === undefined) delete mutableEnv.ADMIN_USERNAME;
    else mutableEnv.ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminPassword === undefined) delete mutableEnv.ADMIN_PASSWORD;
    else mutableEnv.ADMIN_PASSWORD = originalAdminPassword;
  }
});
