// ============================================================================
// Treasurer Worker — Capital gating Cloudflare Worker
// ============================================================================
// Routes:
//   POST /capital/request — Request capital allocation [internal auth]
//   POST /capital/return  — Return capital after trade closes [internal auth]
//   GET  /state           — Get current Treasurer state [internal auth]
// ============================================================================

import { FxCapitalRequestSchema, FxCapitalReturnSchema } from "@trading-pod/shared";
import { validateInternalRequest, forbidden, internalError } from "@trading-pod/shared";

export interface Env {
  TRADE_DB: D1Database;
  INTERNAL_SERVICE_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check — public (no sensitive data)
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", worker: "treasurer" });
    }

    // All other endpoints require internal auth
    if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) {
      return forbidden();
    }

    try {
      if (request.method === "POST" && url.pathname === "/capital/request") {
        return await handleCapitalRequest(request, env);
      }

      if (request.method === "POST" && url.pathname === "/capital/return") {
        return await handleCapitalReturn(request, env);
      }

      if (request.method === "GET" && url.pathname === "/state") {
        return await getState(env);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return internalError(error);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleCapitalRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const result = FxCapitalRequestSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Invalid request", details: result.error.message },
      { status: 400 },
    );
  }

  // The future executor must reserve aggregate risk transactionally.
  // This legacy worker records the attempt and grants no capital.
  await env.TRADE_DB.prepare("INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)")
    .bind("treasurer:capital_requested", JSON.stringify(result.data))
    .run();

  return Response.json(
    {
      approved: false,
      allocatedAmount: 0,
      dailyRemaining: 0,
      timestamp: new Date().toISOString(),
      rejectionReason: "Execution locked: durable risk reservations are not implemented.",
    },
    { status: 503 },
  );
}

async function handleCapitalReturn(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const result = FxCapitalReturnSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Invalid request", details: result.error.message },
      { status: 400 },
    );
  }

  // Closure and realised P&L must come from reconciled broker transactions.
  // Record only the attempted request until that ledger exists.

  await env.TRADE_DB.prepare("INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)")
    .bind("treasurer:capital_return_attempted", JSON.stringify(result.data))
    .run();

  return Response.json(
    {
      processed: false,
      message: "Capital return recorded as an attempt only. Ledger processing is not implemented.",
    },
    { status: 503 },
  );
}

async function getState(env: Env): Promise<Response> {
  const state = await env.TRADE_DB.prepare("SELECT * FROM treasurer_state WHERE id = 1").first();

  if (!state) {
    return Response.json({
      message: "No Treasurer state initialised. Run D1 schema migration first.",
    });
  }

  return Response.json(state);
}
