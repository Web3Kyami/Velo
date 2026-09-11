# Velo

**Make the call. Keep the proof.**

Velo turns a real DreamDEX Event Contract position into a public market Call that can be shared while it is live and kept as a permanent receipt after settlement.

People make market calls publicly every day, but screenshots and posts do not prove they actually took the position. Velo connects the opinion to a real trade.

A Call only exists after Velo verifies that the connected wallet actually filled a DreamDEX position on Somnia.

## Live app

- Landing: https://velo-rho-jet.vercel.app/
- Markets: https://velo-rho-jet.vercel.app/app

## The product loop

```text
Choose a live DreamDEX market
        ↓
Pick Higher or Lower
        ↓
Enter stake and sign the real trade
        ↓
DreamDEX fills the position
        ↓
Velo verifies the transaction + fill
        ↓
Public Call is created
        ↓
Share it while live
        ↓
Another trader can independently Back the Call
        ↓
Market settles
        ↓
The same Call becomes a permanent receipt
        ↓
Receipts compound into the trader's public profile
```

Velo is not an automatic copy-trading system. Backing a Call creates a new independent position at the price available when the second trader acts.

## Why Velo

DreamDEX already provides the hard market infrastructure: live Event Contracts, probability-priced order books, outcome tokens, execution and settlement.

Velo adds the identity and proof layer around those primitives.

The core idea is simple:

> A market opinion should be able to carry proof that the trader actually acted on it.

Instead of disappearing as a screenshot or post, a Call becomes part of a persistent record of conviction and outcomes.

## Core surfaces

### Markets

`/app`

The main product surface reads real DreamDEX binary Event Contract windows and presents them as a live market board.

Users can:

- filter BTC and ETH markets
- filter available time windows
- switch between card and list views
- see Higher / Lower probabilities from the live order book
- inspect real market probability history
- see countdowns to market close
- open only markets that still have enough time to execute safely
- connect a browser wallet and publish a Call

Velo progressively hydrates market charts instead of loading every candle series at once so the market board stays responsive even when many rolling windows are active.

### Trade flow

Opening a market brings up the Call composer.

The trader chooses:

- Higher or Lower
- stake size
- one of the quick stake presets or a custom amount

On Somnia testnet, Event Contract collateral is shown as **tUSDC**. **STT is used for gas.**

The UI estimates contracts, payout and profit before submission. Final values come from the actual fill, not the estimate shown before the trade.

The first trade against a pool may require two wallet confirmations:

1. collateral approval
2. the actual DreamDEX order

After the trade confirms, Velo verifies the fill before creating the public Call.

### Public Call / Receipt

`/call/:id`

A Call is a shareable public page for one verified position.

While the market is live it shows:

- trader identity
- asset and interval
- market question
- Higher / Lower side
- entry probability
- actual position cost
- market probability chart
- countdown
- sharing controls
- proof controls
- Back this Call action

After settlement, the same URL becomes a permanent receipt with the result and settlement context.

Public Call reads are based on the verified record Velo persisted at creation time. Fresh DreamDEX and onchain data enrich the page when available, but a temporary live-indexer failure does not erase an already verified Velo record.

### Back this Call

A visitor opening a live Call can independently take a position in the same underlying DreamDEX Event Contract.

This is intentionally not automatic copying.

The second trader:

1. opens the public Call
2. sees the original trader's side and entry
3. chooses a side for themselves
4. trades at the current available market price
5. receives their own independently verified Call

### Profiles

`/profile/:address`

Profiles turn individual Calls into a public record.

A profile can show:

- total public Calls
- accuracy across settled Won / Lost Calls
- live Calls
- settled receipts
- claimable winnings
- real market history on active Calls

Void and unsettled Calls are not counted as wins or losses.

Profiles also support an optional display name. The name is not trusted from a plain API request. The wallet owner must sign a message proving ownership before the profile metadata is updated.

The wallet address always remains the underlying identity.

## Verification model

Velo does not create a public Call from frontend state alone.

After the wallet submits a trade, the server verifies the transaction before saving the record.

The verification path checks:

1. the submitted market exists
2. the transaction exists on Somnia
3. the transaction sender matches the connected wallet
4. the receipt succeeded
5. the receipt contains an `OrderFilled` event for the expected DreamDEX pool
6. DreamDEX indexed fills include a nonzero buy fill from that wallet
7. actual quantity, cost and entry probability are derived from the confirmed fill

Only then is the Call stored and given a public ID.

```text
Browser wallet
   │
   │  signed DreamDEX order
   ▼
Somnia / DreamDEX
   │
   │  tx + receipt + fill
   ▼
Velo verification API
   │
   │  verified public record
   ▼
Neon Postgres
   │
   ├── /call/:id
   └── /profile/:address
```

## Data integrity

Velo intentionally avoids fake product data.

There are no seeded:

- users
- Calls
- fills
- probabilities
- settlements
- win rates
- leaderboards
- PnL records

