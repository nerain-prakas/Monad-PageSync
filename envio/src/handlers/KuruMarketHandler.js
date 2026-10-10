/**
 * Kuru MON/USDC events are intentionally stored in separate entities from
 * the PageSync reference order-book events.
 */

const handleOrderCreated = async ({ event, context }) => {
  await context.KuruOrderCreated.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    orderId: event.params.orderId.toString(),
    owner: event.params.owner.toLowerCase(),
    size: event.params.size.toString(),
    price: event.params.price.toString(),
    isBuy: event.params.isBuy,
    marketAddress: event.srcAddress.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const handleTrade = async ({ event, context }) => {
  await context.KuruTrade.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    orderId: event.params.orderId.toString(),
    makerAddress: event.params.makerAddress.toLowerCase(),
    takerAddress: event.params.takerAddress.toLowerCase(),
    price: event.params.price.toString(),
    updatedSize: event.params.updatedSize.toString(),
    filledSize: event.params.filledSize.toString(),
    isBuy: event.params.isBuy,
    marketAddress: event.srcAddress.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

const handleOrdersCanceled = async ({ event, context }) => {
  await context.KuruOrdersCanceled.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    orderIds: event.params.orderId.map((id) => id.toString()).join(','),
    owner: event.params.owner.toLowerCase(),
    marketAddress: event.srcAddress.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
};

// KuruMarket registrations
indexer.onEvent({ contract: "KuruMarket", event: "OrderCreated" }, handleOrderCreated);
indexer.onEvent({ contract: "KuruMarket", event: "Trade" }, handleTrade);
indexer.onEvent({ contract: "KuruMarket", event: "OrdersCanceled" }, handleOrdersCanceled);
