# PageSync — Backend API

Small Express service that serves the saved benchmark, deployed addresses and Envio-indexed activity to the frontend. See the [root README](../Readme.md) for the project overview.

## Run

```bash
npm install
npm start          # http://localhost:3001
npm run dev        # restarts on file changes
```

The server loads `../.env` (repository root). The benchmark and address endpoints work with no other service running; order, trade and Kuru endpoints need the Envio indexer.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Listen port |
| `ENVIO_GRAPHQL_URL` | `http://localhost:8080/v1/graphql` | Envio GraphQL endpoint |
| `KURU_MARKET_ADDRESS` | built-in market address | Fallback if `deployments/addresses.json` has none |

## Endpoints

| Method | Path | Source | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness check |
| GET | `/addresses` | `deployments/addresses.json` | Deployed contract addresses |
| GET | `/benchmark` | `benchmark/results/` | Saved receipt benchmark summary |
| GET | `/stats` | benchmark + Envio | Benchmark totals and indexed event counts |
| GET | `/orders?limit=` | Envio | Indexed `OrderPlaced` events |
| GET | `/orders/:id` | Envio | One order by id |
| GET | `/trades?limit=` | Envio | Indexed `TradeExecuted` events |
| GET | `/kuru/activity?limit=` | Envio | Kuru `OrderCreated`, `Trade`, `OrdersCanceled` events |

When Envio is unreachable, list endpoints return an empty list with a `warning` field and `/stats` reports `envioAvailable: false`, instead of failing.

## Helper scripts

`check_events.mjs`, `check_kuru.mjs` and `test_kuru_scan.mjs` are diagnostic scripts for inspecting events and the Kuru market directly from the RPC. Run them with `node <file>`.

## Troubleshooting

- **Empty orders/trades and an "Envio is not reachable" warning** — the indexer isn't running. Start it (see [`../envio/README.md`](../envio/README.md)) and check `ENVIO_GRAPHQL_URL`.
- **Port in use** — set `PORT` in `.env`, and point the frontend at it with `VITE_API_URL`.
