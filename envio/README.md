# PageSync — Envio Indexer

[Envio HyperIndex](https://docs.envio.dev) indexer for the PageSync order books and the Kuru MON/USDC market on Monad Testnet. See the [root README](../Readme.md) for the project overview.

Envio is used for event analytics. It is not a gas profiler and is not the source of the benchmark results — those come from transaction receipts.

## What is indexed

| Contract | Events |
|---|---|
| `NaiveOrderBook`, `PageSyncOrderBook` | `OrderPlaced`, `OrderUpdated`, `OrderCancelled`, `TradeExecuted` |
| `KuruMarket` | `OrderCreated`, `Trade`, `OrdersCanceled` |

Chain `10143`, starting at block `68348601` (PageSync book from `68348609`). Addresses are in `config.yaml`.

```text
config.yaml          chains, contracts, events
schema.graphql       entities (OrderPlaced, OrderUpdated, …, Kuru*)
abis/                IOrderBook.json, KuruMarket.json
src/handlers/        OrderBookHandler.js, KuruMarketHandler.js
src/shared/          eventMeta.js — event id + transaction-hash validation
test/                node tests for eventMeta
```

## Run (Windows → WSL 2)

Envio does not run natively on Windows. Use WSL 2 with a **Linux** Node.js (22+), not the Windows `npx`:

```bash
export PATH="/home/<you>/node-v22.23.3-linux-x64/bin:$PATH"   # your Linux Node
cd /mnt/d/codes/Monad-PageSync/envio
npm ci
node ./node_modules/envio/bin.mjs dev
```

Using the project's local CLI avoids `npx` downloading a different Envio version. Envio typically needs Docker for the local database and GraphQL engine; start Docker Desktop first. GraphQL is then served on `http://localhost:8080/v1/graphql`, which the backend reads.

To keep the Node path across WSL sessions, add the `export PATH=…` line to `~/.bashrc`.

## Entity ids and transaction hashes

Every entity id is `<transactionHash>-<logIndex>`, and every entity stores the real `transactionHash`.

`event.transaction.hash` is only populated when the handler asks for it. The handlers request it **per registration** (`fields: { transaction: ['hash'], block: ['number', 'timestamp'] }`) rather than through `field_selection` in `config.yaml`. This matters: Envio stores the config-level field selection with the indexed data, so changing it makes an existing indexer incompatible on resume.

`src/shared/eventMeta.js` validates the hash (`0x` + 64 hex characters) and the log index and throws a descriptive error if either is missing. It never substitutes a placeholder and never skips the event.

## Protecting indexed data

- **Do not** run `envio dev -r` or `envio start -r` — they delete all indexed data.
- Do not change per-event `field_selection` (`blockFields` / `transactionFields`) in `config.yaml` on an indexer that already has data. If Envio reports "config changes are incompatible with the existing indexer data", revert the listed changes to resume, or run a second indexer alongside with a new `ENVIO_PG_SCHEMA` and `ENVIO_INDEXER_PORT`.

## Tests

```bash
node --test test/eventMeta.test.js
```

## Environment

`envio/.env` (git-ignored) may hold `ENVIO_API_TOKEN` for hosted RPC/HyperSync access. Never commit it.
