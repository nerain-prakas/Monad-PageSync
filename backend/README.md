**PageSync Backend API**
A lightweight Express.js backend service that provides benchmark results, deployed smart contract addresses, and Envio-indexed blockchain activity to the PageSync frontend application.

The service acts as the backend layer connecting the frontend with benchmark data, deployment records, and the Envio blockchain indexer.

Benchmark and address endpoints operate independently, while order, trade, and Kuru market activity endpoints require the Envio indexer.

---

**Table of Contents**
- "Overview" (#overview)
- "Features" (#features)
- "Prerequisites" (#prerequisites)
- "Getting Started" (#getting-started)
- "Environment Configuration" (#environment-configuration)
- "API Endpoints" (#api-endpoints)
- "Endpoint Details" (#endpoint-details)
- "Failure Handling" (#failure-handling)
- "Helper Scripts" (#helper-scripts)
- "Troubleshooting" (#troubleshooting)
- "Summary" (#summary)

---

**Overview***

PageSync Backend API provides access to:

- Deployed smart contract addresses.
- Benchmark summaries and performance results.
- Aggregated application statistics.
- Indexed blockchain order events.
- Indexed blockchain trade events.
- Kuru marketplace activity.

The backend integrates with the Envio indexer through GraphQL to retrieve blockchain event data.

If Envio is unavailable, the service handles the failure gracefully, allowing the frontend to continue functioning.

---

**Features**

- Health Check: Verifies that the backend service is running.
- Deployment Information: Retrieves deployed contract addresses.
- Benchmark Results: Provides stored benchmark summaries and performance metrics.
- Application Statistics: Aggregates benchmark totals and indexed blockchain event counts.
- Order Tracking: Retrieves indexed "OrderPlaced" events.
- Trade Tracking: Retrieves indexed "TradeExecuted" events.
- Kuru Market Activity: Provides order creation, trade, and cancellation events.
- Graceful Error Handling: Returns appropriate fallback responses when Envio is unavailable.
- Configurable Environment: Supports environment-based server and GraphQL configuration.

---

**Prerequisites**

Ensure the following are installed and configured before running the service:

- "Node.js" (https://nodejs.org/)
- npm (Node Package Manager)
- Envio indexer for blockchain activity endpoints
- Access to the required project configuration and deployment files

«Note: The health check, addresses, and benchmark endpoints do not require Envio. Statistics can provide benchmark information without Envio, but indexed blockchain statistics depend on its availability.»

---

Getting Started

1. **Install Dependencies**

Navigate to the backend project directory and install the required dependencies.

npm install

2.**Start the Server**

Run the following command to start the backend service:

npm start

By default, the server runs at:

http://localhost:3001

**3. Development Mode**

To start the server in development mode with automatic restarts when files change, run:

npm run dev

---

**Environment Configuration**

The backend loads environment configuration from:

../.env

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Listen port |
| `ENVIO_GRAPHQL_URL` | `http://localhost:8080/v1/graphql` | Envio GraphQL endpoint |
| `KURU_MARKET_ADDRESS` | built-in market address | Fallback if `deployments/addresses.json` has none |
Add or update the following variables in the project's ".env" file:

PORT=3001
ENVIO_GRAPHQL_URL=http://localhost:8080/v1/graphql

If you need to run the backend on a different port, update "PORT" accordingly.

«Important: The built-in fallback value for "KURU_MARKET_ADDRESS" is defined by the project. Use the appropriate address if you need to override it.»

---

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


Example Requests

GET /health
GET /addresses
GET /benchmark
GET /stats
GET /orders?limit=50
GET /orders/123
GET /trades?limit=50
GET /kuru/activity?limit=100

For a locally running server, prepend:

http://localhost:3001

For example:

http://localhost:3001/orders?limit=50

---

Endpoint Details

**1. Health Check**

Endpoint: "GET /health"

Purpose: Performs a liveness check to verify that the backend service is running and accessible.

This endpoint does not require the Envio indexer.

Example:

GET http://localhost:3001/health

---

**2. Contract Addresses**

Endpoint: "GET /addresses"

Data Source: "deployments/addresses.json"

Purpose: Returns the deployed smart contract addresses available in the project's deployment configuration.

This endpoint does not require the Envio indexer.

Example:

GET http://localhost:3001/addresses

---

**3. Benchmark Results**

Endpoint: "GET /benchmark"

Data Source: "benchmark/results/"

Purpose: Returns stored benchmark summaries and performance results generated during benchmark execution.

This endpoint does not require the Envio indexer.

Example:

GET http://localhost:3001/benchmark

---

**4. Application Statistics**

Endpoint: "GET /stats"

Data Source: Benchmark results and Envio-indexed data.

Purpose: Provides aggregated application statistics, including:

- Benchmark totals.
- Indexed order counts.
- Indexed trade counts.
- Envio availability status.

Example Request:

GET http://localhost:3001/stats

Example Response:

{
  "envioAvailable": true
}

The response may contain additional statistics depending on the available benchmark and indexed data.

When Envio is unavailable, the service reports its status accordingly.

---

**5. Retrieve Orders**

Endpoint: "GET /orders?limit="

Data Source: Envio

Purpose: Returns indexed "OrderPlaced" blockchain events.

The optional "limit" query parameter specifies the maximum number of records to request.

Example Request:

GET http://localhost:3001/orders?limit=50

---

**6. Retrieve a Specific Order**

Endpoint: "GET /orders/:id"

Data Source: Envio

Purpose: Retrieves detailed information about a specific order using its identifier.

Example Request:

GET http://localhost:3001/orders/123

Replace "123" with the required order ID.

---

**7. Retrieve Trades**

Endpoint: "GET /trades?limit="

Data Source: Envio

Purpose: Returns indexed "TradeExecuted" blockchain events.

The optional "limit" query parameter specifies the maximum number of records to request.

Example Request:

GET http://localhost:3001/trades?limit=50

---

**8. Retrieve Kuru Market Activity**

Endpoint: "GET /kuru/activity?limit="

Data Source: Envio

Purpose: Returns indexed Kuru marketplace activity, including:

- "OrderCreated"
- "Trade"
- "OrdersCanceled"

The optional "limit" query parameter specifies the maximum number of records to request.

Example Request:

GET http://localhost:3001/kuru/activity?limit=100

---

**Service Dependencies**

The backend endpoints have different dependency requirements.

Feature| Envio Required| Description
Health Check| No| Checks backend availability.
Addresses API| No| Reads deployment configuration.
Benchmark API| No| Reads stored benchmark results.
Statistics API| Partial| Benchmark statistics can be retrieved independently; indexed counts depend on Envio.
Orders API| Yes| Retrieves indexed order events.
Trades API| Yes| Retrieves indexed trade events.
Kuru Activity API| Yes| Retrieves indexed Kuru marketplace events.

---

**Failure Handling**

The backend is designed to handle Envio connectivity issues gracefully.

When Envio is unavailable, the service does not fail entirely. Instead, it returns fallback responses for endpoints that depend on indexed blockchain data.

Orders, Trades, and Kuru Activity

When Envio cannot be reached, the affected endpoints return a response similar to:

{
  "data": [],
  "warning": "Envio is not reachable"
}

This allows the frontend to handle unavailable blockchain data without depending on the indexer being continuously accessible.

**Statistics**

When Envio is unavailable, the statistics endpoint reports:

{
  "envioAvailable": false
}

Benchmark-related information may still be available independently.

---

**Helper Scripts**

The project includes helper scripts for inspecting and validating blockchain event data directly through an RPC endpoint.

1.**"check_events.mjs"**

Inspects blockchain events directly from the RPC endpoint.

Run:

node check_events.mjs

2. **"check_kuru.mjs"**

Inspects Kuru market activity directly from the RPC endpoint.

Run:

node check_kuru.mjs

3. **"test_kuru_scan.mjs"**

Validates Kuru event scanning functionality.

Run:

node test_kuru_scan.mjs

These scripts can help investigate missing indexed events and validate event-scanning behavior.

---

**Troubleshooting**

1. **Empty Orders or Trades**

Symptoms:

- The orders endpoint returns no records.
- The trades endpoint returns no records.
- The response contains ""Envio is not reachable"".

Possible Causes:

- The Envio indexer is not running.
- The configured GraphQL URL is incorrect.
- The GraphQL endpoint is unreachable.
- The required events have not yet been indexed.

Resolution:

1. Start the Envio indexer.
2. Verify the "ENVIO_GRAPHQL_URL" configuration in ".env".
3. Confirm that the GraphQL endpoint is reachable.
4. Check whether the expected blockchain events have been indexed.
5. Use the helper scripts to inspect blockchain events directly through RPC.

For additional setup instructions, refer to:

../envio/README.md

2. **Port Already in Use**

Problem: The backend cannot start because the configured port is already occupied.

Resolution:

Update the ".env" file with an available port.

For example:

PORT=4000

Update the frontend configuration to use the same backend port:

VITE_API_URL=http://localhost:4000

Restart both the frontend and backend services after making these changes.

---

**Summary**

PageSync Backend API provides a lightweight backend for accessing deployment information, benchmark results, application statistics, order history, trade records, and Kuru marketplace activity.

By integrating with Envio through GraphQL, the service enables the frontend to retrieve indexed blockchain data while maintaining graceful fallback behavior when indexing services are unavailable.

Its modular endpoints, environment-based configuration, and helper scripts support development, testing, and troubleshooting across the PageSync application.
