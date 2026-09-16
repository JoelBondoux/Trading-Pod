import { vi } from "vitest";
import type { ConnectionConfig } from "../src/config.js";
import type { JournalPayload } from "../src/journal.js";
import { AccountResponseSchema, InstrumentsResponseSchema, PricingResponseSchema } from "../src/schemas.js";

export const time = "2026-09-16T10:00:00.000Z";
export const config: ConnectionConfig = {
  environment: "practice", accountId: "001-001-1234567-001", expectedCurrency: "GBP",
  instruments: ["EUR_USD"], token: "synthetic-test-token-not-a-credential",
};
export const observe = <T>(value: T) => ({ requestedAt: time, receivedAt: time, value });
export function account(id = "100") {
  return {
    account: {
      id: config.accountId, currency: "GBP", balance: "10000.0000", NAV: "10000.0000",
      marginAvailable: "10000.0000", marginUsed: "0.0000", marginRate: "0.0333",
      openTradeCount: 0, openPositionCount: 0, pendingOrderCount: 0,
      lastTransactionID: id, trades: [], orders: [], positions: [],
    },
    lastTransactionID: id,
  };
}
export function instruments() {
  return {
    instruments: [{ name: "EUR_USD", type: "CURRENCY", displayPrecision: 5, pipLocation: -4,
      tradeUnitsPrecision: 0, minimumTradeSize: "1", maximumOrderUnits: "100000000",
      maximumPositionSize: "0", marginRate: "0.0333" }],
    lastTransactionID: "100",
  };
}
export function pricing() {
  return {
    time, prices: [{ instrument: "EUR_USD", time, tradeable: true, status: "tradeable",
      bids: [{ price: "1.10001", liquidity: 1000000 }], asks: [{ price: "1.10013", liquidity: 1000000 }],
      closeoutBid: "1.09999", closeoutAsk: "1.10015" }],
    homeConversions: ["EUR", "USD"].map((currency) => ({ currency, accountGain: "0.75", accountLoss: "0.76", positionValue: "0.755" })),
  };
}
export function transactions(ids: string[], latest = ids.at(-1) ?? "100") {
  return {
    transactions: ids.map((id) => ({ id, accountID: config.accountId, batchID: id, time, type: "DAILY_FINANCING", financing: "-1.001" })),
    lastTransactionID: latest,
  };
}
export function snapshot(id = "100", kind: "baseline" | "snapshot" = "baseline"): JournalPayload {
  return { kind, account: observe(AccountResponseSchema.parse(account(id))),
    instruments: observe(InstrumentsResponseSchema.parse(instruments())), pricing: observe(PricingResponseSchema.parse(pricing())) };
}
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
export function transport(...values: unknown[]) {
  const mock = vi.fn<typeof fetch>();
  for (const value of values) mock.mockResolvedValueOnce(value instanceof Response ? value : json(value));
  return mock;
}
