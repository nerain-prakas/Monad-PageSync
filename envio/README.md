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

## Deploy to Render

The indexer runs on Render as a **free Web Service** built from `envio/Dockerfile` (`envio start`, never `dev` or `-r`). Envio's HTTP server (`/healthz`) listens on Render's web port (`ENVIO_INDEXER_PORT=10000`). It uses the same Render PostgreSQL database as the Hasura service, and Hasura serves the GraphQL API to the Express backend.

| Piece | Render service |
|---|---|
| Indexer | Web Service `monad-pagesync-envio` (Docker, root directory `envio`, branch `envio-render`) |
| GraphQL | Web service `monad-pagesync-hasura` |
| Database | PostgreSQL `monad-pagesync-db` |
| API | Web service `Monad-PageSync` (set `ENVIO_GRAPHQL_URL` to the Hasura `/v1/graphql` URL) |

Worker environment (secrets are entered in Render, never committed):

| Variable | Value |
|---|---|
| `ENVIO_PG_HOST` / `ENVIO_PG_PORT` / `ENVIO_PG_USER` / `ENVIO_PG_PASSWORD` / `ENVIO_PG_DATABASE` | from the database's **internal** connection info |
| `ENVIO_PG_SSL_MODE` | `require` |
| `ENVIO_API_TOKEN` | your Envio API token (required: Envio uses HyperSync for this chain) |
| `ENVIO_HASURA` | `true` |
| `ENVIO_INDEXER_PORT` | `10000` |
| `HASURA_GRAPHQL_ENDPOINT` | `https://<hasura-service>.onrender.com/v1/metadata` |
| `HASURA_GRAPHQL_ADMIN_SECRET` | same value as the Hasura service |


### Free-plan caveats

- **Sleeping.** Free web services sleep after ~15 minutes without inbound traffic, which would stop indexing. `keepalive.mjs` runs beside Envio and requests the service's own public `/healthz` every 10 minutes to keep it awake. This is a workaround, not a guarantee.
- **Instance hours.** Free services share ~750 instance-hours per month per workspace. An always-awake indexer uses ~720 on its own, so other free services (Hasura, the backend) may run out of hours late in the month.
- **Memory.** Free instances have 512 MB; the Node heap is capped at 400 MB. If the service restarts with out-of-memory errors, a paid plan is needed.
- **Database.** A free Render PostgreSQL database expires after 30 days.
- **Cold Hasura.** A sleeping Hasura service takes a while to wake; the first start may need one redeploy of the indexer.

### Existing data

Envio keeps its checkpoints in the database. The Render database starts empty, so the worker indexes from the configured start block into it; your local database and checkpoints are not touched. To carry local data over instead, restore a `pg_dump --schema=public` of the local database into Render **before** the worker's first start.

### Verify

```bash
curl -s https://<hasura>.onrender.com/v1/graphql   -H 'content-type: application/json'   -d '{"query":"{ OrderPlaced(limit: 2, order_by: {blockNumber: desc}) { id transactionHash blockNumber } }"}'

curl -s https://<backend>/stats
```

`/stats` should report `envioAvailable: true` with non-zero counts, and every `transactionHash` should be a full `0x…` hash.

### Safety

Never run `envio start -r` or `envio dev -r` against this database, and never delete the database or its volume. Keep the Hasura console disabled in production.
