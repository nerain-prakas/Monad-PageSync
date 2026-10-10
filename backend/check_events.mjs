const RPC = "https://testnet-rpc.monad.xyz";

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  console.log("Checking Monad connection...");
  const blockNumHex = await rpcCall('eth_blockNumber', []);
  const blockNum = parseInt(blockNumHex, 16);
  console.log("Current block number:", blockNum);

  // Check known benchmark tx receipts:
  const sampleTxs = [
    { name: "NaiveOrderBook place (run 1)", hash: "0xec666827929cbd69d2de4235158de173998c5e20cd7374324a48e445025e082e" },
    { name: "NaiveOrderBook update (run 1)", hash: "0x72e2b2a85ce2546002c3ff209fbadaa5c2587a4eb4540e5023fdb0a0c328c1f3" },
    { name: "NaiveOrderBook cancel (run 1)", hash: "0x01dc8ab0f38ba1b9c91022ba2f63681b1330d2632558340d99323177c8f9e32e" },
    { name: "NaiveOrderBook execute (run 1)", hash: "0xef069ad03e175598074e054b1fa7d81543ab8b0fe7daabe401b02e14290bfcad" },
    { name: "PageSyncOrderBook place (run 1)", hash: "0xbd988e767bf279746410db2e16163c7ed58e92690d62ae020875c5d2b6c038d6" },
    { name: "PageSyncOrderBook update (run 1)", hash: "0x359756236cced308e2d84f56e8b8e78f122b8e256d6bfaf4c7657776a164946c" },
    { name: "PageSyncOrderBook cancel (run 1)", hash: "0x282b04fe7cb7764d601bf8bf87137fae4de26cc5e455057b6df84da7aae1107a" },
    { name: "PageSyncOrderBook execute (run 1)", hash: "0xa2c9944879f870a33171cfff5756d20dcd3a44d95fa1f1c0207456ed7bd6b63c" }
  ];

  for (const item of sampleTxs) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [item.hash]);
    if (!receipt) {
      console.log(`Receipt for ${item.name} (${item.hash}) NOT FOUND`);
    } else {
      console.log(`Receipt for ${item.name}: status=${receipt.status}, block=${parseInt(receipt.blockNumber, 16)}, logs=${receipt.logs.length}`);
      for (const log of receipt.logs) {
        console.log(`   Log from ${log.address}, topic0=${log.topics[0]}, topics=${log.topics.length}, data=${log.data}`);
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
