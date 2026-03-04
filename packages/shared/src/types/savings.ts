// ============================================================================
// Savings Manager Types
// ============================================================================

/** Single deposit into the savings vault */
export interface SavingsDeposit {
  /** Deposit identifier */
  depositId: string;

  /** Amount deposited */
  amount: number;

  /** Source trade execution ID */
  executionId: string;

  /** ISO 8601 timestamp */
  depositedAt: string;
}

/** Current state of the Savings Manager */
export interface SavingsState {
  /** Total capital locked (never returned) */
  totalLocked: number;

  /** Number of deposits made */
  depositCount: number;

  /** ISO 8601 timestamp of last deposit */
  lastDepositAt?: string;
}
