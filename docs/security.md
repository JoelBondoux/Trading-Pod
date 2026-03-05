# Security Model

Trading-Pod is designed so that **no third party can access funds, execute trades, or exfiltrate data**. This document describes the security architecture and every hardening measure in place.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Attacker injects fake trading signals | All internal workers require `INTERNAL_SERVICE_SECRET` header — public requests are rejected with 403 |
| Attacker reads trade decisions / capital state | All `GET` endpoints on internal workers require auth — no data is exposed publicly |
| Attacker connects to WebSocket event stream | WebSocket upgrade requires `DASHBOARD_TOKEN` as query parameter |
| Attacker broadcasts fake events to dashboard | `/broadcast` endpoint requires `INTERNAL_SERVICE_SECRET` |
| Attacker sends crafted webhooks | Webhook worker validates shared secret in payload + blocks non-TradingView IPs by default |
| Broker API keys leaked in errors | Error messages are generic — no credentials, no partial keys, no internal details |
| Attacker discovers worker URLs | Even with the URL, all endpoints (except `/health`) return 403 without valid auth |
| Compromised dependency | CI runs `pnpm audit` + TruffleHog secret scanning on every push/PR |
| Operator loses dashboard connection | Pause/freeze state is stored server-side in KV — persists independently of dashboard |
| Accidental live trading | Paper mode (`TRADING_MODE=paper`) is the default — all orders go through MockBrokerAdapter |
| Losing streak drains capital | Circuit breaker auto-halts after 3 consecutive losses or 5% daily drawdown |

## Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERNET                               │
│                                                             │
│  TradingView ──webhook secret──▶ Webhook Worker             │
│                                   + IP allowlist            │
│                                   + payload secret          │
│                                        │                    │
│  Dashboard ──DASHBOARD_TOKEN──▶ Event Stream /ws            │
│                                                             │
│  Anyone ──▶ /health (public, no sensitive data)             │
│  Anyone ──▶ all other routes → 403 Forbidden                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  INTERNAL (Service Bindings)                 │
│                                                             │
│  Webhook ──X-Internal-Secret──▶ FC Worker                   │
│  FC      ──X-Internal-Secret──▶ Treasurer Worker            │
│  FC      ──X-Internal-Secret──▶ Event Stream /broadcast     │
│  FC      ──X-Internal-Secret──▶ Savings Worker              │
│                                                             │
│  All inter-worker calls carry INTERNAL_SERVICE_SECRET       │
│  Even via service bindings (defence-in-depth)               │
└─────────────────────────────────────────────────────────────┘
```

## Secrets Management

| Secret | Storage | Purpose |
|--------|---------|---------|
| `INTERNAL_SERVICE_SECRET` | `wrangler secret put` | Authenticates worker-to-worker calls |
| `DASHBOARD_TOKEN` | `wrangler secret put` | Authenticates dashboard WebSocket connections |
| `config:webhook_secret` | Cloudflare KV | Validates TradingView webhook payloads |
| IG API credentials | `wrangler secret put` | Never in code, KV, or git |
| Capital.com API credentials | `wrangler secret put` | Never in code, KV, or git |
| OANDA API credentials | `wrangler secret put` | Never in code, KV, or git |

**Rules:**
- Secrets are NEVER stored in code, `.env` files committed to git, or KV
- `.env`, `.env.*`, `.dev.vars` are in `.gitignore`
- Error messages NEVER contain credentials or partial keys
- CI runs TruffleHog secret scanning on every push

## Setting Up Secrets

After deploying workers, set the required secrets:

```bash
# Internal service secret (same value on ALL workers)
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-fc
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-treasurer
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-savings
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-event-stream
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-webhook

# Dashboard token (event-stream worker only)
wrangler secret put DASHBOARD_TOKEN --name trading-pod-event-stream

# Webhook secret (stored in KV, used by webhook worker)
# Set via Cloudflare dashboard or wrangler KV put
```

Generate strong secrets:
```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

## Endpoint Security Matrix

