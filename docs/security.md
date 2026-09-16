# Security

## Identity boundary

The dashboard obtains a Google ID token using Google Identity Services. It sends the token only in an Authorization bearer header to the configured FC dashboard API. The token is kept in memory, expires automatically and is removed on sign-out; old unverified sessionStorage data is discarded.

The FC worker uses `jose` and Google's fixed public JWKS endpoint to verify RS256 signatures, the expected client audience, Google issuer, issued-at time, expiry, subject and verified email. Tokens older than one hour are refused. If an authorised-party claim is present it must match the client ID.

Access requires a nonempty server-side `DASHBOARD_ALLOWED_SUBJECTS` list. A subject is Google's stable account identifier; an email or its browser-decoded claims do not grant access. Obtain subject IDs through a trusted, independently verified Google identity/admin process. Do not temporarily allow all accounts to discover them. Missing configuration or a key-fetch failure denies access.

Reference: [Google's verification requirements](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) and [jose](https://github.com/panva/jose).

## Request boundary

- Only /dashboard/session and /dashboard/status accept user tokens. Both are read-only GET endpoints.
- Reject a supplied Origin unless it exactly matches configuration; production must use HTTPS. HTTP is accepted only for localhost/127.0.0.1 development. Same-origin GETs and non-browser requests can omit Origin but still need a verified bearer token; they receive no cross-origin permission.
- CORS allows only the configured origin, GET and the Authorization header. No wildcard, cookies or credentialed CORS.
- No query-string bearer tokens, service secrets from the browser, or general proxy to worker-internal routes.
- Responses use Cache-Control: no-store; verification errors never log raw tokens or identity claims.
- Since these endpoints use explicit bearer headers and no ambient cookie credentials, they expose no cookie-authenticated mutation/CSRF path. State-changing controls will require a separate session/CSRF and role design.
- Sign-out clears the browser's token; it is not server-side revocation. A previously copied ID token remains valid until expiry unless its subject is removed. This foundation grants no writes. Revocable sessions are required before operational controls.

## Endpoint matrix

| Service / endpoint                                 | Authentication                                          | Current result                                       |
| -------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| FC GET /health                                     | Public, nonsensitive status                             | Locked status; 503 if mode invalid                   |
| FC GET /dashboard/session, /dashboard/status       | Verified Google bearer + allowed subject + exact Origin | Identity / locked runtime status                     |
| FC POST /signals                                   | Internal service secret                                 | FX validation; valid signals still rejected with 503 |
| FC GET /decisions, /decisions/:id                  | Internal service secret                                 | Historical D1 records                                |
| FC GET /state/paused                               | Internal service secret                                 | Always paused                                        |
| FC PUT /state/paused                               | Internal service secret                                 | true acknowledged; false refused with 409            |
| FC PUT /state/freeze, /settings/broker-preferences | Internal service secret                                 | 409, unavailable                                     |
| Treasurer capital endpoints                        | Internal service secret                                 | Never approve / never claim ledger processing        |
| Event stream /ws, /broadcast                       | Retired                                                 | 410; old sockets closed when awakened                |
| TradingView webhook                                | Source allowlist + existing payload secret              | FX validation; forwarding cannot unlock FC           |

## Secrets and migration

Only public client ID and API location belong in dashboard build configuration. Keep service secrets in worker secrets or ignored local .dev.vars. Do not create broker secrets until the read-only practice service is implemented.

If an old dashboard was deployed with shared service or WebSocket credentials, treat those values as exposed: rotate the service secret across affected workers and remove the old browser build/token configuration during a separately authorised deployment. Deleting the source alone does not revoke a previously exposed secret. No secrets were rotated or deployment changed by this PR.

The existing webhook secret lives in legacy KV; this is retained compatibility, not the target secret-store design. Savings/tax and internal historical APIs remain prototype code outside the new trading runtime.

## Verification and remaining work

Signed-token tests cover valid identities, wrong audience/issuer, expiry, missing mandatory claims, forged/unsigned tokens, denied subjects, origin rules, key failures and rejected writes. Safety tests exercise worker boundaries without real credentials.

Before exposing any new operational controls: add revocable server sessions, roles, CSRF handling where cookies are used, rate limiting, a content-security policy, request limits and operational audit/recovery. Before broker writes: deploy a distinct credential-holding executor with practice-only egress and immutable policy.
