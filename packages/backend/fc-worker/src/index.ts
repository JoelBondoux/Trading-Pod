// ============================================================================
// FC Worker — Financial Controller Cloudflare Worker
// ============================================================================
// Receives agent signals, runs FC logic, calls Treasurer, emits decisions.
// Routes:
//   POST /signals       — Receive agent signal(s)
//   GET  /decisions/:id — Fetch a specific decision
//   GET  /decisions     — List recent decisions
// ============================================================================

import { AgentSignalSchema } from "@trading-pod/shared";
import type { AgentSignal } from "@trading-pod/shared";

export interface Env {
  TRADE_DB: D1Database;
  CONFIG_KV: KVNamespace;
  TREASURER_SERVICE: Fetcher;
  EVENT_STREAM_SERVICE: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      // POST /signals — Receive and process agent signals
      if (request.method === "POST" && url.pathname === "/signals") {
        return await handleSignals(request, env);
      }

      // GET /decisions/:id — Fetch specific decision
      if (request.method === "GET" && url.pathname.startsWith("/decisions/")) {
        const decisionId = url.pathname.split("/decisions/")[1];
        if (decisionId) {
          return await getDecision(decisionId, env);
        }
      }

      // GET /decisions — List recent decisions
      if (request.method === "GET" && url.pathname === "/decisions") {
        const limit = parseInt(url.searchParams.get("limit") ?? "20");
        return await listDecisions(limit, env);
      }

      // Health check
      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok", worker: "fc" });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("FC Worker error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Internal error" },
        { status: 500 }
      );
    }
  },
} satisfies ExportedHandler<Env>;

// ============================================================================
// Handlers
// ============================================================================

async function handleSignals(request: Request, env: Env): Promise<Response> {
  const body = await request.json();

  // Accept single signal or array
  const rawSignals = Array.isArray(body) ? body : [body];

  // Validate each signal
  const signals: AgentSignal[] = [];
  const errors: string[] = [];

  for (const raw of rawSignals) {
    const result = AgentSignalSchema.safeParse(raw);
    if (result.success) {
      signals.push(result.data);
    } else {
      errors.push(`Invalid signal: ${result.error.message}`);
    }
  }

  if (signals.length === 0) {
    return Response.json({ error: "No valid signals", details: errors }, { status: 400 });
  }

  // TODO: Implement full FC decision pipeline
  // 1. Load credibilities from D1
  // 2. Load risk config from KV
  // 3. Compute weighted consensus
  // 4. Run risk checks
  // 5. Request capital from Treasurer (via service binding)
  // 6. Store decision in D1
  // 7. Emit event to Event Stream (via service binding)

  // Placeholder: log signals to D1 audit log
  for (const signal of signals) {
    await env.TRADE_DB.prepare(
      "INSERT INTO audit_log (event_type, payload_json) VALUES (?, ?)"
    )
      .bind("agent:signal", JSON.stringify(signal))
      .run();
  }

  return Response.json({
    received: signals.length,
    errors: errors.length > 0 ? errors : undefined,
    message: "Signals received and logged. FC decision pipeline pending implementation.",
  });
}

async function getDecision(decisionId: string, env: Env): Promise<Response> {
  const result = await env.TRADE_DB.prepare(
    "SELECT * FROM fc_decisions WHERE decision_id = ?"
  )
    .bind(decisionId)
    .first();

  if (!result) {
    return new Response("Decision not found", { status: 404 });
  }

  return Response.json(result);
}

async function listDecisions(limit: number, env: Env): Promise<Response> {
  const results = await env.TRADE_DB.prepare(
    "SELECT * FROM fc_decisions ORDER BY created_at DESC LIMIT ?"
  )
    .bind(Math.min(limit, 100))
    .all();

  return Response.json(results.results);
}
