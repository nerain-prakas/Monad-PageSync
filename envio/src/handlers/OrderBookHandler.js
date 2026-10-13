/**
 * Envio event handlers for Monad-PageSync order-book contracts.
 *
 * Both NaiveOrderBook and PageSyncOrderBook emit the same events;
 * we handle them with the same functions and tag the contractAddress
 * so the dashboard can distinguish sources.
 */

const { getEventMeta } = require("../shared/eventMeta.js");

// Request transaction.hash per registration (not via config.yaml field_selection):
// config-level field selection is persisted and makes an existing indexer
// incompatible on resume, while handler-level `fields` is not.
const TX_HASH_OPTIONS = { fields: { transaction: ["hash"], block: ["number", "timestamp"] } };

const handleOrderPlaced = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.OrderPlaced.set({
    id             : meta.id,
    orderId        : event.params.orderId.toString(),
    trader         : event.params.trader.toLowerCase(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    side           : Number(event.params.side),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

const handleOrderUpdated = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.OrderUpdated.set({
    id             : meta.id,
    orderId        : event.params.orderId.toString(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

const handleOrderCancelled = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.OrderCancelled.set({
    id             : meta.id,
    orderId        : event.params.orderId.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

const handleTradeExecuted = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.TradeExecuted.set({
    id             : meta.id,
    orderId        : event.params.orderId.toString(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

const { setHandler } = require("../../node_modules/envio/src/HandlerRegister.res.mjs");

// NaiveOrderBook registrations
setHandler("NaiveOrderBook", "OrderPlaced", handleOrderPlaced, TX_HASH_OPTIONS);
setHandler("NaiveOrderBook", "OrderUpdated", handleOrderUpdated, TX_HASH_OPTIONS);
setHandler("NaiveOrderBook", "OrderCancelled", handleOrderCancelled, TX_HASH_OPTIONS);
setHandler("NaiveOrderBook", "TradeExecuted", handleTradeExecuted, TX_HASH_OPTIONS);

// PageSyncOrderBook registrations
setHandler("PageSyncOrderBook", "OrderPlaced", handleOrderPlaced, TX_HASH_OPTIONS);
setHandler("PageSyncOrderBook", "OrderUpdated", handleOrderUpdated, TX_HASH_OPTIONS);
setHandler("PageSyncOrderBook", "OrderCancelled", handleOrderCancelled, TX_HASH_OPTIONS);
setHandler("PageSyncOrderBook", "TradeExecuted", handleTradeExecuted, TX_HASH_OPTIONS);
