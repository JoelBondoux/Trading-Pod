# Agent Protocols

## Signal Agent Interface

Every signal agent implements the `SignalAgent` interface:

```typescript
interface SignalAgent {
  getMeta(): AgentMeta;
  analyze(data: MarketDataSnapshot): AgentSignal | null;
}
```

### `getMeta()`
Returns static metadata about the agent:
- `agentId` — unique identifier (e.g., `"trend_agent"`)
- `name` — human-readable name
- `description` — what the agent does
- `assetClasses` — which asset classes it supports (`"fx"`, `"crypto"`)
- `version` — semantic version
- `enabled` — whether the agent is active

### `analyze(data)`
Accepts a `MarketDataSnapshot` containing OHLCV data and price history. Returns an `AgentSignal` if a trade opportunity is detected, or `null` if no signal.

## MarketDataSnapshot

```typescript
interface MarketDataSnapshot {
  instrument: string;        // e.g., "GBP/USD"
  assetClass: AssetClass;    // "fx" | "crypto"
  ohlcv: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  priceHistory: number[];    // recent close prices (oldest first)
  timeframeMinutes: number;  // candle timeframe
}
```

## AgentSignal

All signals carry:
- `signalId` — unique UUID
- `agentId` — which agent produced it
- `source` — `"internal"` or `"tradingview"`
- `assetClass` — `"fx"` or `"crypto"`
- `instrument` — trading pair
- `direction` — `"long"` or `"short"`
- `confidence` — 0–1 score
- `stopLoss` / `takeProfit` — price levels
- `holdingTimeMinutes` — suggested duration
- `justification` — human-readable reason
- `currentPrice` — price at signal time
- `timestamp` — ISO 8601

## Rules

1. **Agents are stateless** — they receive data and emit signals, no persistent memory
2. **Agents cannot execute trades** — they can only propose via signals
3. **Agents are scored** — credibility is tracked by the Credibility Manager
4. **Agents can be frozen** — the Control Panel can disable individual agents
5. **TradingView signals** follow the same `AgentSignal` shape via webhook transformation
