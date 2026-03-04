# Architecture

## Overview

Trading-Pod is a **multi-agent trading platform** where independent signal agents propose trades, a deterministic Financial Controller (FC) gates decisions through risk checks, a Treasurer manages capital allocation, and an Execution Engine routes orders to the appropriate broker.

## System Components

### Signal Agents (4)
Independent analysis units that consume market data and emit `AgentSignal` messages. No agent can place a trade directly — signals are proposals only.

- **Trend Agent** — Moving-average crossover with ATR-based stop/target
- **Mean Reversion Agent** — Z-score / Bollinger Band reversion signals
- **Volatility Agent** — ATR compression/expansion detection
- **Momentum Agent** — Multi-period Rate of Change with acceleration checks

### Context Providers (2)
Non-signal components that provide environmental context to the FC. They do not have credibility scores.

- **Market State Classifier** — ATR-based regime classification (calm/normal/volatile)
- **News Filter** — Blocks trading during high-impact economic events

### Financial Controller (FC)
The deterministic decision-making core. Receives signals, computes credibility-weighted consensus, runs all risk checks, requests capital from Treasurer, and emits an `FCDecision`.

Pipeline: `Signals → Weighted Consensus → Risk Checks → Capital Request → Decision`

### Treasurer
Capital gatekeeper. Controls how much money can be risked per trade and per day.

- Daily ceiling: 10% of base capital
- Scale factor: starts at 1%, grows up to 5% based on performance
- Profit split: 50% retained by Treasurer (grows capital), 50% to Savings
- Auto-adjusts scale factor: +5% when rolling PnL positive, -10% when negative

### Savings Manager
One-way vault. Receives 50% of post-tax profits. Funds are permanently locked and never return to the trading pool. This is the "safe profit extraction" mechanism.

### Tax Collector (Crypto only)
Reserves approximately 24% of crypto spot gains for UK Capital Gains Tax. Respects £3,000 annual exempt amount. FX spread bets are tax-free.

### Execution Engine
Routes approved decisions to the correct broker based on asset class:
- FX → IG (spread betting, REST API)
- Crypto → Kraken (spot, REST API)

Supports **paper trading mode** (`TRADING_MODE=paper`, the default) which routes all orders through a `MockBrokerAdapter` that simulates fills without touching real brokers.

### Circuit Breaker
Automatic loss-protection gate that sits between the FC and Execution Engine:
- Trips after **3 consecutive losing trades** or **5% daily drawdown**
- When tripped, `canTrade()` returns `false` — no new trades are allowed
- Optional cooldown period for automatic resume
- Resets automatically at day boundaries

### Currency Converter
Converts USD-denominated crypto profits to GBP for accurate UK CGT calculation:
- Fetches live GBP/USD rate from Kraken’s public ticker API
- Rate cached with configurable refresh interval (default 60s)
- Fallback rate (0.79) used if API is unavailable

### Structured Logger
JSON-based structured logging for all Cloudflare Workers:
- Each log entry includes `timestamp`, `level`, `worker`, `msg`, `correlationId`
- Configurable minimum log level (`debug` / `info` / `warn` / `error`)
- `child()` method creates sub-loggers with inherited context
- Enables correlation tracking across worker-to-worker calls

### Event Bus
Real-time event streaming via Cloudflare Durable Objects with Hibernation API. WebSocket connections from dashboard clients. All system events are broadcast to connected dashboards.

## Data Flow

```
Market Data → Agents → FC → Treasurer → Execution Engine → Broker
                ↑         ↓           ↓              ↓
          Context     Risk       Capital          Fill/Close
         Providers   Checks      Gating            Events
                                   ↓                 ↓
                              Savings Mgr      Tax Collector
                                   ↓                 ↓
                               Event Bus ←←←←←←←←←←←┘
                                   ↓
                              Dashboard (WebSocket)
```

## Deployment Model

All backend services run on Cloudflare's edge network:

| Worker | Responsibility |
|--------|---------------|
| `fc-worker` | Signal ingestion, FC decision pipeline |
| `treasurer-worker` | Capital allocation, PnL tracking |
| `savings-worker` | Deposit management |
| `webhook-worker` | TradingView webhook ingestion + validation |
| `event-stream-worker` | Durable Object WebSocket server |

Dashboard is deployed to Cloudflare Pages as a static React SPA.

## Storage

- **D1** (SQLite): All transactional data — trades, decisions, credibility, treasurer state, savings, tax reserves, audit log
- **KV**: Read-heavy configuration — risk rules, agent config, webhook secrets

## Testing

- **119 unit tests** across 8 test files using Vitest
- Coverage: credibility scoring, risk rules, tax collector, treasurer, FC pipeline, circuit breaker, currency converter, shared utilities
- Run with `pnpm test` from the monorepo root
- CI runs tests automatically on every push/PR

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm test` | Run all 119 unit tests |
| `pnpm -r typecheck` | Typecheck all 9 packages |
| `pnpm -r build` | Build all packages |
| `node scripts/migrate-d1.mjs` | Apply D1 schema (supports `--local`, `--env`, `--dry-run`) |
| `node scripts/upgrade.mjs` | Self-upgrade from GitHub + typecheck |
