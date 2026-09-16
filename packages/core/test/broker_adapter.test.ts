import { describe, expect, it, vi, afterEach } from "vitest";
import {
  MockBrokerAdapter,
  IGBrokerAdapter,
  CapitalComBrokerAdapter,
  OandaBrokerAdapter,
  createBrokerAdapter,
  selectBrokerForAsset,
} from "../src/execution_engine/broker_adapter.js";
import { ExecutionEngine } from "../src/execution_engine/engine.js";
import type { BrokerOrder } from "@trading-pod/shared";

const order: BrokerOrder = {
  instrument: "EUR_USD",
  direction: "long",
  size: 100,
  stopLoss: 1.05,
  takeProfit: 1.15,
  type: "market",
};
afterEach(() => vi.restoreAllMocks());

describe("offline broker simulation", () => {
  it("simulates an FX fill without network access", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const mock = new MockBrokerAdapter();
    expect(await mock.placeOrder(order)).toMatchObject({
      status: "accepted",
      filledSize: 100,
      fees: 0,
    });
    expect(mock.supportedAssets).toEqual(["fx"]);
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["BTC_USD", "XAU_USD", "AAPL"])("rejects %s even in the mock", async (instrument) => {
    await expect(new MockBrokerAdapter().placeOrder({ ...order, instrument })).rejects.toThrow();
  });
  it("only routes paper FX to a real mock instance", () => {
    const mock = new MockBrokerAdapter();
    expect(selectBrokerForAsset("fx", { mock })).toBe(mock);
    expect(() => selectBrokerForAsset("crypto", { mock })).toThrow("Only FX");
    expect(() => selectBrokerForAsset("fx", { mock: { ...mock } } as any)).toThrow("offline mock");
  });
  it.each(["live", "OANDA_PRACTICE", "SHADOW", "unknown"])(
    "does not route or fall back for mode %s",
    (mode) => {
      expect(() =>
        selectBrokerForAsset("fx", { mock: new MockBrokerAdapter() }, mode as any),
      ).toThrow("locked");
    },
  );
});

describe("practice-only adapter boundary", () => {
  it("pins OANDA to the practice host and exposes only FX", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const broker = new OandaBrokerAdapter({
      apiToken: "fixture",
      accountId: "fixture",
      demo: true,
    });
    expect(broker.baseUrl).toBe("https://api-fxpractice.oanda.com");
    expect(broker.supportedAssets).toEqual(["fx"]);
    await expect(broker.placeOrder(order)).rejects.toThrow("not yet implemented");
    await expect(broker.cancelOrder("fixture")).rejects.toThrow("not yet implemented");
    expect(await broker.healthCheck()).toBe(false);
    expect(network).not.toHaveBeenCalled();
  });
  it.each([false, undefined, "true"])("requires a literal demo=true, rejects %s", (demo) => {
    expect(
      () => new OandaBrokerAdapter({ apiToken: "fixture", accountId: "fixture", demo } as any),
    ).toThrow("locked");
  });
  it("rejects direct live construction of both retired adapters", () => {
    expect(
      () => new IGBrokerAdapter({ apiKey: "", username: "", password: "", demo: false }),
    ).toThrow("locked");
    expect(
      () => new CapitalComBrokerAdapter({ apiKey: "", email: "", password: "", demo: false }),
    ).toThrow("locked");
  });
  it("factory rejects retired brokers and invalid configurations", () => {
    expect(() => createBrokerAdapter("ig")).toThrow("Only OANDA practice");
    expect(() => createBrokerAdapter("capital")).toThrow("Only OANDA practice");
    expect(() => createBrokerAdapter("oanda")).toThrow("config required");
    expect(() =>
      createBrokerAdapter("oanda", { apiToken: "", accountId: "", demo: false }),
    ).toThrow("locked");
    expect(() => createBrokerAdapter("unknown" as any)).toThrow("Unknown");
    expect(createBrokerAdapter("mock")).toBeInstanceOf(MockBrokerAdapter);
  });
  it("cannot attach an OANDA adapter to the legacy simulator", () => {
    const broker = new OandaBrokerAdapter({ apiToken: "", accountId: "", demo: true });
    expect(() => new ExecutionEngine(broker)).toThrow("simulation-only");
  });
});
