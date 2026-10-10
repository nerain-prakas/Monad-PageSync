const RPC = "https://testnet-rpc.monad.xyz";
const KURU_MARKET = "0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9";

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const latestHex = await rpcCall('eth_blockNumber', []);
  const latest = parseInt(latestHex, 16);
  console.log("Current block:", latest);

  // Let's test getLogs in recent 1000 blocks to see if Kuru has ANY events
  console.log("Testing getLogs on Kuru in recent 10,000 blocks...");
  const recentLogs = await rpcCall('eth_getLogs', [{
    address: KURU_MARKET,
    fromBlock: "0x" + (latest - 10000).toString(16),
    toBlock: "0x" + latest.toString(16)
  }]);
  console.log(`Found ${recentLogs.length} logs in recent 10,000 blocks.`);

  // Let's test getLogs around block 68348601 (when PageSync was deployed)
  console.log("Testing getLogs on Kuru around block 68348600 - 68358600...");
  try {
    const pastLogs = await rpcCall('eth_getLogs', [{
      address: KURU_MARKET,
      fromBlock: "0x" + (68348600).toString(16),
      toBlock: "0x" + (68358600).toString(16)
    }]);
    console.log(`Found ${pastLogs.length} logs in 68348600 - 68358600.`);
  } catch (err) {
    console.log("Error querying 68348600 - 68358600:", err.message);
  }

  // Let's check code at 68348601
  try {
    const codePast = await rpcCall('eth_getCode', [KURU_MARKET, "0x" + (68348601).toString(16)]);
    console.log("Code length at 68348601:", codePast.length);
  } catch (err) {
    console.log("Error querying code at 68348601:", err.message);
  }
}

main().catch(console.error);
