const test = require("node:test");
const assert = require("node:assert/strict");
const { getEventMeta, requireTransactionHash } = require("../src/shared/eventMeta.js");

const HASH = "0x716f8f0ec35408abba0a89f3eda6cc169b123461fbf58dbd3c3b205eae2dffbb";
const ev = (over = {}) => ({
  contractName: "PageSyncOrderBook", eventName: "OrderPlaced", chainId: 10143, logIndex: 3,
  block: { number: 70201519 }, transaction: { hash: HASH }, ...over,
});

test("extracts the real transaction hash", () => {
  assert.equal(requireTransactionHash(ev()), HASH);
});
test("builds deterministic <hash>-<logIndex> id", () => {
  assert.deepEqual(getEventMeta(ev()), { id: `${HASH}-3`, transactionHash: HASH });
  assert.equal(getEventMeta(ev()).id, getEventMeta(ev()).id);
});
test("throws with diagnostics when hash is missing (no undefined-3 id)", () => {
  assert.throws(() => getEventMeta(ev({ transaction: {} })), /Missing or invalid transaction hash.*OrderPlaced.*block=70201519 logIndex=3/);
  assert.throws(() => getEventMeta(ev({ transaction: undefined })), /transaction hash/);
});
test("rejects malformed hashes and bad logIndex instead of fabricating", () => {
  assert.throws(() => getEventMeta(ev({ transaction: { hash: "0x0" } })), /transaction hash/);
  assert.throws(() => getEventMeta(ev({ logIndex: undefined })), /logIndex/);
});
test("handlers write meta from event and propagate missing-hash errors", async () => {
  const { setHandlerCalls } = loadHandlers("../src/handlers/OrderBookHandler.js");
  const rows = [];
  const context = { OrderPlaced: { set: async (r) => rows.push(r) } };
  const h = setHandlerCalls.find(([c, e]) => c === "PageSyncOrderBook" && e === "OrderPlaced")[2];
  const params = { orderId: 1n, trader: "0xAbC", price: 1n, quantity: 2n, side: 0n };
  await h({ event: ev({ params, srcAddress: "0xAA", block: { number: 1, timestamp: 2 } }), context });
  assert.equal(rows[0].id, `${HASH}-3`);
  assert.equal(rows[0].transactionHash, HASH);
  await assert.rejects(h({ event: ev({ params, srcAddress: "0xAA", transaction: {} }), context }), /transaction hash/);
  assert.equal(rows.length, 1);
});

// Load a handler file with the Envio internal registry stubbed out.
function loadHandlers(rel) {
  const Module = require("node:module");
  const path = require("node:path");
  const setHandlerCalls = [];
  const target = path.resolve(__dirname, rel);
  delete require.cache[target];
  const orig = Module._load;
  Module._load = function (request, parent, ...rest) {
    if (request.endsWith("HandlerRegister.res.mjs")) return { setHandler: (...a) => setHandlerCalls.push(a) };
    return orig.call(this, request, parent, ...rest);
  };
  try { require(target); } finally { Module._load = orig; }
  return { setHandlerCalls };
}
