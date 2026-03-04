// ============================================================================
// News Filter Tests — Stub implementation
// ============================================================================

import { describe, it, expect } from "vitest";
import { NewsFilter, createNewsFilter } from "../src/context_providers/news_filter.js";

describe("NewsFilter.check", () => {
  const nf = new NewsFilter();

  it("returns block: false (stub always allows trading)", () => {
    const result = nf.check();
    expect(result.block).toBe(false);
  });

  it("includes a timestamp", () => {
    const result = nf.check();
    expect(result.timestamp).toBeTruthy();
    // Should be a valid ISO 8601 string
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it("createNewsFilter factory returns instance", () => {
    expect(createNewsFilter()).toBeInstanceOf(NewsFilter);
  });
});
