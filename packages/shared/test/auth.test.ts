// ============================================================================
// Auth Tests — Internal service auth, dashboard token, error responses
// ============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { validateInternalRequest, forbidden, internalError } from "../src/auth/index.js";

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// validateInternalRequest
// ---------------------------------------------------------------------------

describe("validateInternalRequest", () => {
  it("returns true when header matches secret", () => {
    const req = new Request("https://api.example.com/signals", {
      headers: { "X-Internal-Secret": "my-secret-123" },
    });
    expect(validateInternalRequest(req, "my-secret-123")).toBe(true);
  });

  it("returns false when header does not match secret", () => {
    const req = new Request("https://api.example.com/signals", {
      headers: { "X-Internal-Secret": "wrong" },
    });
    expect(validateInternalRequest(req, "my-secret-123")).toBe(false);
  });

  it("returns false when header is missing", () => {
    const req = new Request("https://api.example.com/signals");
    expect(validateInternalRequest(req, "my-secret-123")).toBe(false);
  });

  it("returns false when secret is undefined (not configured)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const req = new Request("https://api.example.com/signals", {
      headers: { "X-Internal-Secret": "anything" },
    });
    expect(validateInternalRequest(req, undefined)).toBe(false);
  });

  it("returns false for different-length strings (timing-safe)", () => {
    const req = new Request("https://api.example.com/signals", {
      headers: { "X-Internal-Secret": "short" },
    });
    expect(validateInternalRequest(req, "much-longer-secret")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------

describe("forbidden", () => {
  it("returns a 403 response with 'Forbidden' body", async () => {
    const resp = forbidden();
    expect(resp.status).toBe(403);
    expect(await resp.text()).toBe("Forbidden");
  });
});

describe("internalError", () => {
  it("returns a 500 JSON response with generic error message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resp = internalError(new Error("DB connection failed"));
    expect(resp.status).toBe(500);

    const body = await resp.json();
    expect(body.error).toBe("Internal server error");
    // Must NOT leak the actual error message
    expect(JSON.stringify(body)).not.toContain("DB connection");
  });

  it("handles non-Error objects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resp = internalError("string error");
    expect(resp.status).toBe(500);
  });
});