| Worker | Endpoint | Method | Auth | Public? |
|--------|----------|--------|------|---------|
| webhook | `/webhook/tradingview` | POST | Payload secret + IP allowlist | Semi (TradingView only) |
| webhook | `/health` | GET | None | Yes (no sensitive data) |
| fc | `/signals` | POST | `X-Internal-Secret` | No |
| fc | `/decisions` | GET | `X-Internal-Secret` | No |
| fc | `/decisions/:id` | GET | `X-Internal-Secret` | No |
| fc | `/state/paused` | GET/PUT | `X-Internal-Secret` | No |
| fc | `/state/freeze` | PUT | `X-Internal-Secret` | No |
| fc | `/health` | GET | None | Yes |
| treasurer | `/capital/request` | POST | `X-Internal-Secret` | No |
| treasurer | `/capital/return` | POST | `X-Internal-Secret` | No |
| treasurer | `/state` | GET | `X-Internal-Secret` | No |
| treasurer | `/health` | GET | None | Yes |
| savings | `/deposit` | POST | `X-Internal-Secret` | No |
| savings | `/state` | GET | `X-Internal-Secret` | No |
| savings | `/health` | GET | None | Yes |
| event-stream | `/ws` | WS | `?token=DASHBOARD_TOKEN` | No |
| event-stream | `/broadcast` | POST | `X-Internal-Secret` | No |
| event-stream | `/status` | GET | `X-Internal-Secret` | No |
| event-stream | `/health` | GET | None | Yes |
| dashboard | SPA | - | None (read-only display) | Yes |

## Error Handling

All workers return **generic error responses** to external callers:

```json
{ "error": "Internal server error" }
```

Full error details are logged server-side via the **structured JSON logger** (`createLogger`). Each log entry includes a `correlationId` for tracing requests across workers. Logs are visible in Cloudflare Workers logs but never exposed to callers.

## IP Allowlisting

The webhook worker blocks requests from non-TradingView IPs by default. TradingView's known egress IPs:

- `52.89.214.238`
- `34.212.75.30`
- `54.218.53.128`
- `52.32.178.7`

To disable IP blocking (e.g., for testing), set in KV:
```
config:enforce_ip_allowlist = "false"
```

## Server-Side Controls

Trading pause and agent freeze states are stored in Cloudflare KV, checked by the FC worker on every incoming signal:

| KV Key | Type | Effect |
|--------|------|--------|
| `state:trading_paused` | `"true"` / `"false"` | FC returns 503 for all signals when `"true"` |
| `state:frozen_agents` | JSON string array | FC silently drops signals from listed agent IDs |

These persist independently of the dashboard — even if the browser closes, the state holds.

## What CANNOT Happen

| Scenario | Prevention |
|----------|-----------|
| External party executes a trade | All trade paths require `INTERNAL_SERVICE_SECRET` |
| External party reads trade data | All data endpoints require auth |
| External party monitors events | WebSocket requires `DASHBOARD_TOKEN` |
| External party injects fake events | `/broadcast` requires `INTERNAL_SERVICE_SECRET` |
| Broker keys leaked in logs | Error messages are sanitised — no credential material |
| Secret committed to git | `.gitignore` excludes `.env*`; CI runs TruffleHog |
| Malicious dependency | `pnpm audit` in CI; `--frozen-lockfile` prevents supply chain tampering |
| Dashboard controls bypassed | Pause/freeze enforced server-side in FC worker, not client-side |
| Live trading without intent | Paper mode is default; must explicitly set `TRADING_MODE=live` |
| Cascading losses | Circuit breaker halts trading after 3 consecutive losses or 5% drawdown |

## Self-Upgrade Security

The `pnpm upgrade` / `node scripts/upgrade.mjs` command:
- Only pulls from `origin` (your own GitHub repo)
- Never touches `.env`, `.dev.vars`, or wrangler secrets
- Never modifies KV or D1 data
- Runs typecheck after pull — fails loudly if types break
- Provides rollback command if anything goes wrong
- Configuration in KV/D1 is completely independent of code upgrades
