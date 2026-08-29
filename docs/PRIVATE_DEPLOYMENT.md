# Private deployment guide

## 1. Keep one source of truth

Create one private GitHub repository named `btc-rotator`. It is the master copy of the application. Changes flow in one direction: local work is committed and pushed to GitHub; AWS Amplify deploys the `main` branch automatically. Do not edit application code in AWS.

The existing `btcrotator.com` Amplify app can be replaced after the GitHub repository and production branch are connected.

## 2. Configure private access

In Amazon Cognito:

1. Disable public sign-up and enable invitation-only access.
2. Require multi-factor authentication for every permitted user.
3. Invite only the owner and approved family members.
4. Revoke access immediately when a member should no longer see portfolio information.

In AWS Amplify, set production environment variables outside Git, including the exact lowercase `APP_ALLOWED_EMAILS`. The application must deny access if this variable is empty, if a user is not signed in, or if the signed-in email is not allowlisted.

Do not store brokerage CSVs, account numbers, API keys, or original statements in Git. Store source documents in the private object-storage bucket and record only their SHA-256 checksum and metadata in Postgres.

## 3. Connect the domain

Point `btcrotator.com` to the AWS Amplify production branch only after Cognito, the allowlist, and the database backup policy are in place. The application-level access wall protects normal users; AWS controls remain a second layer.

## 4. Promote the data pipeline

Run the database schema through a managed migration process. Then implement, in order:

1. SEC filing watchlist and filing-document retention. The versioned template at `infra/sec-foundation.yaml` creates a private, encrypted S3 bucket and disabled-by-default weekday collector. Package only the three SEC collector files with `make package-sec-foundation`; do not place the resulting zip in Git.
2. Configure `SEC_USER_AGENT` with an identifying, monitored contact before enabling the schedule. This is required by the SEC for automated access.
3. Human-reviewed extraction of BTC holdings, claims, reserves, and diluted shares.
4. Daily adjusted price ingestion with raw-response retention once a correctly licensed price-data vendor is selected.
5. Point-in-time model inputs and versioned backtest artifacts.
6. Shadow-mode reports before any `REVIEW` or `ACTION` status is possible.

## 5. Legal and operating controls

This guide is operational, not legal advice. A disclaimer does not itself determine regulatory status. Before sharing personalized trade recommendations, charging anyone, marketing the app, or giving access beyond private personal use, obtain securities counsel in the relevant jurisdiction.

Maintain an audit record for each snapshot, research run, report, approval, and access change. Never add brokerage execution or credentials to the application.
