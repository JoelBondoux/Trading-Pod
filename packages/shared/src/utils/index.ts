// ============================================================================
// Shared Utility Functions
// ============================================================================

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Format a number as currency (GBP) */
export function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

/** Format a number as currency (USD) */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** Generate a unique ID (works in Node, Workers, and Browsers) */
export function generateId(): string {
  // crypto.randomUUID is available in Node 19+, Workers, and modern browsers
  return globalThis.crypto.randomUUID();
}

/** Get current ISO 8601 timestamp */
export function now(): string {
  return new Date().toISOString();
}

/** Calculate reward-to-risk ratio */
export function rewardRiskRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  direction: "long" | "short"
): number {
  const risk =
    direction === "long" ? entryPrice - stopLoss : stopLoss - entryPrice;
  const reward =
    direction === "long" ? takeProfit - entryPrice : entryPrice - takeProfit;

  if (risk <= 0) return 0;
  return reward / risk;
}

/** Calculate percentage difference between two prices */
export function percentDiff(priceA: number, priceB: number): number {
  if (priceA === 0) return 0;
  return Math.abs((priceB - priceA) / priceA) * 100;
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
