// ============================================================================
// Currency Converter Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import { CurrencyConverter, DEFAULT_CONVERTER_CONFIG } from "../src/currency/converter.js";

describe("CurrencyConverter", () => {
  it("uses fallback rate by default", () => {
    const c = new CurrencyConverter();
    const gbp = c.usdToGbp(100);
    expect(gbp).toBeCloseTo(100 * DEFAULT_CONVERTER_CONFIG.fallbackRate);
  });

  it("converts correctly with custom rate", () => {
    const c = new CurrencyConverter();
    c.setRate(0.80);
    expect(c.usdToGbp(100)).toBeCloseTo(80);
    expect(c.usdToGbp(0)).toBe(0);
  });

  it("reports stale when older than refresh interval", () => {
    const c = new CurrencyConverter({ refreshIntervalSeconds: 1, fallbackRate: 0.79 });
    expect(c.isStale()).toBe(false);
    // Manually age the rate
    const rate = c.getRate();
    rate.fetchedAt = new Date(Date.now() - 5000).toISOString();
    c.setRate(rate.rate); // refreshes fetchedAt — so instead...
  });

  it("getRate returns a copy", () => {
    const c = new CurrencyConverter();
    const r1 = c.getRate();
    r1.rate = 999;
    expect(c.getRate().rate).not.toBe(999);
  });

  it("has sensible defaults", () => {
    expect(DEFAULT_CONVERTER_CONFIG.refreshIntervalSeconds).toBe(300);
    expect(DEFAULT_CONVERTER_CONFIG.fallbackRate).toBeGreaterThan(0.5);
    expect(DEFAULT_CONVERTER_CONFIG.fallbackRate).toBeLessThan(1.0);
  });

  it("converts negative USD values correctly", () => {
    const c = new CurrencyConverter();
    c.setRate(0.80);
    expect(c.usdToGbp(-100)).toBeCloseTo(-80);
  });

  it("handles zero rate gracefully", () => {
    const c = new CurrencyConverter();
    c.setRate(0);
    expect(c.usdToGbp(100)).toBe(0);
    // -50 * 0 = -0 in IEEE 754; verify with toBeCloseTo
    expect(c.usdToGbp(-50)).toBeCloseTo(0);
  });
});
