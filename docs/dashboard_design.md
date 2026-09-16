# Dashboard

The retained React shell is being adapted for the FX experiment. The current screen is a **read-only foundation**.

## Sign-in

Google Identity Services returns an ID token to the UI. The UI asks the FC /dashboard/session endpoint to verify it. Only a verified identity with an approved server-side subject can enter the dashboard. Missing client configuration shows a locked setup state; there is no development bypass.

Identity and token live in memory only. Reloading requires sign-in again. A timer expires the identity; sign-out invalidates pending sign-in callbacks. Client-side decoding and sessionStorage are not accepted as authentication.

## Status and controls

Authenticated status is polled every 30 seconds through /dashboard/status. The UI clears status on network/auth/schema failure, unmount or sign-out. “Status connected” only describes the API connection.

A persistent banner states FX research, OANDA practice, execution locked and broker not connected. The Controls panel has no resume or agent-freeze action. Settings displays the server's mode, allowlisted pairs and Saturday 09:00 Europe/London review cadence. It does not write broker settings.

The standalone read-only OANDA collector is not yet wired into this UI. Running it does not change the banner or imply account-derived dashboard metrics.

Agent, FC, Treasurer, Execution and Replay panels are retained shells without an active event feed. Empty panels mean no connected data, not zero measured P&L. Tax and Savings are removed from navigation; their prototype components remain in the source tree for historical reference.

## Next work

Add real account/quote status only after read-only broker integration. Then build trade charts, evidence links, signal attribution, execution timelines, data freshness and incident views from the durable ledger. Operational controls need revocable sessions, roles, audit records and server acknowledgement before any optimistic UI state is allowed.

The new report generator must distinguish observed forward results from simulated or historical data and label insufficient evidence explicitly.
