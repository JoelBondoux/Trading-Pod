// ============================================================================
// Treasurer Types — Capital gating
// ============================================================================

/** Current state of the Treasurer */
export interface TreasurerState {
  /** Total base capital available */
  baseCapital: number;

  /** Capital allocated so far today */
  dailyAllocated: number;

  /** Maximum daily allocation ceiling */
  dailyCeiling: number;

  /** Current scale factor (starts small, grows with performance) */
  scaleFactor: number;

  /** Minimum scale factor */
  minScaleFactor: number;

  /** Maximum scale factor (ceiling) */
  maxScaleFactor: number;

  /** Rolling PnL for last N trades (used for scale adjustment) */
  rollingPnL: number[];

  /** Rolling window size */
  rollingWindowSize: number;

  /** ISO 8601 date of current trading day */
  currentDay: string;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/** Request from FC to Treasurer for capital */
export interface CapitalRequest {
  /** Decision ID this request is for */
  decisionId: string;

  /** Requested capital amount */
  amount: number;

  /** Asset class */
  assetClass: "fx" | "crypto";

  /** Instrument */
  instrument: string;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Treasurer response to a capital request */
export interface CapitalResponse {
  /** Whether capital was approved */
  approved: boolean;

  /** Actual amount allocated (may be less than requested) */
  allocatedAmount: number;

  /** Reason for rejection (if not approved) */
  rejectionReason?: string;

  /** Remaining daily allocation after this request */
  dailyRemaining: number;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Capital return after trade closes */
export interface CapitalReturn {
  /** Execution ID of the closed trade */
  executionId: string;

  /** Original capital allocated */
  capitalReturned: number;

  /** Profit or loss amount */
  pnl: number;

  /** Asset class of the trade */
  assetClass: "fx" | "crypto";

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Default Treasurer configuration */
export const DEFAULT_TREASURER_CONFIG = {
  /** Starting scale factor (1% of base capital) */
  initialScaleFactor: 0.01,

  /** Minimum scale factor floor */
  minScaleFactor: 0.005,

  /** Maximum scale factor ceiling (5% of base capital) */
  maxScaleFactor: 0.05,

  /** Daily ceiling as percentage of base capital */
  dailyCeilingPercent: 0.10,

  /** Rolling PnL window size */
  rollingWindowSize: 20,

  /** Profit split: portion returned to Treasurer */
  treasurerProfitShare: 0.5,

  /** Profit split: portion sent to Savings Manager */
  savingsProfitShare: 0.5,
} as const;
