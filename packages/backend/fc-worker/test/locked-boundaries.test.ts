import { describe, expect, it, vi } from "vitest";
import fc from "../src/index.js";
import treasurer from "../../treasurer-worker/src/index.js";
import eventStream from "../../event-stream-worker/src/index.js";
import webhook from "../../webhook-worker/src/index.js";

const secret = "test-service-secret";
function request(path: string, body?: unknown, method = "POST") {
  return new Request("https://worker.example" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function fixture() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  return {
    INTERNAL_SERVICE_SECRET: secret,
    TRADING_MODE: "OANDA_PRACTICE",
    TRADE_DB: { prepare: vi.fn().mockReturnValue({ bind }) },
    CONFIG_KV: { get: vi.fn().mockResolvedValue("false"), put: vi.fn() },
  };
}
const signal = {
  signalId: crypto.randomUUID(),
  agentId: "test",
  source: "internal",
  assetClass: "fx",
  instrument: "EUR_USD",
  direction: "long",
  confidence: 0.7,
  stopLoss: 1,
  takeProfit: 1.2,
  currentPrice: 1.1,
  holdingTimeMinutes: 60,
  justification: "test",
  timestamp: new Date().toISOString(),
};

describe("locked worker boundaries", () => {
  it("requires internal authentication for controls", async () => {
    const response = await fc.fetch(
      new Request("https://worker.example/state/paused", {
        method: "PUT",
        body: '{"paused":false}',
      }),
      fixture() as any,
    );
    expect(response.status).toBe(403);
  });
  it("cannot resume, even when KV says trading is unpaused", async () => {
    const env = fixture();
    expect(
      (await fc.fetch(request("/state/paused", { paused: false }, "PUT"), env as any)).status,
    ).toBe(409);
    const response = await fc.fetch(request("/state/paused", undefined, "GET"), env as any);
    expect(await response.json()).toMatchObject({ paused: true, executionEnabled: false });
    expect(env.CONFIG_KV.get).not.toHaveBeenCalled();
    expect(env.CONFIG_KV.put).not.toHaveBeenCalled();
  });
  it.each(["false", 0, null, undefined])("does not coerce paused=%s", async (paused) => {
    expect(
      (await fc.fetch(request("/state/paused", { paused }, "PUT"), fixture() as any)).status,
    ).toBe(400);
  });
  it("acknowledges an idempotent pause without pretending to persist controls", async () => {
    expect(
      await (
        await fc.fetch(request("/state/paused", { paused: true }, "PUT"), fixture() as any)
      ).json(),
    ).toEqual({ paused: true });
  });
  it("rejects signals without issuing capital or writing a processed decision", async () => {
    const env = fixture();
    const response = await fc.fetch(request("/signals", signal), env as any);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ accepted: false, operationalState: "PAUSED" });
    expect(env.TRADE_DB.prepare).not.toHaveBeenCalled();
  });
  it.each(["BTC_USD", "XAU_USD", "AAPL"])("rejects %s at the FC boundary", async (instrument) => {
    expect(
      (await fc.fetch(request("/signals", { ...signal, instrument }), fixture() as any)).status,
    ).toBe(400);
  });
  it("rejects mixed valid/invalid batches atomically", async () => {
    expect(
      (
        await fc.fetch(
          request("/signals", [signal, { ...signal, assetClass: "crypto" }]),
          fixture() as any,
        )
      ).status,
    ).toBe(400);
  });
  it("reports legacy live configuration as misconfigured and locked", async () => {
    const response = await fc.fetch(request("/health", undefined, "GET"), {
      ...fixture(),
      TRADING_MODE: "live",
    } as any);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ mode: "LIVE_LOCKED", executionEnabled: false });
  });
  it("never grants placeholder capital", async () => {
    const response = await treasurer.fetch(
      request("/capital/request", {
        decisionId: crypto.randomUUID(),
        amount: 100,
        assetClass: "fx",
        instrument: "EUR_USD",
        timestamp: new Date().toISOString(),
      }),
      fixture() as any,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ approved: false, allocatedAmount: 0 });
  });
  it("does not claim a capital return was processed", async () => {
    const response = await treasurer.fetch(
      request("/capital/return", {
        executionId: crypto.randomUUID(),
        capitalReturned: 100,
        pnl: 1,
        assetClass: "fx",
        timestamp: new Date().toISOString(),
      }),
      fixture() as any,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ processed: false });
  });
  it("retires shared-token WebSockets", async () => {
    expect(
      (
        await eventStream.fetch(
          new Request("https://worker.example/ws?token=old-token"),
          fixture() as any,
        )
      ).status,
    ).toBe(410);
  });
  it("rejects crypto capital returns without touching the audit ledger", async () => {
    const env = fixture();
    const response = await treasurer.fetch(
      request("/capital/return", {
        executionId: crypto.randomUUID(),
        capitalReturned: 100,
        pnl: 1,
        assetClass: "crypto",
        timestamp: new Date().toISOString(),
      }),
      env as any,
    );
    expect(response.status).toBe(400);
    expect(env.TRADE_DB.prepare).not.toHaveBeenCalled();
  });
  it("rejects a missing webhook source IP before forwarding", async () => {
    const env = {
      ...fixture(),
      CONFIG_KV: { get: vi.fn().mockResolvedValue(null) },
      FC_SERVICE: { fetch: vi.fn() },
    };
    expect((await webhook.fetch(request("/webhook/tradingview", {}), env as any)).status).toBe(403);
    expect(env.FC_SERVICE.fetch).not.toHaveBeenCalled();
  });
  it("blocks a non-FX webhook before forwarding", async () => {
    const env = { ...fixture(), FC_SERVICE: { fetch: vi.fn() } };
    const response = await webhook.fetch(
      request("/webhook/tradingview", {
        secret: "test",
        assetClass: "crypto",
        ticker: "BTCUSD",
        action: "buy",
        price: 100,
        stopLoss: 90,
        takeProfit: 120,
      }),
      env as any,
    );
    expect(response.status).toBe(400);
    expect(env.FC_SERVICE.fetch).not.toHaveBeenCalled();
  });
});
