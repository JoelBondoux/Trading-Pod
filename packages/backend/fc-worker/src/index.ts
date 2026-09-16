import {
  FxSignalSchema,
  getRuntimeStatus,
  validateInternalRequest,
  forbidden,
  internalError,
} from "@trading-pod/shared";
import { handleDashboard } from "./dashboard.js";
import type { DashboardEnv } from "./dashboard.js";

export interface Env extends DashboardEnv {
  TRADE_DB: D1Database;
  CONFIG_KV: KVNamespace;
  TREASURER_SERVICE: Fetcher;
  EVENT_STREAM_SERVICE: Fetcher;
  INTERNAL_SERVICE_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const status = getRuntimeStatus(env.TRADING_MODE);
      return Response.json(
        { status: status.configurationValid ? "locked" : "misconfigured", worker: "fc", ...status },
        {
          status: status.configurationValid ? 200 : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    if (url.pathname.startsWith("/dashboard/")) return handleDashboard(request, env);
    if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) return forbidden();

    try {
      if (request.method === "POST" && url.pathname === "/signals") {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const signals = Array.isArray(body) ? body : [body];
        if (
          signals.length === 0 ||
          signals.length > 100 ||
          signals.some((signal) => !FxSignalSchema.safeParse(signal).success)
        ) {
          return Response.json({ error: "Invalid FX signal batch" }, { status: 400 });
        }
        // Never acknowledge a signal as processed while the pipeline is a stub.
        return Response.json(
          { accepted: false, ...getRuntimeStatus(env.TRADING_MODE) },
          { status: 503 },
        );
      }
      if (request.method === "GET" && url.pathname === "/state/paused") {
        return Response.json({ paused: true, ...getRuntimeStatus(env.TRADING_MODE) });
      }
      if (request.method === "PUT" && url.pathname === "/state/paused") {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("paused" in body) ||
          typeof body.paused !== "boolean"
        ) {
          return Response.json({ error: "paused must be a boolean" }, { status: 400 });
        }
        if (!body.paused) {
          return Response.json({ error: "Execution is locked", paused: true }, { status: 409 });
        }
        // Code-enforced lock: no eventually consistent KV value can resume trading.
        return Response.json({ paused: true });
      }
      if (
        request.method === "PUT" &&
        (url.pathname === "/state/freeze" || url.pathname === "/settings/broker-preferences")
      ) {
        return Response.json(
          { error: "Controls are unavailable during foundation development" },
          { status: 409 },
        );
      }
      if (request.method === "GET" && url.pathname.startsWith("/decisions/")) {
        const decisionId = url.pathname.slice("/decisions/".length);
        const result = await env.TRADE_DB.prepare(
          "SELECT * FROM fc_decisions WHERE decision_id = ?",
        )
          .bind(decisionId)
          .first();
        return result ? Response.json(result) : new Response("Decision not found", { status: 404 });
      }
      if (request.method === "GET" && url.pathname === "/decisions") {
        const limit = Number(url.searchParams.get("limit") ?? "20");
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
          return Response.json(
            { error: "limit must be an integer from 1 to 100" },
            { status: 400 },
          );
        }
        const results = await env.TRADE_DB.prepare(
          "SELECT * FROM fc_decisions ORDER BY created_at DESC LIMIT ?",
        )
          .bind(limit)
          .all();
        return Response.json(results.results);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return internalError(error);
    }
  },
} satisfies ExportedHandler<Env>;
