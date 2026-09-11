# Velo

Velo turns a live market call into a public record with a real position behind it.

## What it does

Velo reads live DreamDEX Event Contract windows from the official Somnia testnet, re-checks each market's current status, and reads its binary order book. A connected wallet can publish an immediate buy. The server accepts a Call only after it verifies the transaction sender, successful receipt, market fill log, and indexed nonzero buy fill.

Each confirmed Call receives a shareable `/call/:id` URL. Signed-out visitors can read the current state, back a live Call with an independent wallet transaction, copy or share the link, and open a Proof view. Settled and voided states are read from fresh testnet status. Public profiles count only Velo-created Calls, and accuracy excludes unsettled and Void records.

There are no seeded users, Calls, fills, prices, settlements, or performance metrics. The app remains empty until a real wallet creates a confirmed testnet fill.

## Architecture

```text
Browser wallet -> Velo web app -> DreamDEX Markets SDK / Somnia testnet
                              -> Velo API -> Neon Postgres
```

Financial facts are verified from DreamDEX and Somnia. The server stores the public record index only after receipt and fill checks pass. Local development falls back to an ignored JSON file when `DATABASE_URL` is not set. Deployed environments use Neon Postgres.

## Local setup

```bash
npm install
npm run dev
```

The default configuration reads Somnia testnet. Copy `.env.example` to `.env.local` to override the public endpoints. Set the server-only `DATABASE_URL` to use Neon. The persistence and verification layer is intentionally testnet-only in this build.

## Deployment

Build and run the production server with:

```bash
npm install
npm run build
npm start
```

The host must provide `DATABASE_URL`, `PORT`, and `HOST`. `DATABASE_URL` must be the raw `postgresql://` connection URL from Neon, without the surrounding `psql '...'` command. The server creates its Neon table and indexes on the first API request. To move the existing local verified record into Neon, set `DATABASE_URL` and run:

```bash
npm run migrate:data
```

No private key is required by the server. Users sign their own testnet transactions in the browser. Never expose a database connection string or wallet key through a `VITE_` variable.

For a Docker-capable host, create one web service from this repository, use the Dockerfile, expose port `8787`, and set `PORT=8787` and `HOST=0.0.0.0`. Add the Neon `DATABASE_URL` as a server-only secret. Set the health check path to `/api/health`, deploy once, then confirm the response contains `"ok":true` and `"storage":"neon"`. Do not add `TEST_PRIVATE_KEY` to the host. It is not needed by the server.

## Verification

```bash
npm run build
npm start
```

The browser surface is designed to show an explicit unavailable state when DreamDEX cannot be reached. It does not seed sample users, calls, prices, probabilities, or performance metrics.

The read-only endpoint `GET /api/claimable/:address` reports real settled positions that the wallet can redeem. It never sends a transaction. Redemption remains a wallet-confirmed action and is not automated by the server.
