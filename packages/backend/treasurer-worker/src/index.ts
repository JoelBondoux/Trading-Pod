// ============================================================================
// Treasurer Worker — Capital gating Cloudflare Worker
// ============================================================================
// Routes:
//   POST /capital/request — Request capital allocation [internal auth]
//   POST /capital/return  — Return capital after trade closes [internal auth]
//   GET  /state           — Get current Treasurer state [internal auth]
// ============================================================================

import { CapitalRequestSchema, CapitalReturnSchema } from "@trading-pod/shared";
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
  const result = CapitalRequestSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid request", details: result.error.message }, { status: 400 });
  }

  // TODO: Implement full Treasurer capital request logic
  // 1. Load Treasurer state from D1
  // 2. Reset daily allocation if new day
  // 3. Check against daily ceiling and scale factor
  // 4. Allocate capital if approved
  // 5. Update state in D1

  // Placeholder: log to audit
  await env.TRADE_DB.prepare(
    "INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)"
  )
    .bind("treasurer:capital_requested", JSON.stringify(result.data))
    .run();

  return Response.json({
    approved: true,
    allocatedAmount: result.data.amount,
    dailyRemaining: 0,
    timestamp: new Date().toISOString(),
    message: "Placeholder response. Full Treasurer logic pending implementation.",
  });
}

async function handleCapitalReturn(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const result = CapitalReturnSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ error: "Invalid request", details: result.error.message }, { status: 400 });
  }

  // TODO: Implement full capital return logic
  // 1. Load Treasurer state
  // 2. Process return (split profit: 50% Treasurer, 50% Savings)
  // 3. If crypto and profitable → route through Tax Collector first
  // 4. Adjust scale factor
  // 5. Update state in D1

  await env.TRADE_DB.prepare(
    "INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)"
  )
    .bind("treasurer:capital_returned", JSON.stringify(result.data))
    .run();

  return Response.json({
    processed: true,
    message: "Capital return logged. Full processing pending implementation.",
  });
}

async function getState(env: Env): Promise<Response> {
  const state = await env.TRADE_DB.prepare(
    "SELECT * FROM treasurer_state WHERE id = 1"
  ).first();

  if (!state) {
    return Response.json({
      message: "No Treasurer state initialised. Run D1 schema migration first.",
    });
  }

  return Response.json(state);
}
