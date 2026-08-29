# BTC Rotator

An invite-only Bitcoin and Bitcoin-proxy research application. It is deliberately **not** an execution system, investment adviser, or a source of unvalidated trade recommendations.

## What this is today

- A temporary invite-only authentication layer plus a server-side email allowlist that fails closed.
- A sanitized, local-only portfolio snapshot containing only BTC/BTC-proxy positions; no account identifiers are retained.
- A private API at `/api/research-status` that reports evidence gates and will not emit a trade probability before calibration.
- Postgres production schema for users, immutable snapshots, capital-structure facts, recommendation runs, and audit events.
- Decision surfaces that remain blocked until real market data, filing-backed capital structures, lot data, and out-of-sample validation are available.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the authentication keys and `APP_ALLOWED_EMAILS` before opening the application. An empty allowlist denies every authenticated user.

The current snapshot is in `data/private/`, which is gitignored. It is a transitional local import; production portfolio data belongs in Postgres and object storage, not in the deployed source tree.

## Simple production setup

1. A private GitHub repository — the single, canonical copy of the code.
2. AWS Amplify — deploys the web application automatically from GitHub.
3. Amazon Cognito — invitation-only sign-in and MFA.
4. Amazon RDS PostgreSQL — immutable research, positions, and audit data when live data is added.
5. Amazon S3 — imported statements and source filing documents.
6. SEC EDGAR — filings and XBRL source data.
7. A licensed market-data provider — added only when the research workflow is ready for real data.

See [Private deployment guide](docs/PRIVATE_DEPLOYMENT.md) before deploying. AWS and GitHub credentials never belong in this repository.

## Verification

```bash
npm run build
python3.11 -m pytest brae/tests -v
```

## Non-negotiable release gates

No trade memo or probability of success may be published until every gate is satisfied:

1. Licensed market data is current and versioned.
2. Issuer capital structures are filing-backed and reviewable.
3. Tax-lot, liquidity, cost, issuer-cap, and stress constraints are evaluated.
4. The model is calibrated on point-in-time out-of-sample data.
5. A human approves every ticket.
