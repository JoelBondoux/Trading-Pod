// ============================================================================
// Shared Authentication — Inter-service + Dashboard token validation
// ============================================================================
// Every internal worker (FC, Treasurer, Savings, Event-Stream) MUST validate
// requests using one of these methods:
//
// 1. INTERNAL_SERVICE_SECRET — for worker-to-worker calls via service bindings
//    (sent as X-Internal-Secret header)
// 2. DASHBOARD_TOKEN — for dashboard WebSocket connections
//    (sent as ?token= query parameter)
//
// Secrets are stored via `wrangler secret put` — never in code or KV.
// ============================================================================

/**
 * Validate that an incoming request carries the correct inter-service secret.
 * Use this on all non-public endpoints (POST /signals, POST /capital/*, etc.)
 *
 * Returns true if authenticated, false otherwise.
 */
export function validateInternalRequest(
  request: Request,
  internalSecret: string | undefined
): boolean {
  if (!internalSecret) {
    // Secret not configured — block all requests as a safety default
    console.error("INTERNAL_SERVICE_SECRET not configured — rejecting request");
    return false;
  }
  const provided = request.headers.get("X-Internal-Secret");
  if (!provided) return false;

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(provided, internalSecret);
}

/**
 * Validate a dashboard WebSocket token (passed as ?token= query parameter).
 */
export function validateDashboardToken(
  request: Request,
  dashboardToken: string | undefined
): boolean {
  if (!dashboardToken) {
    console.error("DASHBOARD_TOKEN not configured — rejecting WebSocket");
    return false;
  }
  const url = new URL(request.url);
  const provided = url.searchParams.get("token");
  if (!provided) return false;

  return timingSafeEqual(provided, dashboardToken);
}

/**
 * Create a 403 Forbidden response with generic message.
 * Never expose why auth failed (missing header vs wrong value).
 */
export function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

/**
 * Create a sanitised 500 error response.
 * Never expose internal error details to callers.
 */
export function internalError(error: unknown): Response {
  // Log full error server-side for debugging
  console.error("Internal error:", error);
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// ---------------------------------------------------------------------------
// Timing-safe string comparison
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
