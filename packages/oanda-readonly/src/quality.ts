import type { Binding } from "./config.js";
import { compareDecimal, type AccountResponse, type Observed, type PricingResponse } from "./schemas.js";

export const MAX_PRICE_AGE_MS = 15000;
export const MAX_FUTURE_SKEW_MS = 2000;

/** Evaluated at observation time, not a reusable authorisation to trade later. */
export function assessPrices(observed: Observed<PricingResponse>) {
  const received = Date.parse(observed.receivedAt);
  const responseAge = received - Date.parse(observed.value.time);
  const currencies = new Set(observed.value.homeConversions.map((c) => c.currency));
  return observed.value.prices.map((price) => {
    const reasons: string[] = [];
    const age = received - Date.parse(price.time);
    if (age > MAX_PRICE_AGE_MS || responseAge > MAX_PRICE_AGE_MS) reasons.push("STALE");
    if (age < -MAX_FUTURE_SKEW_MS || responseAge < -MAX_FUTURE_SKEW_MS) reasons.push("FUTURE_TIME");
    if (!price.tradeable || (price.status !== undefined && price.status !== "tradeable")) reasons.push("NOT_TRADEABLE");
    const bids = price.bids.filter((bucket) => bucket.liquidity > 0);
    const asks = price.asks.filter((bucket) => bucket.liquidity > 0);
    if (!bids.length || !asks.length) reasons.push("NO_LIQUIDITY");
    const bestBid = bids.reduce<string | null>((best, bucket) =>
      best === null || compareDecimal(bucket.price, best) > 0 ? bucket.price : best, null);
    const bestAsk = asks.reduce<string | null>((best, bucket) =>
      best === null || compareDecimal(bucket.price, best) < 0 ? bucket.price : best, null);
    if (bestBid !== null && bestAsk !== null && compareDecimal(bestBid, bestAsk) >= 0) reasons.push("CROSSED_OR_LOCKED");
    if (price.instrument.split("_").some((currency) => !currencies.has(currency))) reasons.push("MISSING_CONVERSION");
    return { instrument: price.instrument, usableAtObservation: reasons.length === 0, reasons, bestBid, bestAsk };
  });
}

export function assessExposure(account: AccountResponse["account"], binding: Binding) {
  const active = new Set(account.trades.map((t) => t.instrument));
  for (const position of account.positions) {
    // Check each side: a hedged position can have zero net units and real exposure.
    if (compareDecimal(position.long.units, "0") !== 0 || compareDecimal(position.short.units, "0") !== 0) {
      active.add(position.instrument);
    }
  }
  for (const order of account.orders) if (order.instrument) active.add(order.instrument);
  return {
    hasExistingExposure: active.size > 0 || account.orders.length > 0,
    outsideUniverse: [...active].filter((name) => !binding.instruments.some((item) => item === name)).sort(),
    ordersWithoutInstrument: account.orders.filter((order) => !order.instrument).length,
  };
}
