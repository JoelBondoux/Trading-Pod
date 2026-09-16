# Local development checklist

This installs and tests the foundation. It does not connect a broker, deploy services or start trading.

## 1. Toolchain and checks

Use Node 20+ and pnpm 9.15.4, pinned by packageManager.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
corepack pnpm -r typecheck
corepack pnpm test
```

The global pnpm in some environments can be newer; use these explicit Corepack commands. Build first so referenced TypeScript declarations exist. Worker sources are included in type checks; CI also bundles the dashboard.

## 2. Dashboard identity

Configure a Google web OAuth client with the exact local/deployed JavaScript origin. The public client ID must match on both frontend and FC server.

- Dashboard ignored .env.local: VITE_GOOGLE_CLIENT_ID and VITE_API_URL (default /api).
- FC wrangler vars: GOOGLE_CLIENT_ID, DASHBOARD_ORIGIN (http://localhost:3000 locally), TRADING_MODE=RESEARCH.
- FC ignored .dev.vars: DASHBOARD_ALLOWED_SUBJECTS, plus INTERNAL_SERVICE_SECRET if testing internal endpoints.

Use already verified Google subject IDs in the server allowlist. See [security](security.md). Do not supply credentials in chat, disable verification or add a browser-side email allowlist.

Missing identity configuration leaves the UI locked and the dashboard API returns 503. In-service secrets and account IDs are never frontend variables.

## 3. Local services

From separate terminals:

```bash
corepack pnpm --filter @trading-pod/fc-worker exec wrangler dev --port 8788
corepack pnpm --filter @trading-pod/dashboard dev
```

Vite serves port 3000 and proxies /api to port 8788. Existing D1/KV/service bindings need local Wrangler configuration if you use historical/internal APIs. The new identity/status routes do not read these storage bindings.

Do not run the root migration/upgrade deployment helpers as an installation step; they are inherited and not the practice runtime provisioning workflow.

## 4. Expected outcomes

| Check                            | Expected                                        |
| -------------------------------- | ----------------------------------------------- |
| Missing Google frontend config   | Login/configuration screen, no dashboard access |
| Missing server subject allowlist | Dashboard API 503                               |
| Invalid/forged identity          | 401/403                                         |
| Valid configured identity        | Read-only status and PAUSED                     |
| FC health with TRADING_MODE=live | 503, LIVE_LOCKED                                |
| Attempt to resume                | 409                                             |
| Valid FX signal to FC            | 503, accepted=false                             |
| Non-FX signal                    | 400                                             |
| Capital request                  | 503, approved=false                             |
| Legacy /ws                       | 410                                             |
| OANDA connection                 | Unavailable in this milestone                   |

The OANDA v20 practice connection, transactional ledger and order lifecycle are the next milestones, not further setup switches.
