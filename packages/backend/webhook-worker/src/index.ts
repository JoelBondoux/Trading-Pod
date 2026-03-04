// ============================================================================
// Webhook Worker — TradingView webhook receiver
// ============================================================================
// Receives TradingView Pine Script alert webhooks, validates, and forwards
// to the FC Worker as an AgentSignal.
//
// Route: POST /webhook/tradingview
//
// Security:
// - Validates source IPs (TradingView's known egress IPs) — blocking by default
// - Validates shared secret in the payload body
// - Forwards to FC via service binding with INTERNAL_SERVICE_SECRET header
// - TradingView does NOT send auth headers, so we embed a secret in the JSON
//
// TradingView webhook constraints:
// - 3-second timeout (must respond quickly)
// - Ports 80/443 only
// - No retry on failure
// ============================================================================

import { TradingViewWebhookSchema } from "@trading-pod/shared";
import { internalError } from "@trading-pod/shared";

export interface Env {
  CONFIG_KV: KVNamespace;
  FC_SERVICE: Fetcher;
  INTERNAL_SERVICE_SECRET: string;
}

/** TradingView's known source IPs for webhook requests */
const TRADINGVIEW_IPS = new Set([
  "52.89.214.238",
  "34.212.75.30",
  "54.218.53.128",
  "52.32.178.7",
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/webhook/tradingview") {
        return await handleTradingViewWebhook(request, env);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok", worker: "webhook" });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return internalError(error);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleTradingViewWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Validate source IP — block by default unless allowlist is disabled in KV
  const sourceIp = request.headers.get("CF-Connecting-IP");
  const enforceIpAllowlist = (await env.CONFIG_KV.get("config:enforce_ip_allowlist")) !== "false";
  if (enforceIpAllowlist && sourceIp && !TRADINGVIEW_IPS.has(sourceIp)) {
    console.warn(`Blocked webhook from non-TradingView IP: ${sourceIp}`);
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse and validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = TradingViewWebhookSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Invalid webhook payload", details: result.error.message },
      { status: 400 }
    );
  }

  const payload = result.data;

  // 3. Validate shared secret
  const expectedSecret = await env.CONFIG_KV.get("config:webhook_secret");
  if (!expectedSecret || payload.secret !== expectedSecret) {
    return Response.json({ error: "Invalid secret" }, { status: 403 });
  }

  // 4. Transform to AgentSignal format
  const agentSignal = {
    signalId: crypto.randomUUID(),
    agentId: payload.agentId,
    source: "tradingview" as const,
    assetClass: payload.assetClass,
    instrument: payload.ticker,
    direction: payload.action === "buy" ? ("long" as const) : ("short" as const),
    confidence: payload.confidence,
    stopLoss: payload.stopLoss,
    takeProfit: payload.takeProfit,
    holdingTimeMinutes: payload.holdingTimeMinutes,
    justification: payload.justification,
    currentPrice: payload.price,
    timestamp: new Date().toISOString(),
  };

  // 5. Forward to FC Worker via service binding (with internal auth)
  try {
    const fcResponse = await env.FC_SERVICE.fetch(
      new Request("https://fc-internal/signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": env.INTERNAL_SERVICE_SECRET,
        },
        body: JSON.stringify(agentSignal),
      })
    );

    const fcResult = (await fcResponse.json()) as Record<string, unknown>;

    return Response.json({
      received: true,
      forwarded: fcResponse.ok,
      fcResponse: fcResult,
    });
  } catch (error) {
    // Still return 200 to TradingView (within 3s timeout)
    // Log the error for debugging
    console.error("Failed to forward to FC:", error);
    return Response.json({
      received: true,
      forwarded: false,
      error: "Failed to forward to FC worker",
    });
  }
}
