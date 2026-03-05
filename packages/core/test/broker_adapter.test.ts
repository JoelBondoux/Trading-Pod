// ============================================================================
// Broker Adapter Tests — Mock, IG, Capital.com, OANDA, factory, and routing
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  MockBrokerAdapter,
  IGBrokerAdapter,
  CapitalComBrokerAdapter,
  OandaBrokerAdapter,
  createBrokerAdapter,
  selectBrokerForAsset,
  DEFAULT_BROKER_PREFERENCES,
} from "../src/execution_engine/broker_adapter.js";
import type { BrokerOrder } from "@trading-pod/shared";
import type { BrokerPreferences } from "../src/execution_engine/broker_adapter.js";

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

  it("has displayName and supportedAssets", () => {
    expect(adapter.displayName).toBe("Mock (Paper Trading)");
    expect(adapter.supportedAssets).toContain("fx");
    expect(adapter.supportedAssets).toContain("crypto");
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

  it("has name 'ig' and supports fx", () => {
    expect(adapter.name).toBe("ig");
    expect(adapter.displayName).toBe("IG");
    expect(adapter.supportedAssets).toContain("fx");
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
// CapitalComBrokerAdapter (stub — not yet implemented)
// ---------------------------------------------------------------------------

describe("CapitalComBrokerAdapter (stub)", () => {
  const adapter = new CapitalComBrokerAdapter({
    apiKey: "test",
    email: "test@example.com",
    password: "test",
    demo: true,
  });

  it("has name 'capital' and supports fx + crypto", () => {
    expect(adapter.name).toBe("capital");
    expect(adapter.displayName).toBe("Capital.com");
    expect(adapter.supportedAssets).toContain("fx");
    expect(adapter.supportedAssets).toContain("crypto");
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
// OandaBrokerAdapter (stub — not yet implemented)
// ---------------------------------------------------------------------------

describe("OandaBrokerAdapter (stub)", () => {
  const adapter = new OandaBrokerAdapter({
    apiToken: "test-token",
    accountId: "101-001-12345678-001",
    demo: true,
  });

  it("has name 'oanda' and supports fx + crypto", () => {
    expect(adapter.name).toBe("oanda");
    expect(adapter.displayName).toBe("OANDA");
    expect(adapter.supportedAssets).toContain("fx");
    expect(adapter.supportedAssets).toContain("crypto");
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

  it("creates a CapitalComBrokerAdapter for type 'capital' with config", () => {
    const a = createBrokerAdapter("capital", {
      apiKey: "k",
      email: "e@test.com",
      password: "p",
      demo: true,
    } as any);
    expect(a.name).toBe("capital");
    expect(a).toBeInstanceOf(CapitalComBrokerAdapter);
  });

  it("throws when 'capital' is requested without config", () => {
    expect(() => createBrokerAdapter("capital")).toThrow("Capital.com config required");
  });

  it("creates an OandaBrokerAdapter for type 'oanda' with config", () => {
    const a = createBrokerAdapter("oanda", {
      apiToken: "t",
      accountId: "a",
      demo: true,
    } as any);
    expect(a.name).toBe("oanda");
    expect(a).toBeInstanceOf(OandaBrokerAdapter);
  });

  it("throws when 'oanda' is requested without config", () => {
    expect(() => createBrokerAdapter("oanda")).toThrow("OANDA config required");
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
    capital: new CapitalComBrokerAdapter({ apiKey: "k", email: "e", password: "p", demo: true }),
    oanda: new OandaBrokerAdapter({ apiToken: "t", accountId: "a", demo: true }),
    mock: new MockBrokerAdapter(),
  };

  it("paper mode always returns mock adapter regardless of asset class", () => {
    expect(selectBrokerForAsset("fx", adapters, "paper").name).toBe("mock");
    expect(selectBrokerForAsset("crypto", adapters, "paper").name).toBe("mock");
  });

  it("live mode uses default preferences (capital for both)", () => {
    expect(selectBrokerForAsset("fx", adapters, "live").name).toBe("capital");
    expect(selectBrokerForAsset("crypto", adapters, "live").name).toBe("capital");
  });

  it("live mode respects custom preferences", () => {
    const prefs: BrokerPreferences = { fx: "ig", crypto: "oanda" };
    expect(selectBrokerForAsset("fx", adapters, "live", prefs).name).toBe("ig");
    expect(selectBrokerForAsset("crypto", adapters, "live", prefs).name).toBe("oanda");
  });

  it("falls back to mock when preferred broker not in adapters map", () => {
    const sparseAdapters = { mock: new MockBrokerAdapter() };
    const prefs: BrokerPreferences = { fx: "oanda", crypto: "capital" };
    expect(selectBrokerForAsset("fx", sparseAdapters, "live", prefs).name).toBe("mock");
  });

  it("defaults to paper mode when mode is omitted", () => {
    expect(selectBrokerForAsset("fx", adapters).name).toBe("mock");
  });

  it("DEFAULT_BROKER_PREFERENCES has capital for both asset classes", () => {
    expect(DEFAULT_BROKER_PREFERENCES.fx).toBe("capital");
    expect(DEFAULT_BROKER_PREFERENCES.crypto).toBe("capital");
  });
});
