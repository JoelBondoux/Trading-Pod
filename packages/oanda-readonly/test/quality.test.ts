import { describe, expect, it } from "vitest";
import { assessExposure, assessPrices } from "../src/quality.js";
import { AccountResponseSchema, PricingResponseSchema, compareDecimal } from "../src/schemas.js";
import { bindingOf } from "../src/config.js";
import { account, config, pricing, observe } from "./fixtures.js";

describe("observable quote quality", () => {
  it("uses executable bid/ask liquidity, never closeout prices", () => {
    const data = pricing();
    data.prices[0].bids.unshift({ price: "2.00000", liquidity: 0 });
    const [result] = assessPrices(observe(PricingResponseSchema.parse(data)));
    expect(result).toMatchObject({ usableAtObservation: true, bestBid: "1.10001", bestAsk: "1.10013" });
  });
  it.each(["stale", "future", "halted", "noLiquidity", "crossed", "missingConversion", "staleEnvelope"])("records %s quotes as unusable", (kind) => {
    const data = pricing();
    if (kind === "stale") data.prices[0].time = "2026-09-16T09:59:00Z";
    if (kind === "future") data.prices[0].time = "2026-09-16T10:01:00Z";
    if (kind === "halted") data.prices[0].tradeable = false;
    if (kind === "noLiquidity") data.prices[0].asks = [];
    if (kind === "crossed") data.prices[0].bids[0].price = "1.10014";
    if (kind === "missingConversion") data.homeConversions = [];
    if (kind === "staleEnvelope") data.time = "2026-09-16T09:59:00Z";
    const [result] = assessPrices(observe(PricingResponseSchema.parse(data)));
    expect(result.usableAtObservation).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    if (kind === "noLiquidity") expect(result.bestAsk).toBeNull();
  });
  it("does not infer tradeability from the deprecated status", () => {
    const data = pricing(); data.prices[0].status = "non-tradeable";
    expect(assessPrices(observe(PricingResponseSchema.parse(data)))[0].reasons).toContain("NOT_TRADEABLE");
  });
  it("distinguishes decimal values that a JS float rounds together", () => {
    expect(compareDecimal("9007199254740993.00000001", "9007199254740993.00000002")).toBe(-1);
    expect(compareDecimal("-0.0001", "0")).toBe(-1);
    expect(compareDecimal("1.0000", "1")).toBe(0);
  });
});

describe("existing exposure", () => {
  it("ignores zero historical positions but flags hedged exposure on either side", () => {
    const data = AccountResponseSchema.parse(account()).account;
    data.positions = [{ instrument: "XAU_USD", long: { units: "0" }, short: { units: "0" } }];
    expect(assessExposure(data, bindingOf(config)).hasExistingExposure).toBe(false);
    data.positions[0].long.units = "10"; data.positions[0].short.units = "-10";
    expect(assessExposure(data, bindingOf(config))).toMatchObject({ hasExistingExposure: true, outsideUniverse: ["XAU_USD"] });
  });
  it("flags pending dependent orders without an instrument", () => {
    const data = AccountResponseSchema.parse(account()).account;
    data.orders = [{ id: "99", type: "STOP_LOSS", tradeID: "90" }];
    expect(assessExposure(data, bindingOf(config))).toMatchObject({ hasExistingExposure: true, ordersWithoutInstrument: 1 });
  });
});
