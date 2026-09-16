import { describe, expect, it } from "vitest";
import {
  FxInstrumentSchema,
  getRuntimeStatus,
  RuntimeStatusSchema,
  OANDA_PRACTICE_ENDPOINTS,
} from "../src/runtime.js";
import { FxCapitalRequestSchema, FxSignalSchema, FxWebhookSchema } from "../src/schemas/index.js";

describe("runtime safety contract", () => {
  it.each([undefined, "RESEARCH", "SHADOW", "OANDA_PRACTICE", "LIVE_LOCKED"])(
    "never arms mode %s",
    (mode) => {
      expect(RuntimeStatusSchema.parse(getRuntimeStatus(mode))).toMatchObject({
        operationalState: "PAUSED",
        executionEnabled: false,
        liveEnabled: false,
        brokerConnected: false,
      });
    },
  );

  it.each(["live", "paper", "LIVE", "OANDA_LIVE", "", "research", "unknown"])(
    "locks invalid mode %s",
    (mode) => {
      expect(getRuntimeStatus(mode)).toMatchObject({
        mode: "LIVE_LOCKED",
        configurationValid: false,
        executionEnabled: false,
      });
    },
  );

  it("defines a UK weekend review and only practice endpoints", () => {
    expect(getRuntimeStatus().weeklyReview).toEqual({
      day: "Saturday",
      time: "09:00",
      timezone: "Europe/London",
    });
    expect(Object.values(OANDA_PRACTICE_ENDPOINTS)).toEqual([
      "https://api-fxpractice.oanda.com",
      "https://stream-fxpractice.oanda.com",
    ]);
  });
});

describe("FX ingress", () => {
  it.each(["EUR/USD", "EURUSD", "EUR_USD"])("canonicalises the explicit alias %s", (alias) => {
    expect(FxInstrumentSchema.parse(alias)).toBe("EUR_USD");
  });
  it.each([
    "BTC_USD",
    "XAU_USD",
    "AAPL",
    "EUR_GBP",
    "EUR-USD",
    "eurusd",
    "OANDA:EURUSD",
    "EUR_USD/../orders",
    "toString",
    "__proto__",
  ])("rejects %s", (instrument) => {
    expect(FxInstrumentSchema.safeParse(instrument).success).toBe(false);
  });
  it("rejects an FX-looking instrument labelled crypto at every ingress", () => {
    const common = {
      assetClass: "crypto",
      instrument: "EUR_USD",
      timestamp: new Date().toISOString(),
    };
    expect(
      FxSignalSchema.safeParse({
        ...common,
        signalId: crypto.randomUUID(),
        agentId: "test",
        source: "internal",
        direction: "long",
        confidence: 0.7,
        stopLoss: 1,
        takeProfit: 1.2,
        holdingTimeMinutes: 60,
        justification: "test",
        currentPrice: 1.1,
      }).success,
    ).toBe(false);
    expect(
      FxCapitalRequestSchema.safeParse({ ...common, decisionId: crypto.randomUUID(), amount: 10 })
        .success,
    ).toBe(false);
    expect(
      FxWebhookSchema.safeParse({
        assetClass: "crypto",
        ticker: "EUR_USD",
        secret: "test",
        action: "buy",
        price: 1.1,
        stopLoss: 1,
        takeProfit: 1.2,
      }).success,
    ).toBe(false);
  });
});
