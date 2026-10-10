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

// NaiveOrderBook registrations
indexer.onEvent({ contract: "NaiveOrderBook", event: "OrderPlaced" }, handleOrderPlaced);
indexer.onEvent({ contract: "NaiveOrderBook", event: "OrderUpdated" }, handleOrderUpdated);
indexer.onEvent({ contract: "NaiveOrderBook", event: "OrderCancelled" }, handleOrderCancelled);
indexer.onEvent({ contract: "NaiveOrderBook", event: "TradeExecuted" }, handleTradeExecuted);

// PageSyncOrderBook registrations
indexer.onEvent({ contract: "PageSyncOrderBook", event: "OrderPlaced" }, handleOrderPlaced);
indexer.onEvent({ contract: "PageSyncOrderBook", event: "OrderUpdated" }, handleOrderUpdated);
indexer.onEvent({ contract: "PageSyncOrderBook", event: "OrderCancelled" }, handleOrderCancelled);
indexer.onEvent({ contract: "PageSyncOrderBook", event: "TradeExecuted" }, handleTradeExecuted);
