// ============================================================================
// Context Providers — News Filter
// ============================================================================

import type { NewsFilterOutput } from "@trading-pod/shared";
import { now } from "@trading-pod/shared";

/**
 * News Filter context provider.
 * Checks whether trading should be blocked due to upcoming high-impact news events.
 *
 * TODO: Integrate with a real economic calendar API (e.g., Forex Factory, Investing.com)
 */
export class NewsFilter {
  /**
   * Check whether trading should be blocked right now.
   * Stub implementation — always allows trading.
   */
  check(): NewsFilterOutput {
    // TODO: Query economic calendar for upcoming events
    // Block if high-impact event (e.g., NFP, FOMC, CPI) is within newsBlockWindowMinutes

    return {
      block: false,
      timestamp: now(),
    };
  }
}

export function createNewsFilter(): NewsFilter {
  return new NewsFilter();
}
