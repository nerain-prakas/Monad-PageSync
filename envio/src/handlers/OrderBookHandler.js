/**
 * Envio event handlers for Monad-PageSync order-book contracts.
 *
 * Both NaiveOrderBook and PageSyncOrderBook emit the same events;
 * we handle them with the same functions and tag the contractAddress
 * so the dashboard can distinguish sources.
 *
 * Docs: https://docs.envio.dev/docs/event-handlers
 */

// ---------------------------------------------------------------------------
// OrderPlaced
// ---------------------------------------------------------------------------

NaiveOrderBook.OrderPlaced.handler(async ({ event, context }) => {
  await context.OrderPlaced.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    trader         : event.params.trader.toLowerCase(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    side           : event.params.side,
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

PageSyncOrderBook.OrderPlaced.handler(async ({ event, context }) => {
  await context.OrderPlaced.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    trader         : event.params.trader.toLowerCase(),
    price          : event.params.price.toString(),
    quantity       : event.params.quantity.toString(),
    side           : event.params.side,
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

// ---------------------------------------------------------------------------
// OrderUpdated
// ---------------------------------------------------------------------------

NaiveOrderBook.OrderUpdated.handler(async ({ event, context }) => {
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
});

PageSyncOrderBook.OrderUpdated.handler(async ({ event, context }) => {
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
});

// ---------------------------------------------------------------------------
// OrderCancelled
// ---------------------------------------------------------------------------

NaiveOrderBook.OrderCancelled.handler(async ({ event, context }) => {
  await context.OrderCancelled.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

PageSyncOrderBook.OrderCancelled.handler(async ({ event, context }) => {
  await context.OrderCancelled.set({
    id             : `${event.transaction.hash}-${event.logIndex}`,
    orderId        : event.params.orderId.toString(),
    contractAddress: event.srcAddress.toLowerCase(),
    blockNumber    : event.block.number,
    blockTimestamp : event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

// ---------------------------------------------------------------------------
// TradeExecuted
// ---------------------------------------------------------------------------

NaiveOrderBook.TradeExecuted.handler(async ({ event, context }) => {
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
});

PageSyncOrderBook.TradeExecuted.handler(async ({ event, context }) => {
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
});
