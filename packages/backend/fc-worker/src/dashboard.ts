import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { getRuntimeStatus } from "@trading-pod/shared";

export interface DashboardEnv {
  GOOGLE_CLIENT_ID?: string;
  /** Comma-separated Google subject IDs, never a browser-side email allowlist. */
  DASHBOARD_ALLOWED_SUBJECTS?: string;
  /** One exact origin, including scheme and optional port. No wildcard CORS. */
  DASHBOARD_ORIGIN?: string;
  TRADING_MODE?: string;
}

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
  timeoutDuration: 5_000,
  cooldownDuration: 30_000,
});

/** Read-only boundary. There is deliberately no proxy to internal control routes. */
export function createDashboardHandler(keys: JWTVerifyGetKey = googleKeys) {
  return async (request: Request, env: DashboardEnv): Promise<Response> => {
    const origin = request.headers.get("Origin");
    const allowedSubjects = (env.DASHBOARD_ALLOWED_SUBJECTS ?? "")
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

    let originConfigured = false;
    try {
      const configured = new URL(env.DASHBOARD_ORIGIN ?? "");
      originConfigured =
        configured.origin === env.DASHBOARD_ORIGIN &&
        (configured.protocol === "https:" ||
          (configured.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(configured.hostname)));
    } catch {
      /* malformed configuration fails closed */
    }
    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.DASHBOARD_ORIGIN ||
      !originConfigured ||
      allowedSubjects.length === 0
    ) {
      return reply({ error: "Dashboard access is not configured" }, 503);
    }
    // Same-origin GETs and non-browser clients may omit Origin. Both still need
    // the bearer token; there are no ambient cookies or mutation endpoints.
    if (origin !== null && origin !== env.DASHBOARD_ORIGIN)
      return reply({ error: "Forbidden" }, 403);
    if (origin === env.DASHBOARD_ORIGIN)
      headers.set("Access-Control-Allow-Origin", env.DASHBOARD_ORIGIN);

    const path = new URL(request.url).pathname;
    if (path !== "/dashboard/session" && path !== "/dashboard/status") {
      return reply({ error: "Not found" }, 404);
    }
    if (request.method === "OPTIONS") {
      if (origin !== env.DASHBOARD_ORIGIN) return reply({ error: "Forbidden" }, 403);
      const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
        .toLowerCase()
        .split(",")
        .map((header) => header.trim())
        .filter(Boolean);
      if (
        request.headers.get("Access-Control-Request-Method") !== "GET" ||
        requestedHeaders.some((header) => header !== "authorization")
      ) {
        return reply({ error: "Forbidden" }, 403);
      }
      headers.set("Access-Control-Allow-Methods", "GET");
      headers.set("Access-Control-Allow-Headers", "Authorization");
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      headers.set("Allow", "GET, OPTIONS");
      return reply({ error: "Method not allowed" }, 405);
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match || match[1].length > 16_384) return reply({ error: "Unauthorized" }, 401);
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        audience: env.GOOGLE_CLIENT_ID,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        algorithms: ["RS256"],
        requiredClaims: ["sub", "iat", "exp", "email", "email_verified"],
        maxTokenAge: "1h",
      });
      if (
        !payload.sub ||
        !allowedSubjects.includes(payload.sub) ||
        payload.email_verified !== true ||
        typeof payload.email !== "string" ||
        (payload.azp !== undefined && payload.azp !== env.GOOGLE_CLIENT_ID)
      ) {
        return reply({ error: "Forbidden" }, 403);
      }
      if (path === "/dashboard/status") return reply(getRuntimeStatus(env.TRADING_MODE));
      return reply({
        subject: payload.sub,
        email: payload.email,
        name: typeof payload.name === "string" ? payload.name : payload.email,
        picture: typeof payload.picture === "string" ? payload.picture : "",
        expiresAt: payload.exp! * 1000,
      });
    } catch {
      // Never log bearer tokens, JWT payloads, or raw verification errors.
      return reply({ error: "Unauthorized" }, 401);
    }
  };
}

export const handleDashboard = createDashboardHandler();
