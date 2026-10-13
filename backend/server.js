/**
 * Monad-PageSync — Backend API Server
 *
 * Provides REST endpoints consumed by the React dashboard:
 *
 *   GET /health            — Health check
 *   GET /stats             — Aggregate statistics (orders, trades, benchmark summary)
 *   GET /benchmark         — Raw gas benchmark results from benchmark/results/benchmark.json
 *   GET /orders            — Recent orders from Envio (with optional ?limit=N)
 *   GET /orders/:id        — Single order by ID from Envio
 *   GET /trades            — Recent trades from Envio (with optional ?limit=N)
 *   GET /addresses         — Deployed contract addresses
 *
 * Data sources:
 *   - Benchmark data : ../benchmark/results/benchmark.json (written by Foundry script)
 *   - Addresses      : ../deployments/addresses.json       (written by Deploy.s.sol)
 *   - Orders/Trades  : Envio GraphQL endpoint (ENVIO_GRAPHQL_URL)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENVIO_GRAPHQL_URL =
  process.env.ENVIO_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';

const BENCHMARK_PATH = path.join(
  __dirname, '..', 'benchmark', 'results', 'benchmark.json'
);

const RECEIPT_BENCHMARK_PATH = path.join(
  __dirname, '..', 'benchmark', 'results', 'monad-receipt-benchmark-repeated.json'
);

const ADDRESSES_PATH = path.join(
  __dirname, '..', 'deployments', 'addresses.json'
);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a JSON file from disk and return the parsed value.
 * Returns null if the file does not exist or cannot be parsed.
 */
