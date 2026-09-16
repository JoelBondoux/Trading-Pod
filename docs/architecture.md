# Architecture

Trading Pod is transitioning from a small prototype to an FX-only OANDA practice research platform. The TypeScript monorepo, deterministic agents, dashboard shell and research tests are reused. Broker execution is intentionally unavailable in the current foundation.

## Current boundaries

| Boundary                | Implemented behaviour                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Shared runtime contract | Four explicit modes; unknown configuration locks; execution always paused          |
| FX schemas              | EUR_USD, GBP_USD, USD_JPY; explicit slash and compact aliases only                 |
| FC /dashboard/session   | Verifies Google token and approved subject; returns identity and expiry            |
| FC /dashboard/status    | Same authentication; returns locked runtime status                                 |
| FC internal signals     | Validates FX batches, then returns 503 / accepted=false                            |
| FC internal controls    | Pause is idempotent; resume, freeze and broker changes are refused                 |
| Treasurer               | Logs attempts; refuses allocation and refuses to claim returns were processed      |
| Event stream            | Shared-token WebSockets retired; /ws and /broadcast return 410                     |
| Legacy execution engine | Offline mock simulation only; no broker adapter can be selected through its router |

The dashboard polls status every 30 seconds. It clears stale status on failure, unmount or sign-out. A connected status means the dashboard API responded, not that an OANDA account is connected.

## Storage and authority

D1 and KV schemas remain for historical records. The execution lock is unconditional code in this milestone; neither missing KV state nor an old unpaused flag can override it. There is no implemented mutable, durable trading-control service yet.

The next execution service needs a transactional operational ledger for commands, orders, trades, protection, reservations, transactions and reconciliation checkpoints. PostgreSQL is the planned authoritative store. Cloudflare may continue to host the UI and HTTP edge. Existing D1 money fields and KV flags are not the intended production risk ledger.

## Intended next architecture

An always-running service will consume OANDA practice prices and transactions, reconcile account state, run frozen deterministic strategies, reserve portfolio risk, and manage orders through confirmed closure. Broker credentials stay in that service. Research and LLM processes only submit versioned candidates and cannot override deterministic risk policy.

The prospective research path must preserve source observation time, publication time, strategy version, data manifest and every hypothesis attempt. Backtest, shadow, holdout and forward results remain separate. AI historical knowledge requires prospective evaluation.

TradingView is optional input and charting, never the authoritative account state. The first dashboard uses its own charts; arbitrary overlays in the TradingView website are not assumed.

## Verification

Run build, typecheck and the Vitest suite as documented in the README. Worker contract tests cover authentication and rejection behaviour without credentials or network orders. Real Google configuration, broker connectivity, runtime deployment and crash/reconnect behaviour remain integration work.
