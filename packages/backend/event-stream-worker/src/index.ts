import { validateInternalRequest, forbidden } from "@trading-pod/shared";

export interface Env {
  EVENT_STREAM_DO: DurableObjectNamespace;
  INTERNAL_SERVICE_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") {
      return Response.json({ status: "locked", worker: "event-stream", streamingEnabled: false });
    }
    // Retire the shared token URL even when an old token is presented.
    if (path === "/ws") return streamDisabled();
    if (!validateInternalRequest(request, env.INTERNAL_SERVICE_SECRET)) return forbidden();
    if (path === "/broadcast") return streamDisabled();
    if (request.method === "GET" && path === "/status") {
      return Response.json({ connectedClients: 0, streamingEnabled: false });
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function streamDisabled(): Response {
  return Response.json({ error: "Dashboard streaming is not enabled" }, { status: 410 });
}

/** Retain the migrated Durable Object class while retiring old shared-token sockets. */
export class EventStreamDO implements DurableObject {
  constructor(ctx: DurableObjectState, _env: Env) {
    for (const ws of ctx.getWebSockets()) {
      try {
        ws.close(1008, "Legacy dashboard authentication retired");
      } catch {
        /* already closed */
      }
    }
  }

  async fetch(_request: Request): Promise<Response> {
    return streamDisabled();
  }
  webSocketMessage(ws: WebSocket, _message: string | ArrayBuffer): void {
    ws.close(1008, "Legacy dashboard authentication retired");
  }
  webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {}
  webSocketError(_ws: WebSocket, _error: unknown): void {}
}