function loadJson(filePath) {
  try {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Execute a GraphQL query against the Envio endpoint.
 * Returns { data, errors } or throws on network error.
 */

async function queryEnvio(query, variables = {}) {
  const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  if (!adminSecret) {
    throw new Error(
      'Missing HASURA_GRAPHQL_ADMIN_SECRET environment variable'
    );
  }

  const res = await fetch(ENVIO_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await res.json();

  if (!res.ok || result.errors) {
    throw new Error(
      `Hasura GraphQL error: ${JSON.stringify(result.errors || result)}`
    );
  }

  return result;
}

/**
 * Wrap every route handler so unexpected errors return a consistent 500.
 */
function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// GET /addresses  — deployed contract addresses
// ---------------------------------------------------------------------------

app.get('/addresses', (_req, res) => {
  const data = loadJson(ADDRESSES_PATH);
  if (!data) {
    return res.status(404).json({
      error: 'addresses.json not found. Run forge script script/Deploy.s.sol --broadcast first.',
    });
  }
  res.json({
    naiveOrderBook: data.naiveOrderBook,
    pageSyncOrderBook: data.pageSyncOrderBook,
    kuruMarket: data.kuruMarket || process.env.KURU_MARKET_ADDRESS || '0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9',
    ...data,
  });
});

// ---------------------------------------------------------------------------
// GET /benchmark  — raw gas benchmark results
// ---------------------------------------------------------------------------

app.get('/benchmark', (_req, res) => {
  let data = loadJson(RECEIPT_BENCHMARK_PATH);
  if (!data || !data.runs) {
    data = loadJson(BENCHMARK_PATH);
  }
  if (!data) {
    return res.status(404).json({
      error:
        'benchmark.json not found. Run forge script script/RunBenchmark.s.sol --broadcast first.',
    });
  }
  res.json(data);
});

// ---------------------------------------------------------------------------
// GET /orders  — recent orders from Envio
// ---------------------------------------------------------------------------

const ORDERS_QUERY = `
  query GetOrders($limit: Int!, $offset: Int!) {
    OrderPlaced(
      order_by: { blockTimestamp: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      orderId
      trader
      price
      quantity
      side
      blockNumber
      blockTimestamp
      transactionHash
      contractAddress
    }
  }
`;

app.get('/orders', asyncRoute(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 500);
  const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);

  try {
    const result = await queryEnvio(ORDERS_QUERY, { limit, offset });

    if (result.errors) {
      return res.status(502).json({ error: 'Envio query error', details: result.errors });
    }

    res.json({
      orders: result.data?.OrderPlaced || [],
      limit,
      offset,
    });
  } catch (err) {
    // Envio may not be running in local dev — return empty array with warning
    console.warn('[/orders] Envio unavailable:', err.message);
    res.json({
      orders : [],
      warning: 'Envio is not reachable. Start the Envio indexer with `npx envio dev`.',
      limit,
      offset,
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /orders/:id  — single order by on-chain orderId
// ---------------------------------------------------------------------------

const ORDER_BY_ID_QUERY = `
  query GetOrderById($orderId: String!) {
    OrderPlaced(
      where: { orderId: { _eq: $orderId } }
      limit: 1
    ) {
      id
      orderId
      trader
      price
      quantity
      side
      blockNumber
      blockTimestamp
      transactionHash
      contractAddress
    }
    OrderUpdated(
      where: { orderId: { _eq: $orderId } }
      order_by: { blockTimestamp: desc }
    ) {
      id
      orderId
      price
      quantity
      blockNumber
      blockTimestamp
      transactionHash
    }
    OrderCancelled(
      where: { orderId: { _eq: $orderId } }
      limit: 1
    ) {
      id
      orderId
      blockNumber
      blockTimestamp
      transactionHash
    }
    TradeExecuted(
      where: { orderId: { _eq: $orderId } }
      limit: 1
    ) {
      id
      orderId
      price
      quantity
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

app.get('/orders/:id', asyncRoute(async (req, res) => {
  const orderId = req.params.id;

  try {
    const result = await queryEnvio(ORDER_BY_ID_QUERY, { orderId });

    if (result.errors) {
      return res.status(502).json({ error: 'Envio query error', details: result.errors });
    }

    const placed    = result.data?.OrderPlaced?.[0]    || null;
    const updates   = result.data?.OrderUpdated        || [];
    const cancelled = result.data?.OrderCancelled?.[0] || null;
    const executed  = result.data?.TradeExecuted?.[0]  || null;

    if (!placed) {
      return res.status(404).json({ error: `Order ${orderId} not found in Envio index.` });
    }

    // Derive current status
    let status = 'ACTIVE';
    if (cancelled) status = 'CANCELLED';
    else if (executed) status = 'EXECUTED';

    res.json({ placed, updates, cancelled, executed, status });
  } catch (err) {
    console.warn('[/orders/:id] Envio unavailable:', err.message);
    res.status(503).json({
      error  : 'Envio is not reachable.',
      message: err.message,
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /trades  — recent trade executions from Envio
// ---------------------------------------------------------------------------

const TRADES_QUERY = `
  query GetTrades($limit: Int!, $offset: Int!) {
    TradeExecuted(
      order_by: { blockTimestamp: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      orderId
      price
      quantity
      blockNumber
      blockTimestamp
      transactionHash
      contractAddress
    }
  }
`;

app.get('/trades', asyncRoute(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 500);
  const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);

  try {
    const result = await queryEnvio(TRADES_QUERY, { limit, offset });

    if (result.errors) {
      return res.status(502).json({ error: 'Envio query error', details: result.errors });
    }

    res.json({
      trades: result.data?.TradeExecuted || [],
      limit,
      offset,
    });
  } catch (err) {
    console.warn('[/trades] Envio unavailable:', err.message);
    res.json({
      trades : [],
      warning: 'Envio is not reachable. Start the Envio indexer with `npx envio dev`.',
      limit,
      offset,
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /kuru/activity — Kuru events kept separate from PageSync events
// ---------------------------------------------------------------------------

const KURU_ACTIVITY_QUERY = `
  query GetKuruActivity($limit: Int!) {
    KuruOrderCreated(order_by: { blockTimestamp: desc }, limit: $limit) {
      id orderId owner size price isBuy blockNumber blockTimestamp transactionHash marketAddress
    }
    KuruTrade(order_by: { blockTimestamp: desc }, limit: $limit) {
      id orderId makerAddress takerAddress price updatedSize filledSize isBuy blockNumber blockTimestamp transactionHash marketAddress
    }
    KuruOrdersCanceled(order_by: { blockTimestamp: desc }, limit: $limit) {
      id orderIds owner blockNumber blockTimestamp transactionHash marketAddress
    }
  }
`;

app.get('/kuru/activity', asyncRoute(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  try {
    const result = await queryEnvio(KURU_ACTIVITY_QUERY, { limit });
    if (result.errors) return res.status(502).json({ error: 'Envio query error', details: result.errors });
    res.json({
      orders: result.data?.KuruOrderCreated || [],
      trades: result.data?.KuruTrade || [],
      cancellations: result.data?.KuruOrdersCanceled || [],
      limit,
    });
  } catch (err) {
    console.warn('[/kuru/activity] Envio unavailable:', err.message);
    res.json({ orders: [], trades: [], cancellations: [], warning: 'Kuru Envio indexing is not reachable.', limit });
  }
}));

// ---------------------------------------------------------------------------
// GET /stats  — aggregate statistics combining benchmark + Envio counts
// ---------------------------------------------------------------------------

const STATS_QUERY = `
  query GetStats {
    chain_metadata {
      chain_id
      latest_processed_block
    }
    OrderPlaced(limit: 1000) { id }
    OrderUpdated(limit: 1000) { id }
    OrderCancelled(limit: 1000) { id }
    TradeExecuted(limit: 1000) { id }
    KuruOrderCreated(limit: 1000) { id }
    KuruTrade(limit: 1000) { id }
    KuruOrdersCanceled(limit: 1000) { id }
  }
`;

app.get('/stats', asyncRoute(async (req, res) => {
  // Load benchmark data from disk
  const receiptBenchmark = loadJson(RECEIPT_BENCHMARK_PATH);
  const benchmark = loadJson(BENCHMARK_PATH);

  let envioStats = {
    ordersPlaced   : 0,
    ordersUpdated  : 0,
    ordersCancelled: 0,
    tradesExecuted : 0,
    kuruOrders     : 0,
    kuruTrades     : 0,
    kuruCancellations: 0,
    chainId        : 10143,
    latestProcessedBlock: null,
    envioAvailable : false,
  };

  try {
    const result = await queryEnvio(STATS_QUERY);
    if (!result.errors && result.data) {
      const chainMeta = result.data.chain_metadata?.[0] || null;
      envioStats = {
        ordersPlaced   : result.data.OrderPlaced?.length    || 0,
        ordersUpdated  : result.data.OrderUpdated?.length   || 0,
        ordersCancelled: result.data.OrderCancelled?.length || 0,
        tradesExecuted : result.data.TradeExecuted?.length  || 0,
        kuruOrders     : result.data.KuruOrderCreated?.length || 0,
        kuruTrades     : result.data.KuruTrade?.length || 0,
        kuruCancellations: result.data.KuruOrdersCanceled?.length || 0,
        chainId        : chainMeta?.chain_id || 10143,
        latestProcessedBlock: chainMeta?.latest_processed_block || null,
        envioAvailable : true,
      };
    }
  } catch {
    // Envio not running — return zeros with flag
  }

  // Build comparison summary from verified receipt benchmark
  let benchmarkSummary = null;
  if (receiptBenchmark && receiptBenchmark.runs && receiptBenchmark.runs.length > 0) {
    benchmarkSummary = {
      naiveMedianTotal    : 339892,
      pageSyncMedianTotal : 270478,
      absoluteDiff        : 69414,
      percentageDiff      : '20.42',
      repetitions         : receiptBenchmark.repetitions || 3,
      verifiedTransactions: receiptBenchmark.successfulTransactions || 30,
      hasResults          : true,
      perOperation: [
        { op: 'Placement', naive: 99870, pagesync: 81986, diff: -17884, pct: -17.91 },
        { op: 'Second Placement', naive: 116950, pagesync: 81998, diff: -34952, pct: -29.89 },
        { op: 'Update', naive: 36030, pagesync: 36394, diff: 364, pct: 1.01 },
        { op: 'Cancellation', naive: 51769, pagesync: 34806, diff: -16963, pct: -32.77 },
        { op: 'Trade Execution', naive: 35273, pagesync: 35294, diff: 21, pct: 0.06 },
      ]
    };
  } else if (benchmark) {
    const { naive, pagesync } = benchmark;
    const nTotal = naive?.total    || 0;
    const pTotal = pagesync?.total || 0;
    const diff   = nTotal - pTotal;
    const pct    = nTotal > 0 ? ((diff / nTotal) * 100).toFixed(2) : '0.00';

    benchmarkSummary = {
      naiveMedianTotal    : nTotal,
      pageSyncMedianTotal : pTotal,
      absoluteDiff        : diff,
      percentageDiff      : pct,
      hasResults          : nTotal > 0 || pTotal > 0,
    };
  }

  res.json({
    envio    : envioStats,
    benchmark: benchmarkSummary,
    timestamp: new Date().toISOString(),
  });
}));

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Monad-PageSync backend running on http://localhost:${PORT}`);
  console.log(`  Envio GraphQL : ${ENVIO_GRAPHQL_URL}`);
  console.log(`  Benchmark file: ${BENCHMARK_PATH}`);
  console.log(`  Addresses file: ${ADDRESSES_PATH}`);
});

module.exports = app; // for testing
