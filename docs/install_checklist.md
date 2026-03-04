# 🚀 Trading-Pod — Beginner Install Checklist

A step-by-step guide to go from zero to a running Trading-Pod. Tick each box as you go.

---

## Phase 1 — Install Developer Tools

> You only need to do this once on your machine.

- [ ] **Install Node.js 20+**
  - Download from [nodejs.org](https://nodejs.org/) (LTS version)
  - Verify: open a terminal and run `node --version` — should show `v20.x.x` or higher

- [ ] **Install pnpm**
  - In your terminal run: `npm install -g pnpm@9`
  - Verify: `pnpm --version` — should show `9.x.x`

- [ ] **Install Git**
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify: `git --version`

- [ ] **Install a code editor**
  - Recommended: [VS Code](https://code.visualstudio.com/)

---

## Phase 2 — Clone & Install the Project

- [ ] **Clone the repo**
  ```bash
  git clone https://github.com/JoelBondoux/Trading-Pod.git
  cd Trading-Pod
  ```

- [ ] **Install all dependencies**
  ```bash
  pnpm install
  ```
  This reads `pnpm-workspace.yaml` and installs dependencies for every package at once.

- [ ] **Build the shared package** (other packages depend on it)
  ```bash
  pnpm --filter @trading-pod/shared build
  pnpm --filter @trading-pod/agents build
  ```

- [ ] **Verify everything compiles**
  ```bash
  pnpm -r typecheck
  ```
  ✅ You should see all 9 packages say `Done` with no errors.

- [ ] **Run the test suite**
  ```bash
  pnpm test
  ```
  ✅ You should see 263 tests pass across 21 test files.

- [ ] **Copy the environment template**

  **PowerShell (recommended on Windows):**
  ```powershell
  Copy-Item .env.example .env
  Copy-Item packages/dashboard/.env.example packages/dashboard/.env
  ```

  **CMD (Windows):**
  ```cmd
  copy .env.example .env
  copy packages\dashboard\.env.example packages\dashboard\.env
  ```

  **macOS / Linux:**
  ```bash
  cp .env.example .env
  cp packages/dashboard/.env.example packages/dashboard/.env
  ```

  Edit the `.env` files to fill in your values. These files are git-ignored.

---

## Phase 3 — Run the Dashboard Locally

> This gives you the React dashboard on your machine — no cloud needed yet.

- [ ] **Start the dev server**
  ```bash
  pnpm --filter @trading-pod/dashboard dev
  ```

- [ ] **Open in browser**
  - Go to [http://localhost:3000](http://localhost:3000)
  - You should see the Trading-Pod dashboard with a dark theme
  - The "Disconnected" indicator is normal — the WebSocket backend isn't deployed yet

---

## Phase 4 — Set Up Cloudflare (Free Tier)

> This is where the backend runs. Everything below is free.

- [ ] **Create a Cloudflare account**
  - Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
  - Free plan is sufficient

- [ ] **Install the Wrangler CLI**
  ```bash
  npm install -g wrangler
  ```

- [ ] **Log in to Cloudflare from your terminal**
  ```bash
  npx wrangler login
  ```
  A browser window opens — click "Allow".

- [ ] **Create the D1 database**
  ```bash
  npx wrangler d1 create trading-pod-db
  ```
  📝 **Write down the `database_id`** from the output — you'll need it next.

- [ ] **Update the database ID in wrangler configs**
  Open each of these files and replace `YOUR_D1_DATABASE_ID` with your actual ID:
  - `packages/backend/fc-worker/wrangler.jsonc`
  - `packages/backend/treasurer-worker/wrangler.jsonc`
  - `packages/backend/savings-worker/wrangler.jsonc`

- [ ] **Apply the database schema**
  
  Preview what will run first:
  ```bash
  node scripts/migrate-d1.mjs --dry-run
  ```
  ✅ You should see 16 statements (9 CREATE TABLE + 7 CREATE INDEX).

  Then apply to production:
  ```bash
  node scripts/migrate-d1.mjs
  ```
  ✅ You should see `Migration complete: 16 succeeded, 0 failed`.

  For local development, use:
  ```bash
  node scripts/migrate-d1.mjs --local
  ```

- [ ] **Create the KV namespace**
  ```bash
  npx wrangler kv namespace create TRADING_POD_KV
  ```
  📝 **Write down the `namespace id`** from the output.

- [ ] **Update the KV namespace ID in wrangler configs**
  Open these files and replace `YOUR_KV_NAMESPACE_ID` with your actual ID:
  - `packages/backend/fc-worker/wrangler.jsonc`
  - `packages/backend/webhook-worker/wrangler.jsonc`

- [ ] **Seed the KV with default config**
  Replace `<id>` with your KV namespace ID:
  ```bash
  npx wrangler kv key put --namespace-id=<id> "config:risk_rules" "{\"minRewardRiskRatio\":1.5,\"maxStopLossPercent\":3.0,\"minStopLossPercent\":0.1,\"maxTradesPerDay\":5,\"minConfidence\":0.6,\"blockedRegimes\":[\"volatile\"],\"newsBlockWindowMinutes\":30}"
  ```
  ```bash
  npx wrangler kv key put --namespace-id=<id> "config:webhook_secret" "\"change-me-to-a-real-secret\""
  ```

---

## Phase 5 — Deploy the Backend Workers

> Deploy all 5 workers to Cloudflare's edge network.

- [ ] **Deploy FC worker**
  ```bash
  cd packages/backend/fc-worker
  npx wrangler deploy
  cd ../../..
  ```

- [ ] **Deploy Treasurer worker**
  ```bash
  cd packages/backend/treasurer-worker
  npx wrangler deploy
  cd ../../..
  ```

- [ ] **Deploy Savings worker**
  ```bash
  cd packages/backend/savings-worker
  npx wrangler deploy
  cd ../../..
  ```

- [ ] **Deploy Webhook worker**
  ```bash
  cd packages/backend/webhook-worker
  npx wrangler deploy
  cd ../../..
  ```

- [ ] **Deploy Event Stream worker** (WebSocket server)
  ```bash
  cd packages/backend/event-stream-worker
  npx wrangler deploy
  cd ../../..
  ```

- [ ] **Note your worker URLs**
  After each deploy, Wrangler prints a URL like:
  ```
  https://fc-worker.your-subdomain.workers.dev
  ```
  📝 Write these down — you'll need the event-stream-worker URL for the dashboard.

- [ ] **Set worker secrets**
  ```bash
  # Internal service secret (same value on ALL workers)
  wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-fc
  wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-treasurer
  wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-savings
  wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-event-stream
  wrangler secret put INTERNAL_SERVICE_SECRET --name trading-pod-webhook

  # Dashboard token (event-stream worker only)
  wrangler secret put DASHBOARD_TOKEN --name trading-pod-event-stream
  ```

> ⚠️ **Paper mode is ON by default.** The `TRADING_MODE` variable in each worker's `wrangler.jsonc` is set to `"paper"`. All orders go through `MockBrokerAdapter`. Set to `"live"` only when you are ready to trade with real money.

---

## Phase 6 — Deploy the Dashboard

- [ ] **Build the dashboard**
  ```bash
  pnpm --filter @trading-pod/dashboard build
  ```

- [ ] **Create a Cloudflare Pages project**
  ```bash
  npx wrangler pages project create trading-pod-dashboard
  ```

- [ ] **Deploy to Pages**
  ```bash
  npx wrangler pages deploy packages/dashboard/dist
  ```

- [ ] **Set the WebSocket URL**
  - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → `trading-pod-dashboard` → Settings → Environment Variables
  - Add: `VITE_WS_URL` = `wss://event-stream-worker.your-subdomain.workers.dev/ws`
  - Re-deploy after setting the variable

---

## Phase 7 — Set Up Broker Accounts (When Ready to Trade)

> ⚠️ **Start with demo/paper accounts first!** Don't connect real money until you're confident.

### IG (FX Spread Betting — Tax-Free)

- [ ] **Create an IG account** at [ig.com/uk](https://www.ig.com/uk)
- [ ] **Open a spread betting account** (not CFD — spread betting profits are tax-free in UK)
- [ ] **Generate an API key**: My IG → Settings → API key management
- [ ] **Use demo mode first**: IG provides a demo environment for testing
- [ ] **Store secrets in the FC worker**:
  ```bash
  cd packages/backend/fc-worker
  npx wrangler secret put IG_API_KEY
  npx wrangler secret put IG_USERNAME
  npx wrangler secret put IG_PASSWORD
  cd ../../..
  ```
  (You'll be prompted to type/paste each value)

### Kraken (Crypto Spot)

- [ ] **Create a Kraken account** at [kraken.com](https://www.kraken.com)
- [ ] **Complete KYC** (identity verification — required by UK regulations)
- [ ] **Generate an API key**: Settings → Security → API
  - ✅ Enable: "Create/Modify Orders", "Query Orders & Trades"
  - ❌ **Do NOT enable** "Withdraw Funds" (safety measure)
- [ ] **Store secrets**:
  ```bash
  cd packages/backend/fc-worker
  npx wrangler secret put KRAKEN_API_KEY
  npx wrangler secret put KRAKEN_API_SECRET
  cd ../../..
  ```

---

## Phase 8 — Set Up TradingView Webhooks (Optional)

> Only needed if you want TradingView alerts to feed into the system.

- [ ] **Get a TradingView paid plan** (~$13/month — Essential plan or higher)
  - Webhooks are not available on the free plan
- [ ] **Create an alert on a chart**
  1. Add your indicator/strategy to a chart
  2. Click the "Alerts" bell → "Create Alert"
  3. Under Notifications → enable "Webhook URL"
  4. Set URL: `https://webhook-worker.your-subdomain.workers.dev/webhook/tradingview`
  5. Set message body (see [tradingview_setup.md](tradingview_setup.md) for the JSON format)
- [ ] **Update the webhook secret**
  - Make sure the `secret` field in your TradingView alert matches the one in KV (`config:webhook_secret`)

---

## ✅ Verification Checklist

Once everything is deployed, confirm each piece is working:

| Check | How to Verify |
|-------|--------------|
| Dashboard loads | Visit your Cloudflare Pages URL |
| WebSocket connects | Green dot in dashboard sidebar says "Connected" |
| Webhook accepts signals | `curl -X POST https://webhook-worker.…/webhook/tradingview -H "Content-Type: application/json" -d '{"secret":"your-secret","ticker":"GBPUSD","action":"buy","price":1.265,"stopLoss":1.26,"takeProfit":1.275,"confidence":0.75,"holdingTimeMinutes":240,"justification":"Test","assetClass":"fx","agentId":"test"}'` — should return 200 |
| D1 is storing data | `npx wrangler d1 execute trading-pod-db --command="SELECT count(*) FROM trades"` |
| Workers are healthy | Cloudflare Dashboard → Workers & Pages → check each worker shows "Active" |

---

## 💰 Monthly Cost Summary

| Service | Cost |
|---------|------|
| TradingView Essential | ~$13/mo (only if using webhooks) |
| Cloudflare (Workers, D1, KV, Pages) | **Free** |
| IG account | **Free** (spreads only) |
| Kraken account | **Free** (commission on trades) |
| GitHub | **Free** |
| **Total** | **$0 – $13/mo** |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests fail | Run `pnpm test` — check error output for details |
| `pnpm: command not found` | Run `npm install -g pnpm@9` |
| `wrangler: command not found` | Run `npm install -g wrangler` |
| Typecheck fails on `shared` | Make sure you ran `pnpm --filter @trading-pod/shared build` first |
| Typecheck fails on `agents`/`core` | Build shared first, then agents: `pnpm --filter @trading-pod/agents build` |
| Dashboard shows "Disconnected" | The event-stream-worker isn't deployed yet, or `VITE_WS_URL` is wrong |
| `D1_ERROR: no such table` | You forgot to run the schema: `npx wrangler d1 execute trading-pod-db --file=packages/backend/d1-schema.sql` |
| Worker deploy fails with binding error | Check that `database_id` and `kv_namespace_id` are set correctly in `wrangler.jsonc` |
| TradingView webhook returns 401 | Your `secret` in the alert body doesn't match `config:webhook_secret` in KV |
| TradingView webhook returns 403 | The request isn't coming from a TradingView IP — check the IP whitelist |

---

## 📚 Further Reading

- [Architecture](architecture.md) — how the system fits together
- [Safety Model](safety_model.md) — all the guardrails that protect your capital
- [UK Tax Model](uk_tax_model.md) — how FX and crypto taxes work
- [Broker Setup](broker_setup.md) — detailed IG and Kraken API reference
- [Cloudflare Deployment](cloudflare_deployment.md) — advanced deployment details
- [TradingView Setup](tradingview_setup.md) — webhook JSON format and testing
