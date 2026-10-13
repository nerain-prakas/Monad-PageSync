/**
 * Kuru MON/USDC events are intentionally stored in separate entities from
 * the PageSync reference order-book events.
 */

const { getEventMeta } = require("../shared/eventMeta.js");

// Request transaction.hash per registration (not via config.yaml field_selection):
// config-level field selection is persisted and makes an existing indexer
// incompatible on resume, while handler-level `fields` is not.
const TX_HASH_OPTIONS = { fields: { transaction: ["hash"], block: ["number", "timestamp"] } };

const handleOrderCreated = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.KuruOrderCreated.set({
    id: meta.id,
    orderId: event.params.orderId.toString(),
    owner: event.params.owner.toLowerCase(),
    size: event.params.size.toString(),
    price: event.params.price.toString(),
    isBuy: event.params.isBuy,
    marketAddress: event.srcAddress.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

const handleTrade = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.KuruTrade.set({
    id: meta.id,
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
    transactionHash: meta.transactionHash,
  });
};

const handleOrdersCanceled = async ({ event, context }) => {
  const meta = getEventMeta(event);
  await context.KuruOrdersCanceled.set({
    id: meta.id,
    orderIds: event.params.orderId.map((id) => id.toString()).join(','),
    owner: event.params.owner.toLowerCase(),
    marketAddress: event.srcAddress.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: meta.transactionHash,
  });
};

// KuruMarket registrations
const { setHandler } = require("../../node_modules/envio/src/HandlerRegister.res.mjs");

// KuruMarket registrations
setHandler("KuruMarket", "OrderCreated", handleOrderCreated, TX_HASH_OPTIONS);
setHandler("KuruMarket", "Trade", handleTrade, TX_HASH_OPTIONS);
setHandler("KuruMarket", "OrdersCanceled", handleOrdersCanceled, TX_HASH_OPTIONS);
