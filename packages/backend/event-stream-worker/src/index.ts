// ============================================================================
// Event Stream Worker — WebSocket event broadcasting via Durable Objects
// ============================================================================
// Uses Hibernation API for efficient WebSocket management.
// Dashboard connects via WebSocket to receive real-time system events.
//
// Routes:
//   GET  /ws        — Upgrade to WebSocket      [dashboard token required]
//   POST /broadcast — Broadcast to all clients  [internal auth required]
//   GET  /health    — Health check              [public]
// ============================================================================

import { validateInternalRequest, validateDashboardToken, forbidden } from "@trading-pod/shared";

export interface Env {
  EVENT_STREAM_DO: DurableObjectNamespace;
  INTERNAL_SERVICE_SECRET: string;
  DASHBOARD_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check — public
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", worker: "event-stream" });
    }

    // WebSocket upgrade — requires dashboard token
    if (url.pathname === "/ws") {
      if (!validateDashboardToken(request, env.DASHBOARD_TOKEN)) {
        return forbidden();
      }
      const doId = env.EVENT_STREAM_DO.idFromName("main");
      const doStub = env.EVENT_STREAM_DO.get(doId);
      return doStub.fetch(request);
    }

    // Broadcast — requires internal service secret
    if (url.pathname === "/broadcast") {
      if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) {
        return forbidden();
      }
      const doId = env.EVENT_STREAM_DO.idFromName("main");
      const doStub = env.EVENT_STREAM_DO.get(doId);
      return doStub.fetch(request);
    }

    // Status — requires internal auth (exposes client count)
    if (url.pathname === "/status") {
      if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) {
        return forbidden();
      }
      const doId = env.EVENT_STREAM_DO.idFromName("main");
      const doStub = env.EVENT_STREAM_DO.get(doId);
      return doStub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ============================================================================
// Event Stream Durable Object — Manages WebSocket connections
// ============================================================================

export class EventStreamDO implements DurableObject {
  private ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: Env) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for dashboard clients
    if (url.pathname === "/ws") {
      return this.handleWebSocketUpgrade(request);
    }

    // Broadcast endpoint (called by other workers via service binding)
    if (request.method === "POST" && url.pathname === "/broadcast") {
      return this.handleBroadcast(request);
    }

    // Get connection count
    if (request.method === "GET" && url.pathname === "/status") {
      const sockets = this.ctx.getWebSockets();
      return Response.json({
        connectedClients: sockets.length,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Handle WebSocket upgrade using the Hibernation API.
   * acceptWebSocket() allows the DO to hibernate when idle,
   * saving compute costs while keeping clients connected.
   */
  private handleWebSocketUpgrade(_request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept with hibernation support
    this.ctx.acceptWebSocket(server);

    // Send welcome message
    server.send(
      JSON.stringify({
        type: "system:connected",
        timestamp: new Date().toISOString(),
        message: "Connected to Trading-Pod event stream",
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Broadcast an event to all connected WebSocket clients.
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    const event = await request.text();
    const sockets = this.ctx.getWebSockets();
    let sent = 0;

    for (const ws of sockets) {
      try {
        ws.send(event);
        sent++;
      } catch {
        // Client disconnected — will be cleaned up automatically
      }
    }

    return Response.json({ broadcast: true, clientsReached: sent });
  }

  // ============================================================================
  // Hibernation API handlers
  // ============================================================================

  /**
   * Called when a message is received from a connected client.
   * During hibernation, this wakes the DO.
   */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Dashboard clients may send ping/pong or control messages
    try {
      const data = JSON.parse(message as string) as { type?: string };

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  /**
   * Called when a client disconnects.
   */
  webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): void {
    // WebSocket automatically removed from getWebSockets() list
  }

  /**
   * Called on unexpected WebSocket error.
   */
  webSocketError(_ws: WebSocket, _error: unknown): void {
    // WebSocket automatically cleaned up
  }
}
