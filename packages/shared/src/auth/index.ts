// ============================================================================
// Authentication utilities for inter-service and dashboard auth
// ============================================================================
// Used by all Cloudflare Workers to validate requests.
//
// Secrets are stored via `wrangler secret put` — never in code or KV.
// ============================================================================

/**
 * Validate that an incoming request carries the correct inter-service secret.
 * Use this on all non-public endpoints (POST /signals, POST /capital/*, etc.)
 *
 * @returns true if authenticated, false otherwise.
 */
export function validateInternalRequest(
  request: Request,
  internalSecret: string | undefined
): boolean {
  if (!internalSecret) {
    console.error("INTERNAL_SERVICE_SECRET not configured — rejecting request");
    return false;
  }
  const provided = request.headers.get("X-Internal-Secret");
  if (!provided) return false;

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
  console.error("Internal error:", error);
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

// ---------------------------------------------------------------------------
// Timing-safe string comparison (prevents timing attacks on secrets)
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
