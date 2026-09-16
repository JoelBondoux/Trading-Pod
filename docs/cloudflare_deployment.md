# Deployment notes

**This foundation PR does not deploy anything.** The existing Cloudflare layout is retained for development, while the always-running practice executor and operational database remain to be implemented.

## Retained components

The repository has FC, Treasurer, Savings, Webhook and Event Stream workers plus a React dashboard. FC now exposes a small server-verified dashboard API. The event stream is retired until per-user sessions exist. D1/KV data is not an operational risk ledger.

## Future deployment configuration

| Location                         | Configuration                                             |
| -------------------------------- | --------------------------------------------------------- |
| Dashboard public build variables | VITE_GOOGLE_CLIENT_ID, VITE_API_URL                       |
| FC public worker vars            | GOOGLE_CLIENT_ID, DASHBOARD_ORIGIN, TRADING_MODE=RESEARCH |
| FC server-only allowlist         | DASHBOARD_ALLOWED_SUBJECTS                                |
| Internal workers' secret stores  | INTERNAL_SERVICE_SECRET                                   |
| Broker credentials               | None in this release                                      |

Use HTTPS and one exact dashboard Origin for any deployed API. Remove legacy browser secret variables. If a previous build included service secrets, rotate them and retire the old build during the authorised deployment. No secret rotation is implied by a source change.

Cloudflare configuration files still contain placeholder resource IDs. Provisioning, migrations, hostnames and paid resources need an explicit implementation/deployment task. Do not copy old live-mode instructions from repository history.

## Verification gate

Run frozen install, recursive build, typecheck and tests. Exercise identity denial, missing configuration, locked controls and browser sign-in on the configured host. Verify no broker/secret material appears in public assets or logs.

CI performs build/check/test work only. It must not provision infrastructure, deploy, arm a practice account, send orders or enable a live environment.

The eventual execution daemon requires durable state and reconciliation across restarts, health monitoring and backups. A dashboard worker deployment does not satisfy that requirement.
