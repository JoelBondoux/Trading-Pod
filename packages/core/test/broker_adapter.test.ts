// ============================================================================
// Broker Adapter Tests — Mock, factory, and asset-class routing
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  MockBrokerAdapter,
  IGBrokerAdapter,
  KrakenBrokerAdapter,
  createBrokerAdapter,
  selectBrokerForAsset,
} from "../src/execution_engine/broker_adapter.js";
import type { BrokerOrder } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<BrokerOrder> = {}): BrokerOrder {
  return {
    instrument: "GBP/USD",
    direction: "long",
    size: 1000,
    stopLoss: 1.25,
    takeProfit: 1.35,
    type: "market",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MockBrokerAdapter
// ---------------------------------------------------------------------------

describe("MockBrokerAdapter", () => {
  const adapter = new MockBrokerAdapter();

  it("has name 'mock'", () => {
    expect(adapter.name).toBe("mock");
  });

  it("placeOrder returns accepted response with fill details", async () => {
    const resp = await adapter.placeOrder(makeOrder());
    expect(resp.status).toBe("accepted");
    expect(resp.orderId).toMatch(/^mock-/);
    expect(resp.filledSize).toBe(1000);
    expect(resp.fees).toBe(0);
    expect(resp.filledPrice).toBeGreaterThan(0);
    expect(resp.timestamp).toBeTruthy();
  });

  it("placeOrder returns a limit price when type is limit", async () => {
    const resp = await adapter.placeOrder(
      makeOrder({ type: "limit", limitPrice: 1.31 })
    );
    expect(resp.status).toBe("accepted");
    // filledPrice will be based on limitPrice ± slippage
    expect(resp.filledPrice).toBeGreaterThan(0);
  });

  it("cancelOrder always returns true", async () => {
    expect(await adapter.cancelOrder("any-id")).toBe(true);
  });

  it("healthCheck always returns true", async () => {
    expect(await adapter.healthCheck()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IGBrokerAdapter (stub — not yet implemented)
// ---------------------------------------------------------------------------

describe("IGBrokerAdapter (stub)", () => {
  const adapter = new IGBrokerAdapter({
    apiKey: "test",
    username: "test",
    password: "test",
    demo: true,
  });

  it("has name 'ig'", () => {
    expect(adapter.name).toBe("ig");
  });

  it("placeOrder throws 'not yet implemented'", async () => {
    await expect(adapter.placeOrder(makeOrder())).rejects.toThrow(
      /not yet implemented/i
    );
  });

  it("cancelOrder throws 'not yet implemented'", async () => {
    await expect(adapter.cancelOrder("x")).rejects.toThrow(/not yet implemented/i);
  });

  it("healthCheck returns false", async () => {
    expect(await adapter.healthCheck()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// KrakenBrokerAdapter (stub — not yet implemented)
// ---------------------------------------------------------------------------

describe("KrakenBrokerAdapter (stub)", () => {
  const adapter = new KrakenBrokerAdapter({
    apiKey: "test",
    apiSecret: "test",
  });

  it("has name 'kraken'", () => {
    expect(adapter.name).toBe("kraken");
  });

  it("placeOrder throws 'not yet implemented'", async () => {
    await expect(adapter.placeOrder(makeOrder())).rejects.toThrow(
      /not yet implemented/i
    );
  });

  it("cancelOrder throws 'not yet implemented'", async () => {
    await expect(adapter.cancelOrder("x")).rejects.toThrow(/not yet implemented/i);
  });

  it("healthCheck returns false", async () => {
    expect(await adapter.healthCheck()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createBrokerAdapter factory
// ---------------------------------------------------------------------------

describe("createBrokerAdapter", () => {
  it("creates a MockBrokerAdapter for type 'mock'", () => {
    const a = createBrokerAdapter("mock");
    expect(a.name).toBe("mock");
    expect(a).toBeInstanceOf(MockBrokerAdapter);
  });

  it("creates an IGBrokerAdapter for type 'ig' with config", () => {
    const a = createBrokerAdapter("ig", {
      apiKey: "k",
      username: "u",
      password: "p",
      demo: true,
    });
    expect(a.name).toBe("ig");
    expect(a).toBeInstanceOf(IGBrokerAdapter);
  });

  it("throws when 'ig' is requested without config", () => {
    expect(() => createBrokerAdapter("ig")).toThrow("IG config required");
  });

  it("creates a KrakenBrokerAdapter for type 'kraken' with config", () => {
    const a = createBrokerAdapter("kraken", {
      apiKey: "k",
      apiSecret: "s",
    } as any);
    expect(a.name).toBe("kraken");
    expect(a).toBeInstanceOf(KrakenBrokerAdapter);
  });

  it("throws when 'kraken' is requested without config", () => {
    expect(() => createBrokerAdapter("kraken")).toThrow("Kraken config required");
  });

  it("throws for unknown adapter type", () => {
    expect(() => createBrokerAdapter("binance" as any)).toThrow(
      /Unknown broker adapter type/
    );
  });
});

// ---------------------------------------------------------------------------
// selectBrokerForAsset
// ---------------------------------------------------------------------------

describe("selectBrokerForAsset", () => {
  const adapters = {
    ig: new IGBrokerAdapter({ apiKey: "k", username: "u", password: "p", demo: true }),
    kraken: new KrakenBrokerAdapter({ apiKey: "k", apiSecret: "s" }),
    mock: new MockBrokerAdapter(),
  };

  it("paper mode always returns mock adapter regardless of asset class", () => {
    expect(selectBrokerForAsset("fx", adapters, "paper").name).toBe("mock");
    expect(selectBrokerForAsset("crypto", adapters, "paper").name).toBe("mock");
  });

  it("live mode routes fx to ig", () => {
    expect(selectBrokerForAsset("fx", adapters, "live").name).toBe("ig");
  });

  it("live mode routes crypto to kraken", () => {
    expect(selectBrokerForAsset("crypto", adapters, "live").name).toBe("kraken");
  });

  it("defaults to paper mode when mode is omitted", () => {
    expect(selectBrokerForAsset("fx", adapters).name).toBe("mock");
  });
});
