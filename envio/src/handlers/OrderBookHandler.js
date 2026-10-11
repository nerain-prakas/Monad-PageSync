/**
 * Envio event handlers for Monad-PageSync order-book contracts.
 *
 * Both NaiveOrderBook and PageSyncOrderBook emit the same events;
 * we handle them with the same functions and tag the contractAddress
 * so the dashboard can distinguish sources.
 */

const handleOrderPlaced = async ({ event, context }) => {
  await context.OrderPlaced.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    trader         : event.params.trader.toLowerCase(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    side           : Number(event.params.side),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const handleOrderUpdated = async ({ event, context }) => {
  await context.OrderUpdated.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const handleOrderCancelled = async ({ event, context }) => {
  await context.OrderCancelled.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const handleTradeExecuted = async ({ event, context }) => {
  await context.TradeExecuted.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const { setHandler } = require("../../node_modules/envio/src/HandlerRegister.res.mjs");

// NaiveOrderBook registrations
setHandler("NaiveOrderBook", "OrderPlaced", handleOrderPlaced);
setHandler("NaiveOrderBook", "OrderUpdated", handleOrderUpdated);
setHandler("NaiveOrderBook", "OrderCancelled", handleOrderCancelled);
setHandler("NaiveOrderBook", "TradeExecuted", handleTradeExecuted);

// PageSyncOrderBook registrations
setHandler("PageSyncOrderBook", "OrderPlaced", handleOrderPlaced);
setHandler("PageSyncOrderBook", "OrderUpdated", handleOrderUpdated);
setHandler("PageSyncOrderBook", "OrderCancelled", handleOrderCancelled);
setHandler("PageSyncOrderBook", "TradeExecuted", handleTradeExecuted);
