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

## Kraken (Crypto Spot)

### Why Kraken?

- Long-standing exchange with good UK regulatory status
- Spot trading only (no crypto CFDs for UK retail — FCA ban)
- REST API with HMAC-SHA512 authentication
- No minimum deposit
- Reasonable maker/taker fees

### Setup Steps

1. **Create account** at [kraken.com](https://www.kraken.com)
2. **Complete KYC** (identity verification required)
3. **Generate API key**:
   - Settings → Security → API
   - Create key with "Create/Modify Orders" + "Query Open Orders & Trades" + "Query Closed Orders & Trades" permissions
   - **Do NOT enable "Withdraw Funds"** permission
4. **Configure in Trading-Pod**:
   - Set `KRAKEN_API_KEY`, `KRAKEN_API_SECRET` as Worker secrets

### API Authentication

```
nonce = current Unix timestamp in milliseconds
signature = HMAC-SHA512(
  urlPath + SHA256(nonce + POST_data),
  base64Decode(API_SECRET)
)

Headers:
  API-Key: <api_key>
  API-Sign: <signature>
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/0/public/Ticker` | GET | Current prices |
| `/0/private/AddOrder` | POST | Place order |
| `/0/private/CancelOrder` | POST | Cancel order |
| `/0/private/OpenOrders` | POST | List open orders |
| `/0/private/TradesHistory` | POST | Trade history |
| `/0/private/Balance` | POST | Account balance |

### Crypto Pair Format

- BTC/GBP → `XBTGBP`
- ETH/GBP → `ETHGBP`
- Use `/0/public/AssetPairs` to discover exact pair names

---

## Environment Variables (Worker Secrets)

```bash
# IG
wrangler secret put IG_API_KEY
wrangler secret put IG_USERNAME
wrangler secret put IG_PASSWORD
wrangler secret put IG_API_URL  # https://demo-api.ig.com/gateway/deal

# Kraken
wrangler secret put KRAKEN_API_KEY
wrangler secret put KRAKEN_API_SECRET

# TradingView
wrangler secret put TRADINGVIEW_WEBHOOK_SECRET
```

## Paper Trading Mode

Trading-Pod ships in **paper mode by default** (`TRADING_MODE=paper` in `wrangler.jsonc`). In this mode:

- `selectBrokerForAsset()` returns `MockBrokerAdapter` regardless of asset class
- No real orders are placed on IG or Kraken
- The full FC pipeline, risk checks, capital gating, and event broadcasting still run
- Perfect for end-to-end testing with real market signals

To switch to live trading:
1. Set `TRADING_MODE` to `"live"` in each worker's `wrangler.jsonc`
2. Ensure broker API secrets are configured (see above)
3. Re-deploy the affected workers

> ⚠️ **Start with demo broker accounts** (IG demo environment, Kraken with small balance) before going fully live.
