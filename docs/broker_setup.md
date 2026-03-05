# Broker Setup

## IG (FX Spread Betting)

### Why IG?

- FCA-regulated (Financial Conduct Authority)
- Spread betting = tax-free profits in UK
- Comprehensive REST API (v1)
- Free demo account for development
- Low spreads on major FX pairs

### Setup Steps

1. **Create account** at [ig.com](https://www.ig.com/uk)
2. **Open a spread betting account** (not CFD)
3. **Create API key**:
   - Log into My IG → Settings → API key management
   - Generate a new API key
4. **Get demo credentials** for testing:
   - IG provides a separate demo environment
   - API endpoint: `https://demo-api.ig.com/gateway/deal`
5. **Configure in Trading-Pod**:
   - Set `IG_API_KEY`, `IG_USERNAME`, `IG_PASSWORD` as Worker secrets
   - Set `IG_API_URL` (demo or live)

### API Authentication

1. POST `/session` with credentials → receive CST + security token
2. Include both tokens in subsequent request headers:
   - `CST: <cst_token>`
   - `X-SECURITY-TOKEN: <security_token>`
3. Tokens expire — re-authenticate on 401

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/session` | POST | Login, get tokens |
| `/positions/otc` | POST | Open position |
| `/positions/otc/{dealId}` | DELETE | Close position |
| `/positions` | GET | List open positions |
| `/markets/{epic}` | GET | Market info & prices |

### FX Instrument Format

- GBP/USD → `CS.D.GBPUSD.TODAY.IP` (spread bet epic)
- EUR/USD → `CS.D.EURUSD.TODAY.IP`
- Check exact epics via `/markets?searchTerm=GBPUSD`

---

## Capital.com (FX & Crypto CFDs)

### Why Capital.com?

- FCA-regulated
- CFD trading for both FX and crypto
- REST API with OAuth session tokens
- Free demo account for development
- Competitive spreads on major pairs

### Setup Steps

1. **Create account** at [capital.com](https://capital.com)
2. **Open a CFD account**
3. **Generate API credentials**:
   - Capital.com uses email + password + API key authentication
   - Go to Settings → API → generate an API key
4. **Use demo mode first**:
   - API endpoint (demo): `https://demo-api-capital.backend-capital.com`
   - API endpoint (live): `https://api-capital.backend-capital.com`
5. **Configure in Trading-Pod**:
   - Set `CAPITAL_API_KEY`, `CAPITAL_EMAIL`, `CAPITAL_PASSWORD` as Worker secrets

### API Authentication

1. POST `/api/v1/session` with API key, email, password → receive CST + security token
2. Include both tokens in subsequent requests:
   - `CST: <cst_token>`
   - `X-SECURITY-TOKEN: <security_token>`
3. Sessions expire — re-authenticate on 401

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/session` | POST | Login, get tokens |
| `/api/v1/positions` | POST | Open position |
| `/api/v1/positions/{dealId}` | DELETE | Close position |
| `/api/v1/positions` | GET | List open positions |
| `/api/v1/markets/{epic}` | GET | Market info & prices |

---

## OANDA (FX Specialist)

### Why OANDA?

- FCA-regulated (OANDA Europe Ltd)
- FX specialist with tight spreads
- Simple REST v20 API with bearer token auth
- Free practice (demo) account
- Supports FX and limited crypto CFDs

### Setup Steps

1. **Create account** at [oanda.com](https://www.oanda.com)
2. **Create a demo account** first for testing
3. **Generate API token**:
   - My Account → API Access → Generate token
   - Note your Account ID (shown in account list)
4. **Configure in Trading-Pod**:
   - Set `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID` as Worker secrets
   - API endpoint (demo): `https://api-fxpractice.oanda.com`
   - API endpoint (live): `https://api-fxtrade.oanda.com`

### API Authentication

Bearer token in Authorization header:
```
Authorization: Bearer <OANDA_API_TOKEN>
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v3/accounts/{id}/orders` | POST | Place order |
| `/v3/accounts/{id}/trades` | GET | List open trades |
| `/v3/accounts/{id}/trades/{id}/close` | PUT | Close trade |
| `/v3/instruments/{instrument}/candles` | GET | Price data |
| `/v3/accounts/{id}` | GET | Account summary |

### FX Instrument Format

- GBP/USD → `GBP_USD`
- EUR/USD → `EUR_USD`
- BTC/USD → `BTC_USD`

---

## Environment Variables (Worker Secrets)

```bash
# IG
wrangler secret put IG_API_KEY
wrangler secret put IG_USERNAME
wrangler secret put IG_PASSWORD
wrangler secret put IG_API_URL  # https://demo-api.ig.com/gateway/deal

# Capital.com
wrangler secret put CAPITAL_API_KEY
wrangler secret put CAPITAL_EMAIL
wrangler secret put CAPITAL_PASSWORD

# OANDA
wrangler secret put OANDA_API_TOKEN
wrangler secret put OANDA_ACCOUNT_ID

# TradingView
wrangler secret put TRADINGVIEW_WEBHOOK_SECRET
```

## Broker Selection

Trading-Pod supports **configurable broker selection per asset class**. From the dashboard Settings panel, you can choose which broker handles FX and which handles crypto. The selection is stored in KV and respected by `selectBrokerForAsset()`.

Default broker preferences:
- FX → Capital.com
- Crypto → Capital.com

You can override these to use IG for FX (tax-free spread betting) or OANDA for either.

## Paper Trading Mode

Trading-Pod ships in **paper mode by default** (`TRADING_MODE=paper` in `wrangler.jsonc`). In this mode:

- `selectBrokerForAsset()` returns `MockBrokerAdapter` regardless of asset class
- No real orders are placed on any broker
- The full FC pipeline, risk checks, capital gating, and event broadcasting still run
- Perfect for end-to-end testing with real market signals

To switch to live trading:
1. Set `TRADING_MODE` to `"live"` in each worker's `wrangler.jsonc`
2. Ensure broker API secrets are configured (see above)
3. Re-deploy the affected workers

> ⚠️ **Start with demo broker accounts** (IG demo, Capital.com demo, OANDA practice) before going fully live.
