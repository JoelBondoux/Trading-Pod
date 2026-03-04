// ============================================================================
// Tax Collector Tests — UK CGT reserve with cumulative + immediate modes
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { TaxCollector } from "../src/tax_collector/tax_collector.js";

// ---------------------------------------------------------------------------
// Cumulative threshold mode (useAnnualExempt = true, default)
// ---------------------------------------------------------------------------

describe("TaxCollector (cumulative threshold mode)", () => {
  let tc: TaxCollector;

  beforeEach(() => {
    tc = new TaxCollector(
      { reserveRate: 0.24, annualExemptAmount: 3000, useAnnualExempt: true },
      { totalGrossProfit: 0, totalReserved: 0, totalTrades: 0, annualExemptRemaining: 3000, useAnnualExempt: true }
    );
  });

  it("does not reserve tax for profits under £3,000", () => {
    const entry = tc.reserveFromProfit(1000, "exec-1");
    expect(entry).toBeNull();
    const state = tc.getState();
    expect(state.totalGrossProfit).toBe(1000);
    expect(state.annualExemptRemaining).toBe(2000);
    expect(state.totalReserved).toBe(0);
  });

  it("does not reserve tax exactly at £3,000", () => {
    tc.reserveFromProfit(2000, "exec-1");
    const entry = tc.reserveFromProfit(1000, "exec-2");
    expect(entry).toBeNull();
    expect(tc.getState().annualExemptRemaining).toBe(0);
    expect(tc.getState().totalReserved).toBe(0);
  });

  it("taxes only the overshoot portion that crosses £3,000", () => {
    tc.reserveFromProfit(2500, "exec-1"); // Within exempt
    const entry = tc.reserveFromProfit(1000, "exec-2"); // Total now £3,500
    // Taxable = £3,500 - £3,000 = £500
    expect(entry).not.toBeNull();
    expect(entry!.reservedAmount).toBeCloseTo(500 * 0.24); // £120
    expect(entry!.grossProfit).toBe(1000);
    expect(tc.getState().annualExemptRemaining).toBe(0);
  });

  it("taxes entire profit after threshold exceeded", () => {
    tc.reserveFromProfit(3000, "exec-1"); // Hits exactly at threshold
    const entry = tc.reserveFromProfit(500, "exec-2"); // Fully taxable
    expect(entry).not.toBeNull();
    expect(entry!.reservedAmount).toBeCloseTo(500 * 0.24); // £120
  });

  it("ignores zero or negative profits", () => {
    expect(tc.reserveFromProfit(0, "exec-1")).toBeNull();
    expect(tc.reserveFromProfit(-500, "exec-2")).toBeNull();
    expect(tc.getState().totalGrossProfit).toBe(0);
    expect(tc.getState().totalTrades).toBe(0);
  });

  it("accumulates reserve correctly over many trades", () => {
    // Build up past threshold
    tc.reserveFromProfit(3000, "exec-1"); // Within exempt
    tc.reserveFromProfit(1000, "exec-2"); // £1,000 taxable → £240
    tc.reserveFromProfit(2000, "exec-3"); // £2,000 taxable → £480
    const state = tc.getState();
    expect(state.totalReserved).toBeCloseTo(720); // 240 + 480
    expect(state.totalTrades).toBe(3);
    expect(state.totalGrossProfit).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// Immediate tax mode (useAnnualExempt = false)
// ---------------------------------------------------------------------------

describe("TaxCollector (immediate tax mode)", () => {
  let tc: TaxCollector;

  beforeEach(() => {
    tc = new TaxCollector(
      { reserveRate: 0.24, annualExemptAmount: 3000, useAnnualExempt: false },
      { totalGrossProfit: 0, totalReserved: 0, totalTrades: 0, annualExemptRemaining: 3000, useAnnualExempt: false }
    );
  });

  it("taxes every profitable trade regardless of exempt amount", () => {
    const entry = tc.reserveFromProfit(500, "exec-1");
    expect(entry).not.toBeNull();
    expect(entry!.reservedAmount).toBeCloseTo(500 * 0.24); // £120
  });

  it("taxes small profits", () => {
    const entry = tc.reserveFromProfit(10, "exec-1");
    expect(entry).not.toBeNull();
    expect(entry!.reservedAmount).toBeCloseTo(10 * 0.24);
  });

  it("accumulates over multiple trades", () => {
    tc.reserveFromProfit(100, "exec-1"); // 24
    tc.reserveFromProfit(200, "exec-2"); // 48
    tc.reserveFromProfit(300, "exec-3"); // 72
    const state = tc.getState();
    expect(state.totalReserved).toBeCloseTo(144);
    expect(state.totalTrades).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Reserve report
// ---------------------------------------------------------------------------

describe("TaxCollector report", () => {
  it("returns correct report in cumulative mode", () => {
    const tc = new TaxCollector(
      { reserveRate: 0.24, annualExemptAmount: 3000, useAnnualExempt: true },
      { totalGrossProfit: 0, totalReserved: 0, totalTrades: 0, annualExemptRemaining: 3000, useAnnualExempt: true }
    );
    tc.reserveFromProfit(5000, "exec-1"); // 5000 total, taxable = 2000, reserved = 480
    const report = tc.getReserveReport();
    expect(report.totalReserved).toBeCloseTo(480);
    expect(report.totalGrossProfit).toBe(5000);
    expect(report.totalTrades).toBe(1);
    expect(report.annualExemptRemaining).toBe(0);
    expect(report.annualExemptUsed).toBe(3000);
    expect(report.useAnnualExempt).toBe(true);
    expect(report.effectiveRate).toBe(0.24);
  });

  it("returns correct report in immediate mode", () => {
    const tc = new TaxCollector(
      { reserveRate: 0.24, annualExemptAmount: 3000, useAnnualExempt: false },
      { totalGrossProfit: 0, totalReserved: 0, totalTrades: 0, annualExemptRemaining: 3000, useAnnualExempt: false }
    );
    tc.reserveFromProfit(1000, "exec-1");
    const report = tc.getReserveReport();
    expect(report.totalReserved).toBeCloseTo(240);
    expect(report.annualExemptUsed).toBe(0); // Exempt not tracked in immediate mode
  });
});
