// ============================================================================
// Shared Utility Function Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  clamp,
  rewardRiskRatio,
  percentDiff,
  formatGBP,
  formatUSD,
} from "../src/utils/index.js";
import { getUKTaxYear } from "../src/types/tax.js";

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("works with equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("works with decimals", () => {
    expect(clamp(0.002, 0.005, 0.05)).toBe(0.005);
  });
});

// ---------------------------------------------------------------------------
// rewardRiskRatio
// ---------------------------------------------------------------------------

describe("rewardRiskRatio", () => {
  it("calculates RR for long trade", () => {
    // entry 100, SL 95, TP 115 → risk 5, reward 15 → RR 3
    expect(rewardRiskRatio(100, 95, 115, "long")).toBe(3);
  });

  it("calculates RR for short trade", () => {
    // entry 100, SL 105, TP 85 → risk 5, reward 15 → RR 3
    expect(rewardRiskRatio(100, 105, 85, "short")).toBe(3);
  });

  it("returns 0 when SL equals entry (zero risk)", () => {
    expect(rewardRiskRatio(100, 100, 110, "long")).toBe(0);
  });

  it("returns 0 when risk is negative (invalid SL placement)", () => {
    // Long with SL above entry
    expect(rewardRiskRatio(100, 105, 115, "long")).toBe(0);
  });

  it("handles fractional prices (FX)", () => {
    // GBP/USD: entry 1.3000, SL 1.2980, TP 1.3030
    const rr = rewardRiskRatio(1.3, 1.298, 1.303, "long");
    // risk = 0.002, reward = 0.003, RR = 1.5
    expect(rr).toBeCloseTo(1.5);
  });
});

// ---------------------------------------------------------------------------
// percentDiff
// ---------------------------------------------------------------------------

describe("percentDiff", () => {
  it("calculates percentage difference", () => {
    expect(percentDiff(100, 105)).toBeCloseTo(5);
  });

  it("returns absolute value regardless of direction", () => {
    expect(percentDiff(100, 95)).toBeCloseTo(5);
  });

  it("returns 0 for equal prices", () => {
    expect(percentDiff(100, 100)).toBe(0);
  });

  it("returns 0 when base price is 0", () => {
    expect(percentDiff(0, 100)).toBe(0);
  });

  it("handles small FX movements", () => {
    // 1.3000 → 1.2870 = 1%
    expect(percentDiff(1.3, 1.287)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// formatGBP / formatUSD
// ---------------------------------------------------------------------------

describe("formatGBP", () => {
  it("formats positive amount", () => {
    const result = formatGBP(1234.56);
    expect(result).toContain("1,234.56");
  });

  it("formats zero", () => {
    const result = formatGBP(0);
    expect(result).toContain("0.00");
  });
});

describe("formatUSD", () => {
  it("formats positive amount", () => {
    const result = formatUSD(999.99);
    expect(result).toContain("999.99");
  });
});

// ---------------------------------------------------------------------------
// getUKTaxYear
// ---------------------------------------------------------------------------

describe("getUKTaxYear", () => {
  it("returns correct tax year for 1 Jan 2026 → 2025/26", () => {
    expect(getUKTaxYear(new Date(2026, 0, 1))).toBe("2025/26");
  });

  it("returns correct tax year for 5 Apr 2026 → 2025/26", () => {
    expect(getUKTaxYear(new Date(2026, 3, 5))).toBe("2025/26");
  });

  it("returns correct tax year for 6 Apr 2026 → 2026/27", () => {
    expect(getUKTaxYear(new Date(2026, 3, 6))).toBe("2026/27");
  });

  it("returns correct tax year for 10 Apr 2026 → 2026/27", () => {
    expect(getUKTaxYear(new Date(2026, 3, 10))).toBe("2026/27");
  });

  it("returns correct tax year for 31 Dec 2025 → 2025/26", () => {
    expect(getUKTaxYear(new Date(2025, 11, 31))).toBe("2025/26");
  });
});
