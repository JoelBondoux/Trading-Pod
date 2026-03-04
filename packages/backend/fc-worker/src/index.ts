// ============================================================================
// FC Worker — Financial Controller Cloudflare Worker
// ============================================================================
// Receives agent signals, runs FC logic, calls Treasurer, emits decisions.
// Routes:
//   POST /signals       — Receive agent signal(s)     [internal auth]
//   GET  /decisions/:id — Fetch a specific decision    [internal auth]
//   GET  /decisions     — List recent decisions        [internal auth]
//   GET  /state/paused  — Check if trading is paused   [internal auth]
//   PUT  /state/paused  — Toggle trading pause          [internal auth]
//   PUT  /state/freeze  — Freeze/unfreeze an agent      [internal auth]
// ============================================================================

import { AgentSignalSchema } from "@trading-pod/shared";
import type { AgentSignal } from "@trading-pod/shared";
import { validateInternalRequest, forbidden, internalError } from "@trading-pod/shared";

export interface Env {
  TRADE_DB: D1Database;
  CONFIG_KV: KVNamespace;
  TREASURER_SERVICE: Fetcher;
  EVENT_STREAM_SERVICE: Fetcher;
  INTERNAL_SERVICE_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check — public (no sensitive data)
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", worker: "fc" });
    }

    // All other endpoints require internal auth
    if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) {
      return forbidden();
    }

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

      // GET /state/paused — Check trading pause state
      if (request.method === "GET" && url.pathname === "/state/paused") {
        const paused = (await env.CONFIG_KV.get("state:trading_paused")) === "true";
        return Response.json({ paused });
      }

      // PUT /state/paused — Toggle trading pause (server-side)
      if (request.method === "PUT" && url.pathname === "/state/paused") {
        const body = (await request.json()) as { paused: boolean };
        await env.CONFIG_KV.put("state:trading_paused", String(!!body.paused));
        return Response.json({ paused: !!body.paused });
      }

      // PUT /state/freeze — Freeze/unfreeze an agent (server-side)
      if (request.method === "PUT" && url.pathname === "/state/freeze") {
        const body = (await request.json()) as { agentId: string; frozen: boolean };
        const frozenRaw = await env.CONFIG_KV.get("state:frozen_agents");
        const frozenSet: string[] = frozenRaw ? JSON.parse(frozenRaw) : [];
        const set = new Set(frozenSet);
        if (body.frozen) set.add(body.agentId);
        else set.delete(body.agentId);
        await env.CONFIG_KV.put("state:frozen_agents", JSON.stringify([...set]));
        return Response.json({ agentId: body.agentId, frozen: body.frozen });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return internalError(error);
    }
  },
} satisfies ExportedHandler<Env>;

// ============================================================================
// Handlers
// ============================================================================

async function handleSignals(request: Request, env: Env): Promise<Response> {
  // Check server-side pause flag
  const paused = (await env.CONFIG_KV.get("state:trading_paused")) === "true";
  if (paused) {
    return Response.json(
      { error: "Trading is paused", paused: true },
      { status: 503 }
    );
  }

  const body = await request.json();

  // Accept single signal or array
  const rawSignals = Array.isArray(body) ? body : [body];

  // Validate each signal
  const signals: AgentSignal[] = [];
  const errors: string[] = [];

  // Load frozen agent list
  const frozenRaw = await env.CONFIG_KV.get("state:frozen_agents");
  const frozenAgents: Set<string> = new Set(frozenRaw ? JSON.parse(frozenRaw) : []);

  for (const raw of rawSignals) {
    const result = AgentSignalSchema.safeParse(raw);
    if (result.success) {
      // Skip signals from frozen agents
      if (frozenAgents.has(result.data.agentId)) {
        errors.push(`Agent ${result.data.agentId} is frozen — signal ignored`);
        continue;
      }
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
