// ============================================================================
// Savings Manager — One-way profit lockbox
// ============================================================================

import type { SavingsDeposit, SavingsState } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";

/**
 * Savings Manager.
 * Receives siphoned profits and locks them permanently.
 * Acts as a long-term safety buffer — funds NEVER return to the trading pool.
 */
export class SavingsManager {
  private state: SavingsState;

  constructor(initialState?: Partial<SavingsState>) {
    this.state = {
      totalLocked: initialState?.totalLocked ?? 0,
      depositCount: initialState?.depositCount ?? 0,
      lastDepositAt: initialState?.lastDepositAt,
    };
  }

  /** Get current state (read-only copy) */
  getState(): SavingsState {
    return { ...this.state };
  }

  /** Load state from persistence */
  loadState(state: SavingsState): void {
    this.state = { ...state };
  }

  /**
   * Deposit funds into the savings vault.
   * This is a ONE-WAY operation. Funds cannot be withdrawn.
   *
   * @returns The deposit record for audit logging
   */
  deposit(amount: number, executionId: string): SavingsDeposit {
    if (amount <= 0) {
      throw new Error(`Invalid deposit amount: ${amount}. Must be positive.`);
    }

    const deposit: SavingsDeposit = {
      depositId: generateId(),
      amount,
      executionId,
      depositedAt: now(),
    };

    this.state.totalLocked += amount;
    this.state.depositCount += 1;
    this.state.lastDepositAt = deposit.depositedAt;

    return deposit;
  }
}
