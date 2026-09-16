# Development status

## Foundation milestone — September 2026

Based on repository commit `56eb8001f2a3e28c337fbf08654caca445d52e1f`. The original 272 tests passed before integration changes.

Implemented:

- A shared, validated runtime contract and narrow FX ingress schemas.
- Unconditional paused execution across HTTP controls, capital responses and legacy broker selection.
- Fixed OANDA practice endpoint constants and rejection of direct live adapter construction.
- Server-side Google signature/claim verification with a required subject allowlist and exact-origin read-only API.
- Memory-only dashboard identity, expiry/sign-out handling and validated status polling.
- Removal of browser service secrets, unverified stored login, editable broker/live controls and shared-token WebSockets.
- Regression tests with locally generated RSA signatures and worker request fixtures; no Google credentials or broker calls.
- Updated setup/security documentation and build-before-typecheck CI ordering.

This is a reviewable foundation, not a completed P1 deployment or an autonomous trader. Server sessions/roles, authoritative mutable controls, deployment hardening and full configured browser integration are still outstanding. Runtime broker writes remain absent.

Local verification now includes the collector slice below: frozen dependency install, recursive build and typecheck; **414 tests across 28 files pass**, including 90 collector tests. The foundation's FC worker also bundled successfully with Wrangler's local `deploy --dry-run` (no deployment). Browser/in-account integration limitations are listed below.

## P2 first slice — read-only OANDA observations

Implemented in a separate `@trading-pod/oanda-readonly` Node package:

- Fixed practice-host GET requests for full account snapshots, eligible FX metadata, prices/home conversions and bounded transaction ranges. Redirects and custom URLs are refused; HTTP bodies and exceptions cannot leak into diagnostic output.
- Expected account/currency validation, canonical FX selection, exact decimal strings/large IDs, and quality flags for stale, future, halted, illiquid, crossed or unconvertible quotes. Existing outside-universe and hedged exposure remains visible.
- A private local observation archive that atomically commits transaction data and checkpoints, replays committed history on restart, enforces exclusive writers and detects malformed/mismatched history. Hard-crash locks require operator verification; it never guesses that a lock is stale.
- Explicit first-observation baselines, unfiltered subsequent transactions, bounded catch-up and no checkpoint jumps to a newer response cursor. Storage limits stop collection before unbounded growth.
- A one-shot/watch CLI with private environment configuration, bounded retries and a [setup/recovery runbook](oanda_observer.md). It does not update dashboard broker status or implement any trading operation.
- CI setup correction: pnpm/action-setup now uses the existing exact packageManager pin, resolving the conflicting workflow version that stopped the first remote run before installation.

This does not complete P2: actual account commissioning, hosted outage/restart soak, streaming, PostgreSQL operational storage and transaction-to-account economic reconciliation remain outstanding. The local archive deliberately has no execution authority. Saturday 09:00 Europe/London reporting remains the schedule contract; a trade-report service is not implemented yet.

## Next milestones and acceptance gates

| Milestone    | Deliverable                                                        | Gate before progression                                                                                                                              |
| ------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 remainder | Secure deployment/session boundary and operational controls design | Revocable sessions/roles, secret migration, exact-origin browser integration, durable control ownership                                              |
| P2           | Read-only OANDA practice adapter and operational ledger            | Account identity/currency, allowed instrument metadata, fresh prices, transaction checkpoints, restart/reconnect reconciliation                      |
| P3           | Risk sizing and complete practice trade lifecycle                  | Atomic reservations, bounded costs/conversions/exposure, durable intents, unknown outcome handling, confirmed stops and exits, fault-injection tests |
| P4           | Research registry and shadow pipeline                              | Frozen strategy/data versions, all trials counted, costs, chronological validation, sealed holdout and leakage audit                                 |
| P5           | Dashboard, reporting and operational soak                          | Account-derived charts/status, restart recovery, incident controls, weekend report correctness                                                       |
| P6           | Positioning/macro/AI experiments                                   | Licensed point-in-time data; prospective component comparisons against a price-only baseline                                                         |
| P7           | Evidence review                                                    | Adequate independent forward observations and predeclared validation criteria; no automatic live promotion                                           |

Each milestone should be a small reviewed PR with a clear test gate. No changes here deploy, provision paid services, create broker orders or enable live money.

## Weekend review contract

Saturday at **09:00 Europe/London**, allowing for GMT/BST. The review covers the completed trading week, data gaps and incidents, versioned strategy results after costs, exposure/drawdown, and proposed adjustments before the next trading week. “No data” must be reported when no forward evidence exists. Calendar/holiday closing times and OANDA transaction reconciliation determine the final weekly cut-off; a missing close reconciliation must be flagged.

This repository currently contains the schedule contract, not a scheduler/reporting daemon. The separately configured project-review reminder can report development progress in the meantime. Strategy changes are proposed for review; the report cannot edit policy, execute code or place trades.

## Integration limitations

OANDA account connection and tokens have not been configured. Google signature verification is tested with generated fixtures, not a real user's token. Local preview encountered environment network-interface/browser restrictions, so configured sign-in and visual regression verification remain outstanding. No infrastructure has been deployed.

The retained mock engine's prices, position sizing and P&L assumptions are prototype behaviour only. Do not present those outputs as forward results, usable execution prices or verified strategy performance.

The pre-existing dependency update [PR #2](https://github.com/JoelBondoux/Trading-Pod/pull/2) remains separate. Resolve dependency security updates and deployment hardening before exposing a development server or commissioning the service.
