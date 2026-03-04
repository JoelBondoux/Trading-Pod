# Cloudflare Deployment

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- `pnpm` installed

## Architecture

```
Cloudflare Edge
├── Workers (5 services)
│   ├── fc-worker          — Signal processing + FC decisions
│   ├── treasurer-worker   — Capital allocation
│   ├── savings-worker     — Savings vault
│   ├── webhook-worker     — TradingView webhook ingestion
│   └── event-stream-worker — Durable Object WebSocket hub
├── D1 Database            — All transactional data
├── KV Namespace           — Read-heavy config
└── Pages                  — React dashboard SPA
```

## Step-by-Step Deployment

### 1. Login to Cloudflare

```bash
npx wrangler login
```

### 2. Create D1 Database

```bash
npx wrangler d1 create trading-pod-db

# Note the database_id from output, update wrangler.jsonc files
```

### 3. Apply D1 Schema

Use the migration script (recommended):
```bash
node scripts/migrate-d1.mjs
```

Or manually:
```bash
npx wrangler d1 execute trading-pod-db --file=packages/backend/d1-schema.sql
```

For local development: `node scripts/migrate-d1.mjs --local`
For a dry run: `node scripts/migrate-d1.mjs --dry-run`

### 4. Create KV Namespace

```bash
npx wrangler kv namespace create TRADING_POD_KV

# Note the KV namespace id, update wrangler.jsonc files
```

### 5. Seed KV Config

```bash
# Upload default risk rules
npx wrangler kv key put --namespace-id=<id> "config:risk_rules" '{
  "minRewardRiskRatio": 1.5,
  "maxStopLossPercent": 3.0,
  "minStopLossPercent": 0.1,
  "maxTradesPerDay": 5,
  "minConfidence": 0.6,
  "blockedRegimes": ["volatile"],
  "newsBlockWindowMinutes": 30
}'

# Upload webhook secret
npx wrangler kv key put --namespace-id=<id> "config:webhook_secret" '"your-secret-here"'
```

### 6. Deploy Workers

```bash
# Deploy each worker
cd packages/backend/fc-worker && npx wrangler deploy
cd packages/backend/treasurer-worker && npx wrangler deploy
cd packages/backend/savings-worker && npx wrangler deploy
cd packages/backend/webhook-worker && npx wrangler deploy
cd packages/backend/event-stream-worker && npx wrangler deploy
```

### 7. Set Worker Secrets

```bash
# Internal service secret (same value on ALL workers)
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-fc
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-treasurer
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-savings
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-event-stream
wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-webhook

# Dashboard token (event-stream worker only)
wrangler secret put DASHBOARD_TOKEN --name trading-pod-event-stream

# Broker API keys (only on fc-worker)
npx wrangler secret put IG_API_KEY
npx wrangler secret put IG_USERNAME
npx wrangler secret put IG_PASSWORD
npx wrangler secret put KRAKEN_API_KEY
npx wrangler secret put KRAKEN_API_SECRET
```

Generate strong secrets:
```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

### 8. Deploy Dashboard to Pages

```bash
cd packages/dashboard
pnpm build

# Create Pages project
npx wrangler pages project create trading-pod-dashboard

# Deploy
npx wrangler pages deploy dist
```

### 9. Set Dashboard Environment Variables

In Cloudflare Pages dashboard, set:
- `VITE_WS_URL` = `wss://event-stream-worker.<your-subdomain>.workers.dev/ws`

## Free Tier Limits

| Resource | Free Limit | Our Usage |
|----------|-----------|-----------|
| Workers requests | 100K/day | Well within limit |
| D1 reads | 5M/day | Well within limit |
| D1 writes | 100K/day | Well within limit |
| D1 storage | 5 GB | Minimal |
| KV reads | 100K/day | Minimal (config only) |
| KV writes | 1K/day | Minimal (config changes) |
| Durable Objects requests | 1M/month | Moderate |
| Pages deployments | 500/month | Well within limit |

## Service Bindings

Workers communicate via Cloudflare service bindings (zero-latency, no HTTP overhead):

- `webhook-worker` → `fc-worker` (forward TradingView signals)
- `fc-worker` → `treasurer-worker` (capital requests)
- `fc-worker` → `event-stream-worker` (broadcast events)

These are configured in each worker's `wrangler.jsonc`.

## Trading Mode

All workers ship with `TRADING_MODE=paper` by default (set in `wrangler.jsonc` vars). In paper mode, `selectBrokerForAsset()` always returns `MockBrokerAdapter` — no real orders are placed.

To switch to live trading, update the `vars` section in each worker's `wrangler.jsonc`:
```jsonc
"vars": {
  "TRADING_MODE": "live"
}
```

## Structured Logging

All workers use a structured JSON logger (`createLogger` from `@trading-pod/shared`). Each log entry includes:
- `timestamp` — ISO 8601
- `level` — debug/info/warn/error
- `worker` — which worker emitted the log
- `correlationId` — for tracing requests across workers

Logs are visible in the Cloudflare dashboard under Workers → Logs.
