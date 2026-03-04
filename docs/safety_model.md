# Safety Model

## Defence-in-Depth

Trading-Pod implements multiple independent safety layers. No single point of failure can cause unbounded losses.

## Layer 1: Agent Independence

- Agents **cannot execute trades** — they only emit proposals (signals)
- Each agent operates independently with no inter-agent communication
- Agents can be frozen individually via the Control Panel
- TradingView webhook signals go through the same pipeline as internal agents

## Layer 2: Financial Controller (FC)

The FC is a **deterministic** decision gate. Every signal passes through:

1. **Weighted Consensus** — credibility-weighted aggregation (low-credibility agents have less influence)
2. **Risk Checks** (all must pass):
   - Minimum reward:risk ratio ≥ 1.5
   - Maximum stop-loss ≤ 3% of price
   - Maximum 5 trades per day
   - Minimum consensus confidence ≥ 60%
   - No trading in "volatile" market regime
   - No trading during high-impact news windows (30 min)

If **any** risk check fails, the decision is rejected. No exceptions.

## Layer 3: Treasurer (Capital Gating)

Even if the FC approves a trade, the Treasurer controls how much capital is risked:

- **Daily ceiling**: Maximum 10% of base capital per day
- **Scale factor**: Starts at 1%, grows to max 5% only with proven performance
- **Auto-adjustment**: Scale factor increases 5% after profitable windows, decreases 10% after losses
- **Rolling PnL window**: Last 20 trades used for scale adjustment

## Layer 4: Savings Manager (One-Way Vault)

50% of post-tax profits are deposited into the Savings Manager:

- **Funds never return** to the trading pool
- This ensures profitable periods permanently extract value
- Even if subsequent trades lose, saved profits are protected

## Layer 5: Tax Collector

For crypto trades, the Tax Collector reserves ~24% of gains:

- Prevents spending money owed to HMRC
- £3,000 annual exempt amount applied first
- Conservative estimate — actual CGT may differ at year-end

## Layer 6: Position-Level Protection

- Every trade has a stop-loss and take-profit
- Maximum stop-loss distance enforced by risk rules
- Position sizing based on capped scale factor × base capital

## Layer 7: Loss Circuit Breaker

Automatic trading halt when losses accumulate:

- **3 consecutive losses** → circuit breaker trips
- **5% daily drawdown** → circuit breaker trips
- When tripped, `canTrade()` returns `false` — all new trade requests are blocked
- Optional cooldown period for automatic resume (default: manual reset only)
- Day-boundary auto-reset clears consecutive-loss counter at midnight
- Configurable via `CircuitBreakerConfig`:
  - `maxConsecutiveLosses` (default: 3)
  - `maxDailyDrawdownPercent` (default: 0.05 = 5%)
  - `cooldownMinutes` (default: 0 = manual reset)

## Layer 8: Paper Trading Mode

- `TRADING_MODE=paper` is the **default** for all workers
- When active, `selectBrokerForAsset()` always returns `MockBrokerAdapter`
- No real orders are placed on IG or Kraken
- Allows full end-to-end system testing with real market signals
- Switch to `TRADING_MODE=live` in `wrangler.jsonc` only when confident

## Emergency Controls

The dashboard Control Panel provides **server-side enforced** controls:

- **Pause Trading** — sets `state:trading_paused` in KV; the FC worker rejects all incoming signals with HTTP 503 while paused
- **Freeze Agent** — sets `state:frozen_agents` in KV; the FC worker skips signals from frozen agents during pipeline processing
- **Event Log** — real-time audit trail of all system events

These controls operate at the backend level — even if the dashboard disconnects, the pause/freeze state persists in KV until explicitly reversed.

## What Cannot Happen

| Scenario | Why It's Prevented |
|----------|-------------------|
| Agent places trade alone | FC required — agents only emit signals |
| Single large losing trade | Max SL 3% + daily ceiling 10% |
| All capital lost in one day | Daily ceiling caps at 10% of base |
| Profitable gains consumed by losses | Savings Manager locks 50% of profits permanently |
| Tax underpayment | Tax Collector reserves 24% of crypto gains proactively |
| Trading in dangerous conditions | Market regime + news window checks block entries |
| Losing streak drains capital | Circuit breaker halts trading after 3 consecutive losses or 5% drawdown |
| Accidental live trading | Paper mode is ON by default — must explicitly set `TRADING_MODE=live` |
