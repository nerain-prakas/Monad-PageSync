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

async function scanRange(from, to, step = 100) {
  console.log(`Scanning Kuru from ${from} to ${to}...`);
  let totalLogs = 0;
  for (let b = from; b <= to; b += step) {
    const end = Math.min(b + step - 1, to);
    try {
      const logs = await rpcCall('eth_getLogs', [{
        address: KURU_MARKET,
        fromBlock: "0x" + b.toString(16),
        toBlock: "0x" + end.toString(16)
      }]);
      if (logs.length > 0) {
        console.log(`Found ${logs.length} logs in blocks ${b}-${end}!`);
        for (const log of logs) {
          console.log(`   tx: ${log.transactionHash}, topic0: ${log.topics[0]}, block: ${parseInt(log.blockNumber, 16)}`);
        }
        totalLogs += logs.length;
      }
    } catch (err) {
      console.log(`Error in ${b}-${end}:`, err.message);
    }
  }
  return totalLogs;
}

async function main() {
  const latestHex = await rpcCall('eth_blockNumber', []);
  const latest = parseInt(latestHex, 16);
  console.log("Current block:", latest);

  // 1. Scan around the PageSync benchmark blocks (68352700 - 68355000)
  const count1 = await scanRange(68352700, 68354700, 100);
  console.log("Total logs in benchmark range:", count1);

  // 2. Scan recent 500 blocks before latest
  const count2 = await scanRange(latest - 500, latest, 100);
  console.log("Total logs in recent 500 blocks:", count2);
}

main().catch(console.error);
