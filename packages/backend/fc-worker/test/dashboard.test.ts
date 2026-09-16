import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWTPayload } from "jose";
import { createDashboardHandler } from "../src/dashboard.js";
import type { DashboardEnv } from "../src/dashboard.js";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let handle: ReturnType<typeof createDashboardHandler>;
const env: DashboardEnv = {
  GOOGLE_CLIENT_ID: "test-client",
  DASHBOARD_ALLOWED_SUBJECTS: "approved-subject",
  DASHBOARD_ORIGIN: "https://dashboard.example",
  TRADING_MODE: "OANDA_PRACTICE",
};

beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  const publicKey = await exportJWK(keys.publicKey);
  handle = createDashboardHandler(
    createLocalJWKSet({ keys: [{ ...publicKey, kid: "test-key", alg: "RS256" }] }),
  );
});

async function token(overrides: JWTPayload = {}, signingKey = keys.privateKey) {
  const seconds = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: "test-client",
    sub: "approved-subject",
    iat: seconds,
    exp: seconds + 1800,
    email: "test@example.com",
    email_verified: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(signingKey);
}
function request(bearer?: string, path = "/dashboard/session", extra: RequestInit = {}) {
  return new Request("https://api.example" + path, {
    ...extra,
    headers: {
      Origin: env.DASHBOARD_ORIGIN!,
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      ...extra.headers,
    },
  });
}

describe("server-verified dashboard identity", () => {
  it("accepts a correctly signed, allowlisted subject and never returns the token", async () => {
    const signed = await token();
    const response = await handle(request(signed), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.DASHBOARD_ORIGIN);
    const body = await response.json();
    expect(body).toMatchObject({ subject: "approved-subject", email: "test@example.com" });
    expect(JSON.stringify(body)).not.toContain(signed);
  });
  it.each([
    { aud: "another-app" },
    { iss: "https://evil.example" },
    { exp: 1 },
    { exp: undefined },
    { iat: undefined },
    { sub: undefined },
    { iat: Math.floor(Date.now() / 1000) + 3600 },
  ])("rejects invalid mandatory claims %j", async (claims) => {
    expect((await handle(request(await token(claims)), env)).status).toBe(401);
  });
  it.each([{ sub: "unapproved" }, { email_verified: false }, { azp: "another-app" }])(
    "rejects unapproved identity %j",
    async (claims) => {
      expect((await handle(request(await token(claims)), env)).status).toBe(403);
    },
  );
  it("rejects a forged signature even with valid-looking claims", async () => {
    const attacker = await generateKeyPair("RS256");
    expect((await handle(request(await token({}, attacker.privateKey)), env)).status).toBe(401);
  });
  it("rejects an unsigned JWT", async () => {
    const unsigned = btoa('{"alg":"none"}') + "." + btoa('{"sub":"approved-subject"}') + ".";
    expect((await handle(request(unsigned), env)).status).toBe(401);
  });
  it("denies access if signing keys cannot be obtained", async () => {
    const unavailable = createDashboardHandler(async () => {
      throw new Error("JWKS unavailable");
    });
    expect((await unavailable(request(await token()), env)).status).toBe(401);
  });
  it.each(["GOOGLE_CLIENT_ID", "DASHBOARD_ALLOWED_SUBJECTS", "DASHBOARD_ORIGIN"])(
    "fails closed without %s",
    async (name) => {
      expect((await handle(request(await token()), { ...env, [name]: "" })).status).toBe(503);
    },
  );
  it("rejects cross-origin requests before verification", async () => {
    const response = await handle(
      request(await token(), undefined, { headers: { Origin: "https://evil.example" } }),
      env,
    );
    expect(response.status).toBe(403);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
  it("does not accept shared service secrets or query-string tokens", async () => {
    expect(
      (
        await handle(
          request(undefined, undefined, { headers: { "X-Internal-Secret": "old-secret" } }),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (await handle(request(undefined, "/dashboard/session?token=" + (await token())), env)).status,
    ).toBe(401);
  });
  it("supports same-origin GETs without Origin only with a verified bearer", async () => {
    const response = await handle(
      new Request("https://api.example/dashboard/session", {
        headers: { Authorization: "Bearer " + (await token()) },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect((await handle(new Request("https://api.example/dashboard/session"), env)).status).toBe(
      401,
    );
  });
  it.each(["*", "http://public.example", "https://dashboard.example/path"])(
    "rejects invalid origin configuration %s",
    async (origin) => {
      expect(
        (await handle(request(await token()), { ...env, DASHBOARD_ORIGIN: origin })).status,
      ).toBe(503);
    },
  );
  it("allows only the exact read-only CORS preflight", async () => {
    const response = await handle(
      request(undefined, "/dashboard/status", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization");
    expect(
      (
        await handle(
          request(undefined, "/dashboard/status", {
            method: "OPTIONS",
            headers: { "Access-Control-Request-Method": "PUT" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });
  it("does not grant write privileges to a valid identity", async () => {
    expect(
      (await handle(request(await token(), "/dashboard/status", { method: "PUT" }), env)).status,
    ).toBe(405);
    expect(
      (await handle(request(await token(), "/dashboard/state/paused", { method: "PUT" }), env))
        .status,
    ).toBe(404);
  });
  it("reports a locked practice environment after authentication", async () => {
    const response = await handle(request(await token(), "/dashboard/status"), env);
    expect(await response.json()).toMatchObject({
      mode: "OANDA_PRACTICE",
      executionEnabled: false,
      brokerConnected: false,
    });
  });
});