If no verified Call exists, the product shows an empty state.

If DreamDEX does not provide candle history for a market, Velo shows that no trade history is available instead of drawing a fake chart.

## Settlement and receipts

Velo reads current DreamDEX / Somnia market state to determine whether a Call is still live, settled or voided.

For public records, the verified persisted record is the base truth. Onchain status and current market information are treated as live enrichment.

This means a Call does not disappear just because a rolling market is no longer returned by the live market indexer.

## Claimable positions

The read-only endpoint:

```text
GET /api/claimable/:address
```

reports real resolved positions that the wallet can redeem.

The server never claims funds automatically. Redemption remains a wallet-confirmed action from the client.

## Architecture

```text
                         ┌─────────────────────────┐
                         │     DreamDEX Markets    │
                         │ SDK + Event Contracts   │
                         └────────────┬────────────┘
                                      │
                                      │ markets / books / fills
                                      │ candles / settlement
                                      ▼
┌─────────────────┐        ┌─────────────────────────┐
│  Browser Wallet │───────▶│        Velo Web         │
│ MetaMask / EIP  │ trade  │ Vite + vanilla modules  │
└────────┬────────┘        └────────────┬────────────┘
         │                              │
         │ Somnia tx                    │ verified Call request
         ▼                              ▼
┌─────────────────┐        ┌─────────────────────────┐
│ Somnia Network  │◀──────▶│        Velo API         │
│ tx + events     │ verify │ verification + profiles │
└─────────────────┘        └────────────┬────────────┘
                                       │
                                       ▼
                            ┌─────────────────────────┐
                            │      Neon Postgres      │
                            │ Calls + profile metadata│
                            └─────────────────────────┘
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/app` | Live DreamDEX market board |
| `/call/:id` | Public live Call / settled receipt |
| `/profile/:address` | Trader public record |
| `/api/health` | API and storage health |
| `/api/calls` | Persist a newly verified Call |
| `/api/calls/:id` | Read a public Call |
| `/api/profile/:address` | Read a public profile |
| `/api/profile-meta/:address` | Read / update signed display-name metadata |
| `/api/claimable/:address` | Read claimable DreamDEX positions |

## DreamDEX integration

Velo uses `@somnia-chain/markets-sdk` for the live Event Contract integration.

Current integration includes:

- live binary market discovery
- onchain market-state checks
- binary order books
- probability conversion
- wallet-backed market orders
- fill verification
- user fills
- candle history
- claimable positions
- redemption
- settlement / resolution context

The current build defaults to the official Somnia testnet configuration.

## Tech stack

- JavaScript / ES modules
- Vite 6
- `@somnia-chain/markets-sdk`
- viem
- Neon serverless Postgres
- Vercel serverless functions
- Somnia testnet
- DreamDEX Event Contracts

## Local development

Requirements:

- Node.js
- npm
- browser wallet such as MetaMask

Install and run:

```bash
npm install
npm run dev
```

Build production assets:

```bash
npm run build
```

Preview the build:

```bash
npm run preview
```

The repository also contains a Node server entry for local / non-Vercel deployments:

```bash
npm start
```

## Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Available configuration:

```env
# Defaults to testnet
VITE_DREAMDEX_NETWORK=testnet

# Optional DreamDEX endpoint overrides
VITE_DREAMDEX_INDEXER_URL=
VITE_DREAMDEX_WS_RPC_URL=

# Server-only Neon connection string
DATABASE_URL=

# Used by the standalone Node server
PORT=8787
HOST=0.0.0.0
```

Do not place a private key or database URL inside a `VITE_` variable.

The Velo server does not need a trader private key. Users sign their own transactions in their browser wallet.

## Persistence

Production uses Neon Postgres through `DATABASE_URL`.

Local development can fall back to the ignored JSON persistence layer when no database URL is supplied.

An existing local verified record can be migrated into Neon with:

```bash
npm run migrate:data
```

## Testing

Build check:

```bash
npm run build
```

Settlement-focused tests:

```bash
npm run test:phase15
```

A real end-to-end product test should follow the user path:

```text
Open Markets
→ choose a live BTC / ETH window
→ Higher or Lower
→ enter tUSDC stake
→ confirm wallet transaction(s)
→ Velo verifies the fill
→ View Call
→ open Profile
→ wait for settlement
→ receipt remains in the public record
```

## Design principles

Velo follows a few hard product rules:

- real positions only
- no fake social activity
- no fake performance history
- empty states are better than seeded credibility
- DreamDEX stays the execution layer underneath the consumer experience
- proof is available but does not dominate the main UX
- a public Call should be understandable without knowing the backend architecture

## Status

Velo is a hackathon build for the Somnia x DreamDEX Event Contracts track.

The core flow is implemented end to end on Somnia testnet:

**market discovery → wallet trade → verified Call → public receipt → profile record**

The project remains testnet-first and should not be treated as production financial software.
