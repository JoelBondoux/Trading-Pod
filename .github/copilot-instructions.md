# Trading-Pod — Copilot Instructions

## Documentation Rule

**Before committing any code changes, always update all affected documentation.**

This includes but is not limited to:

- `README.md` — project overview, tech stack table, mermaid diagram, test counts, cost table
- `docs/architecture.md` — system components, data flow, test counts
- `docs/broker_setup.md` — broker API references, environment variables, setup steps
- `docs/install_checklist.md` — step-by-step install guide, verification table, test counts
- `docs/dashboard_design.md` — panel descriptions, auth flow, theme tokens
- `docs/uk_tax_model.md` — tax rules, currency conversion details
- `docs/security.md` — threat model, secrets management, endpoint matrix
- `docs/safety_model.md` — defence-in-depth layers, "what cannot happen" table
- `docs/cloudflare_deployment.md` — worker deployment, secrets commands, service bindings
- `docs/tradingview_setup.md` — webhook format, testing commands
- `docs/credibility_learning.md` — EMA formula, consensus computation
- `docs/agent_protocols.md` — signal agent interface, market data schema

### What to check

1. **References to removed/renamed components** — grep all `.md` files for stale names
2. **Test counts** — update every mention of test count / test file count after adding or removing tests
3. **Broker names** — current brokers are IG, Capital.com, OANDA (no Kraken)
4. **Environment variables / secrets** — keep secret lists consistent across docs
5. **New features** — if adding a new panel, auth flow, or config option, document it in the relevant doc(s)

### Workflow

1. Make code changes
2. Build and run tests to confirm everything passes
3. Search all markdown files for stale references (`grep_search` across `**/*.md`)
4. Update every affected doc
5. Commit code + docs together
