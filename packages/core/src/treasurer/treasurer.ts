// ============================================================================
// Treasurer — Capital gating and allocation
// ============================================================================

import type {
  TreasurerState,
  CapitalRequest,
  CapitalResponse,
  CapitalReturn,
} from "@trading-pod/shared";
import { now, clamp, DEFAULT_TREASURER_CONFIG } from "@trading-pod/shared";

export class Treasurer {
  private state: TreasurerState;

  constructor(initialState?: Partial<TreasurerState>) {
    const today = new Date().toISOString().split("T")[0]!;
    this.state = {
      baseCapital: initialState?.baseCapital ?? 1000,
      dailyAllocated: initialState?.dailyAllocated ?? 0,
      dailyCeiling: initialState?.dailyCeiling ??
        (initialState?.baseCapital ?? 1000) * DEFAULT_TREASURER_CONFIG.dailyCeilingPercent,
      scaleFactor: initialState?.scaleFactor ?? DEFAULT_TREASURER_CONFIG.initialScaleFactor,
      minScaleFactor: initialState?.minScaleFactor ?? DEFAULT_TREASURER_CONFIG.minScaleFactor,
      maxScaleFactor: initialState?.maxScaleFactor ?? DEFAULT_TREASURER_CONFIG.maxScaleFactor,
      rollingPnL: initialState?.rollingPnL ?? [],
      rollingWindowSize: initialState?.rollingWindowSize ?? DEFAULT_TREASURER_CONFIG.rollingWindowSize,
      currentDay: initialState?.currentDay ?? today,
      updatedAt: now(),
    };
  }

  /** Get current Treasurer state (read-only copy) */
  getState(): TreasurerState {
    return { ...this.state, rollingPnL: [...this.state.rollingPnL] };
  }

  /** Load state from persistence (e.g., D1) */
  loadState(state: TreasurerState): void {
    this.state = { ...state, rollingPnL: [...state.rollingPnL] };
  }

  /**
   * Process a capital request from the Financial Controller.
   * Enforces daily allocation limits and scale factor.
   */
  requestCapital(request: CapitalRequest): CapitalResponse {
    // Reset daily allocation if it's a new day
    this.resetDailyIfNeeded();

    const maxForTrade = this.state.baseCapital * this.state.scaleFactor;
    const requestedAmount = Math.min(request.amount, maxForTrade);
    const dailyRemaining = this.state.dailyCeiling - this.state.dailyAllocated;

    if (dailyRemaining <= 0) {
      return {
        approved: false,
        allocatedAmount: 0,
        rejectionReason: "Daily allocation ceiling reached",
        dailyRemaining: 0,
        timestamp: now(),
      };
    }

    const allocatedAmount = Math.min(requestedAmount, dailyRemaining);

    if (allocatedAmount <= 0) {
      return {
        approved: false,
        allocatedAmount: 0,
        rejectionReason: "No capital available within limits",
        dailyRemaining,
        timestamp: now(),
      };
    }

    // Allocate
    this.state.dailyAllocated += allocatedAmount;
    this.state.updatedAt = now();

    return {
      approved: true,
      allocatedAmount,
      dailyRemaining: this.state.dailyCeiling - this.state.dailyAllocated,
      timestamp: now(),
    };
  }

  /**
   * Process capital return after a trade closes.
   * Splits profit between Treasurer (50%) and Savings (50%).
   * Returns the amount to send to Savings Manager.
   */
  returnCapital(ret: CapitalReturn): {
    savingsAmount: number;
    taxableProfit: number;
    assetClass: "fx" | "crypto";
  } {
    // Return the original capital to the pool
    this.state.baseCapital += ret.capitalReturned;

    let savingsAmount = 0;
    let taxableProfit = 0;

    if (ret.pnl > 0) {
      // Profit: split 50/50 between Treasurer and Savings
      const treasurerShare = ret.pnl * DEFAULT_TREASURER_CONFIG.treasurerProfitShare;
      const savingsShare = ret.pnl * DEFAULT_TREASURER_CONFIG.savingsProfitShare;

      this.state.baseCapital += treasurerShare;
      savingsAmount = savingsShare;
      taxableProfit = ret.pnl;
    } else {
      // Loss: absorbed by base capital (already returned less)
      this.state.baseCapital += ret.pnl; // negative, reduces capital
    }

    // Update rolling PnL
    this.state.rollingPnL.push(ret.pnl);
    if (this.state.rollingPnL.length > this.state.rollingWindowSize) {
      this.state.rollingPnL.shift();
    }

    // Adjust scale factor based on rolling performance
    this.adjustScaleFactor();
    this.state.updatedAt = now();

    return {
      savingsAmount,
      taxableProfit,
      assetClass: ret.assetClass,
    };
  }

  /**
   * Adjust scale factor based on rolling PnL performance.
   * Scale up when consistently profitable, down when losing.
   */
  private adjustScaleFactor(): void {
    if (this.state.rollingPnL.length < 5) return; // Need minimum history

    const totalPnL = this.state.rollingPnL.reduce((sum, p) => sum + p, 0);
    const winRate =
      this.state.rollingPnL.filter((p) => p > 0).length /
      this.state.rollingPnL.length;

    if (totalPnL > 0 && winRate > 0.5) {
      // Scale up modestly (5% increase)
      this.state.scaleFactor = clamp(
        this.state.scaleFactor * 1.05,
        this.state.minScaleFactor,
        this.state.maxScaleFactor
      );
    } else if (totalPnL < 0 || winRate < 0.4) {
      // Scale down (10% decrease — faster down than up for safety)
      this.state.scaleFactor = clamp(
        this.state.scaleFactor * 0.90,
        this.state.minScaleFactor,
        this.state.maxScaleFactor
      );
    }

    // Update ceiling proportionally
    this.state.dailyCeiling =
      this.state.baseCapital * DEFAULT_TREASURER_CONFIG.dailyCeilingPercent;
  }

  private resetDailyIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0]!;
    if (this.state.currentDay !== today) {
      this.state.dailyAllocated = 0;
      this.state.currentDay = today;
    }
  }
}
