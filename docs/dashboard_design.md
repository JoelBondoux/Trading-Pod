# Dashboard Design

## Overview

The Trading-Pod dashboard is a React SPA that connects to the event-stream Durable Object via WebSocket for real-time updates. It provides visibility into all system components.

## Technology

- **React 18** — UI framework
- **Vite 5** — Build tool, dev server on port 3000
- **TailwindCSS 3.4** — Utility-first styling with custom "pod" theme
- **Recharts** — Charts (PnL sparklines, savings growth curve)
- **Zustand** — Lightweight state management with domain slices
- **Cloudflare Pages** — Static deployment

## Panels

### 1. Overview
Compact summary of all subsystems on a single page. Quick glance at system health.

### 2. Agent Tiles
- 4 agent cards showing: name, credibility badge, latest signal details
- Credibility badge: green (≥70%), amber (≥40%), red (<40%)
- Recent signals table: time, agent, pair, direction, confidence, source

### 3. FC Pipeline
- Visual pipeline: Signals → Consensus → Risk Checks → Decision
- Each stage is a box with details
- Decision history table with pass/fail indicators

### 4. Treasurer
- Stat cards: Base Capital, Scale Factor, Daily Allocation
- Rolling PnL sparkline (cumulative area chart)
- Daily ceiling usage indicator (turns red at >80%)

### 5. Execution
- Open positions table: pair, direction, entry, SL, TP, size, broker, status
- Closed trades table with PnL column
- Net PnL summary

### 6. Savings Vault
- Total locked amount (permanently extracted profits)
- Deposit count and last deposit time
- Growth curve (populates over time)

### 7. Tax Reserve
- Tax year, total reserved, annual exempt remaining
- Important UK tax notes (FX = tax-free, crypto = CGT)
- Reserve is approximate — recommend Koinly for final calc

### 8. Decision Replay
- List of all decisions (left panel)
- Detail view (right panel): meta, risk checks, contributing signals
- Useful for auditing why a decision was approved/rejected

### 9. Control Panel
- Global trading pause button
- Per-agent freeze/unfreeze toggles
- Real-time event log (last 100 events)

## Theme

Dark theme optimized for trading:

| Token | Hex | Usage |
|-------|-----|-------|
| `pod-bg` | `#0f1117` | Page background |
| `pod-surface` | `#1a1d27` | Card/panel background |
| `pod-border` | `#2a2d37` | Borders, dividers |
| `pod-accent` | `#3b82f6` | Primary accent (blue) |
| `pod-green` | `#22c55e` | Profitable, long, success |
| `pod-red` | `#ef4444` | Loss, short, error |
| `pod-amber` | `#f59e0b` | Warning, pending |

## WebSocket Connection

- Connects to `VITE_WS_URL` environment variable (or `ws://localhost:8787/ws` in dev)
- Automatic reconnection with exponential backoff (1s base, 30s max)
- Connection status indicator in sidebar (green dot = connected)
- All events are dispatched through Zustand's `handleEvent()` method

## State Management

Zustand store with domain slices:
- `AgentsSlice` — signals array, credibility records
- `FCSlice` — decisions array, latest decision
- `TreasurerSlice` — treasurer state
- `ExecutionSlice` — open + closed trades
- `SavingsSlice` — savings state
- `TaxSlice` — tax reserve state
- `ConnectionSlice` — WebSocket connected flag, event log
- `ControlSlice` — frozen agents set, trading paused flag
