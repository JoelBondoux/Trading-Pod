// ============================================================================
// Circuit Breaker — Auto-pause trading on excessive losses
// ============================================================================
// Monitors consecutive losses and daily drawdown. Triggers a pause when
// thresholds are exceeded to prevent catastrophic loss spirals.
// ============================================================================

export interface CircuitBreakerConfig {
  /** Maximum consecutive losses before tripping (default 3) */
  maxConsecutiveLosses: number;

  /** Maximum daily drawdown as a fraction of base capital (default 0.05 = 5%) */
  maxDailyDrawdownPercent: number;

  /** Cooldown period in minutes before auto-resume (0 = manual only) */
  cooldownMinutes: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveLosses: 3,
  maxDailyDrawdownPercent: 0.05,
  cooldownMinutes: 0, // manual reset only by default
};

export interface CircuitBreakerState {
  /** Whether the circuit breaker is currently tripped */
  tripped: boolean;

  /** Reason for the trip */
  reason?: string;

  /** Number of consecutive losses in current streak */
  consecutiveLosses: number;

  /** Total daily drawdown (cumulative losses today) */
  dailyDrawdown: number;

  /** Base capital snapshot for drawdown calculation */
  baseCapitalSnapshot: number;

  /** ISO date of current tracking day */
  currentDay: string;

  /** ISO timestamp when the breaker was tripped */
  trippedAt?: string;
}

/**
 * Circuit Breaker — monitors for dangerous loss patterns.
 *
 * Usage:
 *   1. Before each trade: call `canTrade()` to check if trading is allowed
 *   2. After each trade closes: call `recordOutcome(pnl)` to update state
 *   3. To manually reset: call `reset()`
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;

  constructor(
    baseCapital: number,
    config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
  ) {
    this.config = config;
    const today = new Date().toISOString().split("T")[0]!;
    this.state = {
      tripped: false,
      consecutiveLosses: 0,
      dailyDrawdown: 0,
      baseCapitalSnapshot: baseCapital,
      currentDay: today,
    };
  }

  /**
   * Check if trading is currently allowed.
   * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
   */
  canTrade(): { allowed: boolean; reason?: string } {
    this.resetDayIfNeeded();

    if (!this.state.tripped) {
      return { allowed: true };
    }

    // Check cooldown auto-resume
    if (this.config.cooldownMinutes > 0 && this.state.trippedAt) {
      const trippedTime = new Date(this.state.trippedAt).getTime();
      const elapsed = (Date.now() - trippedTime) / 60_000;
      if (elapsed >= this.config.cooldownMinutes) {
        this.reset();
        return { allowed: true };
      }
    }

    return { allowed: false, reason: this.state.reason };
  }

  /**
   * Record a trade outcome. Trips the breaker if thresholds are exceeded.
   */
  recordOutcome(pnl: number): void {
    this.resetDayIfNeeded();

    if (pnl < 0) {
      this.state.consecutiveLosses++;
      this.state.dailyDrawdown += Math.abs(pnl);

      // Check consecutive loss threshold
      if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.trip(
          `${this.state.consecutiveLosses} consecutive losses (limit: ${this.config.maxConsecutiveLosses})`
        );
        return;
      }

      // Check daily drawdown threshold
      const drawdownPercent =
        this.state.dailyDrawdown / this.state.baseCapitalSnapshot;
      if (drawdownPercent >= this.config.maxDailyDrawdownPercent) {
        this.trip(
          `Daily drawdown ${(drawdownPercent * 100).toFixed(1)}% exceeds limit ${(this.config.maxDailyDrawdownPercent * 100).toFixed(1)}%`
        );
        return;
      }
    } else {
      // Win resets consecutive loss counter
      this.state.consecutiveLosses = 0;
    }
  }

  /** Get current state (read-only copy) */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /** Load state from persistence */
  loadState(state: CircuitBreakerState): void {
    this.state = { ...state };
  }

  /** Manually reset the circuit breaker */
  reset(): void {
    this.state.tripped = false;
    this.state.reason = undefined;
    this.state.trippedAt = undefined;
    this.state.consecutiveLosses = 0;
    // Keep dailyDrawdown — it's still accurate for today
  }

  private trip(reason: string): void {
    this.state.tripped = true;
    this.state.reason = reason;
    this.state.trippedAt = new Date().toISOString();
  }

  private resetDayIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0]!;
    if (this.state.currentDay !== today) {
      this.state.currentDay = today;
      this.state.dailyDrawdown = 0;
      this.state.consecutiveLosses = 0;
      // Auto-reset trip on new day
      if (this.state.tripped) {
        this.reset();
      }
    }
  }
}
