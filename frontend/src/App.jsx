import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, createWalletClient, custom, defineChain, http, parseAbi } from 'viem';
import './App.css';
import StorageBenchmark3D from './components/StorageBenchmark3D';

const MONAD_CHAIN_ID = 10143;
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
const MONAD = defineChain({
  id: MONAD_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
});
const PAGE_SYNC_ADDRESS = '0x5De52bC09A2A688f6c4615099465e9049CC83bC1';
const ORDER_BOOK_ABI = parseAbi([
  'function placeOrder(uint256 orderId, uint256 price, uint256 quantity, uint8 side)',
  'function updateOrder(uint256 orderId, uint256 newPrice, uint256 newQuantity)',
  'function cancelOrder(uint256 orderId)',
  'function executeTrade(uint256 orderId)',
  'function getOrder(uint256 orderId) view returns (address trader, uint256 price, uint256 quantity, uint8 side, uint8 status)',
  'event OrderPlaced(uint256 indexed orderId, address indexed trader, uint256 price, uint256 quantity, uint8 side)',
]);
const orderPlacedEvent = ORDER_BOOK_ABI.find((item) => item.type === 'event' && item.name === 'OrderPlaced');
const publicClient = createPublicClient({ chain: MONAD, transport: http(MONAD_RPC) });
const KURU_MARKET_ADDRESS = '0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9';
const KURU_ABI = parseAbi([
  'function bestBidAsk() view returns (uint256 bestBid, uint256 bestAsk)',
]);
const KURU_EMPTY_PRICE = (1n << 256n) - 1n;

function useWallet() {
  const [account, setAccount] = useState();
  const [chainId, setChainId] = useState();
  const [walletClient, setWalletClient] = useState();
  const [walletError, setWalletError] = useState('');

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return undefined;
    const sync = async () => {
      const [accounts, currentChain] = await Promise.all([
        provider.request({ method: 'eth_accounts' }),
        provider.request({ method: 'eth_chainId' }),
      ]);
      setAccount(accounts[0]);
      setChainId(Number(currentChain));
      if (accounts[0]) setWalletClient(createWalletClient({ account: accounts[0], chain: MONAD, transport: custom(provider) }));
    };
    sync().catch(() => setWalletError('Unable to read wallet state.'));
    const onAccountsChanged = ([nextAccount]) => {
      setAccount(nextAccount);
      setWalletClient(nextAccount ? createWalletClient({ account: nextAccount, chain: MONAD, transport: custom(provider) }) : undefined);
    };
    const onChainChanged = (nextChain) => setChainId(Number(nextChain));
    provider.on?.('accountsChanged', onAccountsChanged);
    provider.on?.('chainChanged', onChainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  const connect = async () => {
    setWalletError('');
    if (!window.ethereum) {
      setWalletError('No injected wallet found. Install MetaMask or another EVM wallet.');
      return;
    }
    try {
      const [nextAccount, nextChain] = await Promise.all([
        window.ethereum.request({ method: 'eth_requestAccounts' }),
        window.ethereum.request({ method: 'eth_chainId' }),
      ]);
      const next = nextAccount[0];
      setAccount(next);
      setChainId(Number(nextChain));
      setWalletClient(createWalletClient({ account: next, chain: MONAD, transport: custom(window.ethereum) }));
    } catch (error) {
      setWalletError(error.shortMessage || error.message || 'Wallet connection was rejected.');
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      setChainId(MONAD_CHAIN_ID);
    } catch (error) {
      if (error.code !== 4902) {
        setWalletError(error.shortMessage || error.message || 'Unable to switch network.');
        return;
      }
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: '0x279f', chainName: MONAD.name, nativeCurrency: MONAD.nativeCurrency, rpcUrls: [MONAD_RPC], blockExplorerUrls: ['https://testnet.monadexplorer.com'] }],
      });
      setChainId(MONAD_CHAIN_ID);
    }
  };

  return { account, chainId, walletClient, walletError, connect, switchNetwork };
}

const CONTRACTS = {
  NaiveOrderBook: {
    address: '0x9eDDb8B7612954014Af0fFA58dc9d93dB2C75d68',
    slots: [
      { slot: 0, title: 'trader', type: 'address', bytes: 20, offset: 0, note: 'Order mapping word' },
      { slot: 1, title: 'price', type: 'uint256', bytes: 32, offset: 0, note: 'Order mapping word' },
      { slot: 2, title: 'quantity', type: 'uint256', bytes: 32, offset: 0, note: 'Order mapping word' },
      { slot: 3, title: 'side + status', type: 'uint8 + uint8', bytes: 2, offset: 0, note: 'Packed fields; 30 bytes unused' },
    ],
    words: 4,
  },
  PageSyncOrderBook: {
    address: '0x5De52bC09A2A688f6c4615099465e9049CC83bC1',
    slots: [
      { slot: 0, title: 'data1', type: 'packed trader + price', bytes: 32, offset: 0, note: 'Trader, price, reserved bits' },
      { slot: 1, title: 'data2', type: 'packed quantity + flags', bytes: 32, offset: 0, note: 'Quantity, side, status, padding' },
    ],
    words: 2,
  },
};

const RESULTS = [
  ['Placement', 99870, 81986],
  ['Second placement', 116950, 81998],
  ['Update', 36030, 36394],
  ['Cancel', 51769, 34806],
  ['Execute', 35273, 35294],
];

const sampleStruct = `struct Order {
    address trader;
    uint256 price;
    uint256 quantity;
    uint8 side;
    uint8 status;
}`;

const typeBytes = (type) => {
  const match = type.match(/^(u?int|bytes)(\d+)?$/);
  if (type === 'address') return 20;
  if (type === 'bool') return 1;
  if (match) return match[1] === 'bytes' ? Number(match[2] || 1) : Number(match[2] || 256) / 8;
  return null;
};

function analyzeStruct(source) {
  const structMatch = source.match(/struct\s+(\w+)\s*\{([\s\S]*?)\}/);
  if (!structMatch) throw new Error('Unable to determine layout: paste one Solidity struct declaration.');
  const fields = [];
  for (const line of structMatch[2].split(';')) {
    const clean = line.replace(/\/\/.*$/, '').trim();
    if (!clean) continue;
    const parts = clean.split(/\s+/);
    if (parts.length !== 2 || !/^(address|bool|u?int(8|16|32|64|128|256)?|bytes([1-9]|[12]\d|3[0-2]))$/.test(parts[0])) {
      throw new Error(`Unsupported type or declaration: "${clean}".`);
    }
    const bytes = typeBytes(parts[0]);
    if (!bytes) throw new Error(`Unsupported type: ${parts[0]}.`);
    fields.push({ name: parts[1], type: parts[0], bytes });
  }
  if (!fields.length) throw new Error('Unable to determine layout: no supported fields found.');
  const slots = [];
  let current = { slot: 0, used: 0, fields: [] };
  fields.forEach((field) => {
    if (field.bytes === 32 || current.used + field.bytes > 32) {
      if (current.fields.length) slots.push(current);
      current = { slot: current.slot + (current.fields.length ? 1 : 0), used: 0, fields: [] };
    }
    field.offset = current.used;
    field.slot = current.slot;
    field.packingGroup = current.fields.length ? `group-${current.slot}` : `single-${current.slot}`;
    current.fields.push(field);
    current.used += field.bytes;
  });
  if (current.fields.length) slots.push(current);
  const bytesUsed = fields.reduce((sum, field) => sum + field.bytes, 0);
  return { name: structMatch[1], fields, slots, bytesUsed, storageSlots: slots.length, capacity: slots.length * 32 };
}

const format = (value) => Number(value).toLocaleString();
const reduction = (naive, packed) => ((naive - packed) / naive * 100).toFixed(2);

function Button({ children, onClick, secondary = false, disabled = false }) {
  return <button className={secondary ? 'button secondary' : 'button'} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Analyzer() {
  const [source, setSource] = useState(sampleStruct);
  const [analysis, setAnalysis] = useState(() => analyzeStruct(sampleStruct));
  const [error, setError] = useState('');
  const run = () => {
    try { setAnalysis(analyzeStruct(source)); setError(''); } catch (err) { setAnalysis(null); setError(err.message); }
  };
  const copy = (text) => navigator.clipboard?.writeText(text);
  return <Page title="Struct Analyzer" eyebrow="TOOL / STORAGE OPTIMIZER" intro="See exactly how a supported Solidity struct maps into 32-byte storage slots.">
    <div className="tool-grid">
      <section className="card editor-card">
        <div className="card-head"><div><span className="label">SOLIDITY INPUT</span><h2>Paste a struct</h2></div><span className="chip">client-side</span></div>
        <textarea className="code-editor" value={source} onChange={(event) => setSource(event.target.value)} spellCheck="false" />
        <div className="supported"><span>Supported</span> address · uint/int8–256 · bool · bytes1–32</div>
        <Button onClick={run}>Analyze storage →</Button>
        {error && <div className="error-box">{error}</div>}
      </section>
      {analysis && <section className="card">
        <div className="card-head"><div><span className="label">LAYOUT REPORT</span><h2>{analysis.name}</h2></div><span className="chip green">{analysis.storageSlots} slots</span></div>
        <div className="metric-row"><Metric label="Storage slots" value={analysis.storageSlots} /><Metric label="Bytes used" value={`${analysis.bytesUsed} / ${analysis.capacity}`} /><Metric label="Unused bytes" value={analysis.capacity - analysis.bytesUsed} /></div>
        <div className="slot-list">{analysis.slots.map((slot) => <div className="slot" key={slot.slot} onClick={() => {}}>
          <div className="slot-title"><strong>Slot {slot.slot}</strong><span>{slot.capacity || 32 - slot.used} bytes unused</span></div>
          <div className="slot-bar">{slot.fields.map((field) => <div className="field-block" style={{ flexBasis: `${field.bytes / 32 * 100}%` }} key={field.name}><b>{field.name}</b><small>{field.bytes} bytes</small></div>)}</div>
          <div className="slot-meta">{slot.fields.map((field) => <span key={field.name}><b>{field.name}</b> · {field.type} · offset {field.offset}</span>)}</div>
        </div>)}</div>
        <div className="callout"><b>Potential optimization</b><span>{analysis.slots.some((slot) => slot.fields.length > 1) ? 'Small fields are packed together safely in the same storage slot.' : 'Group adjacent small fields to create a packing opportunity, after checking storage compatibility.'}</span></div>
        <div className="actions"><Button secondary onClick={() => copy(source)}>Copy analysis</Button><Button secondary onClick={() => copy(source)}>Copy struct</Button></div>
      </section>}
    </div>
  </Page>;
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function Inspector() {
  const [name, setName] = useState('NaiveOrderBook');
  const [selected, setSelected] = useState(0);
  const contract = CONTRACTS[name];
  const item = contract.slots[selected];
  return <Page title="Storage Inspector" eyebrow="TOOL / ONCHAIN LAYOUT" intro="Inspect the verified storage layout of the deployed PageSync research contracts.">
    <section className="card inspector-form"><div><span className="label">NETWORK</span><select value="Monad Testnet" disabled><option>Monad Testnet</option></select></div><div><span className="label">CONTRACT</span><select value={name} onChange={(event) => { setName(event.target.value); setSelected(0); }}><option>NaiveOrderBook</option><option>PageSyncOrderBook</option></select></div><div className="address"><span className="label">ADDRESS</span><code>{contract.address}</code></div></section>
    <div className="inspector-grid"><section className="card"><div className="card-head"><div><span className="label">VERIFIED STORAGE MAP</span><h2>{name}</h2></div><span className="chip">{contract.words} words / order</span></div><div className="storage-blocks">{contract.slots.map((slot, index) => <button className={`storage-block ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)} key={slot.slot}><span>WORD {slot.slot}</span><b>{slot.title}</b><small>{slot.bytes} bytes represented</small></button>)}</div></section><section className="card detail-card"><span className="label">SELECTED STORAGE WORD</span><h2>Slot {item.slot} · {item.title}</h2><dl><dt>Field</dt><dd>{item.title}</dd><dt>Type</dt><dd>{item.type}</dd><dt>Bytes</dt><dd>{item.bytes}</dd><dt>Byte offset</dt><dd>{item.offset}</dd><dt>Packing</dt><dd>{item.note}</dd></dl><div className="callout"><b>Interpretation</b><span>This view describes the known compiled layout; an arbitrary contract cannot be decoded from an address alone without its ABI and storage layout.</span></div></section></div>
  </Page>;
}

function Benchmark() {
  return <Page title="Gas Benchmark" eyebrow="TOOL / RECEIPT EVIDENCE" intro="Compare actual Monad Testnet receipt gas from the repeated controlled workload.">
    <section className="result-banner"><div><span className="label">REPEATED RESULT · 3 RUNS · 30 TRANSACTIONS</span><h2>PageSync median total gas is 20.42% lower</h2><p>All receipts returned status 1 on chain 10143. This is a workload-specific packed-storage result, not a guarantee.</p></div><span className="chip green">verified</span></section>
    <section className="card"><div className="toolbar"><div><span className="label">OPERATION COMPARISON</span><h2>NaiveOrderBook vs PageSyncOrderBook</h2></div><span className="muted">receipt gasUsed · lower is better</span></div><div className="table-wrap"><table><thead><tr><th>Operation</th><th>Naive</th><th>PageSync</th><th>Difference</th></tr></thead><tbody>{RESULTS.map(([label, naive, packed]) => <tr key={label}><td><b>{label}</b></td><td>{format(naive)}</td><td className="green-text">{format(packed)}</td><td><span className={packed <= naive ? 'positive' : 'negative'}>{reduction(naive, packed)}%</span></td></tr>)}</tbody></table></div></section>
    <div className="metric-grid"><Metric label="Naive median / run" value="339,892" /><Metric label="PageSync median / run" value="270,478" /><Metric label="Average reduction" value="20.05%" /><Metric label="Network" value="Monad 10143" /></div>
    <div className="callout warning"><b>Run live benchmark</b><span>A new benchmark sends transactions and requires wallet authorization. The displayed figures are the saved receipt results from the controlled test.</span><Button secondary onClick={() => {}}>Connect wallet to run live</Button></div>
  </Page>;
}

function Research() {
  const [mode, setMode] = useState('pagesync');
  const [trigger, setTrigger] = useState(0);
  return <Page title="PageSync Research" eyebrow="RESEARCH / MONAD CASE STUDY" intro="Packed storage on Monad, measured with actual transaction receipts.">
    <section className="research-hero"><div><span className="label">THE EXPERIMENT</span><h2>Fewer storage words, measurable difference</h2><p>NaiveOrderBook stores an Order across four compiled storage slots. PageSyncOrderBook stores the same logical data in two packed words. Both contracts still use mappings; this experiment does not prove a separate storage-page warming mechanism.</p></div><div className="toggle"><button className={mode === 'conventional' ? 'active' : ''} onClick={() => setMode('conventional')}>Naive</button><button className={mode === 'pagesync' ? 'active' : ''} onClick={() => setMode('pagesync')}>PageSync</button></div></section>
    <section className="visual-card"><div className="visual-head"><div><span className="label">INTERACTIVE STORAGE VISUALIZATION</span><h2>{mode === 'pagesync' ? 'Packed storage words' : 'Conventional order words'}</h2></div><Button onClick={() => setTrigger((value) => value + 1)}>Trigger trade</Button></div><StorageBenchmark3D key={trigger} mode={mode} /><p className="caption">Educational animation: highlighted blocks represent storage words accessed by the sample operation. It is not a direct visualization of EVM warm/cold state.</p></section>
    <section className="card research-copy"><span className="label">VERIFIED CONCLUSION</span><h2>Across three repeated Monad Testnet workloads, PageSyncOrderBook showed approximately 20.42% lower median total receipt gas than NaiveOrderBook.</h2><p>The largest measured differences were placement and cancellation. Update and execute were effectively similar. The result supports a workload-specific benefit from packed representation; it does not establish universal savings or page locality.</p></section>
  </Page>;
}

function KuruWorkspace({ wallet, go }) {
  const [quote, setQuote] = useState();
  const [marketError, setMarketError] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshMarket = async () => {
    setLoading(true);
    setMarketError('');
    try {
      const [bestBid, bestAsk] = await publicClient.readContract({
        address: KURU_MARKET_ADDRESS,
        abi: KURU_ABI,
        functionName: 'bestBidAsk',
      });
      setQuote({
        bestBid: bestBid === KURU_EMPTY_PRICE ? 'No resting orders' : bestBid.toString(),
        bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'No resting orders' : bestAsk.toString(),
        updatedAt: new Date(),
      });
    } catch (error) {
      setMarketError(error.shortMessage || error.message || 'Unable to read the Kuru market.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMarket();
  }, []);

  return <Page title="Kuru Market Workspace" eyebrow="PRODUCT / ONCHAIN FINANCE" intro="Monitor the live Monad testnet MON-USDC market while PageSync keeps storage and gas evidence separate from the trading venue.">
    <section className="trade-toolbar card">
      <div><span className="label">KURU · MON / USDC</span><h2>Real market, explicit prerequisites</h2><p className="form-note">Kuru is the trading venue. PageSync’s deployed order book remains a storage-optimization reference implementation and is not used for Kuru settlement.</p></div>
      <div className="network-actions">{!wallet.account ? <Button onClick={wallet.connect}>Connect Wallet</Button> : <span className="wallet-pill">{shortAddress(wallet.account)}</span>}{wallet.account && wallet.chainId !== MONAD_CHAIN_ID && <Button secondary onClick={wallet.switchNetwork}>Switch to Monad</Button>}<Button secondary onClick={refreshMarket} disabled={loading}>{loading ? 'Reading...' : 'Refresh market'}</Button></div>
    </section>
    {wallet.walletError && <div className="error-box">{wallet.walletError}</div>}
    {wallet.account && wallet.chainId !== MONAD_CHAIN_ID && <div className="callout warning"><b>Monad Testnet required</b><span>Kuru’s documented testnet market is on chain 10143. Switch networks before using any future trading controls.</span><Button secondary onClick={wallet.switchNetwork}>Switch Network</Button></div>}
    <div className="metric-grid"><Metric label="Market" value="MON / USDC" /><Metric label="Best bid" value={quote?.bestBid || '—'} /><Metric label="Best ask" value={quote?.bestAsk || '—'} /><Metric label="Network" value="Monad 10143" /></div>
    {marketError && <div className="error-box">{marketError}</div>}
    <div className="tool-grid">
      <section className="card"><div className="card-head"><div><span className="label">TOP OF BOOK</span><h2>Current market quote</h2></div><span className={`chip ${quote ? 'green' : ''}`}>{quote ? 'live RPC read' : 'unavailable'}</span></div><div className="kuru-book"><div><span>BEST BID</span><strong>{quote?.bestBid || '—'}</strong><small>raw market contract units</small></div><div><span>BEST ASK</span><strong>{quote?.bestAsk || '—'}</strong><small>raw market contract units</small></div></div><p className="form-note">The quote is read directly from Kuru’s deployed order-book contract. Full depth and transaction execution require the Kuru SDK, margin-account funding, and token approvals.</p></section>
      <section className="card"><div className="card-head"><div><span className="label">MARKET CONTRACT</span><h2>Kuru MON-USDC</h2></div><span className="chip">testnet</span></div><dl className="kuru-details"><dt>Market</dt><dd><code>{KURU_MARKET_ADDRESS}</code></dd><dt>Settlement</dt><dd>Kuru margin account</dd><dt>Quote asset</dt><dd>USDC</dd><dt>Base asset</dt><dd>MON</dd></dl><div className="actions"><a className="button secondary" href={`https://testnet.monadexplorer.com/address/${KURU_MARKET_ADDRESS}`} target="_blank" rel="noreferrer">View market ↗</a><Button secondary onClick={() => go('activity')}>Open indexed activity →</Button></div></section>
    </div>
    <section className="callout"><b>Trading status: read-only workspace</b><span>Before placing an order, a wallet must hold the required asset, deposit it into Kuru’s margin account, and approve the market flow. Trade execution will be added only after those contract interactions are verified end to end.</span></section>
  </Page>;
}

function Activity() {
  const [data, setData] = useState({ orders: [], trades: [], stats: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all(['/orders?limit=20', '/trades?limit=20', '/stats'].map((path) => fetch(`http://localhost:3001${path}`)));
      if (responses.some((response) => !response.ok)) throw new Error('The PageSync backend returned an error.');
      const [orders, trades, stats] = await Promise.all(responses.map((response) => response.json()));
      setData({ orders: orders.orders || [], trades: trades.trades || [], stats });
    } catch (requestError) {
      setError(`Envio activity is unavailable. Start the backend and Envio indexer to load historical data. (${requestError.message})`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);
  const envio = data.stats?.envio;
  return <Page title="Activity & Analytics" eyebrow="DATA / ENVIO INDEXED ACTIVITY" intro="Review indexed PageSync order activity and trades without confusing event history with receipt-level gas measurement.">
    <section className="trade-toolbar card"><div><span className="label">INDEXED DATA LAYER</span><h2>Envio activity</h2><p className="form-note">Events are indexed from the deployed reference contracts. Gas figures still come from transaction receipts and the benchmark artifacts.</p></div><Button secondary onClick={refresh} disabled={loading}>{loading ? 'Loading...' : 'Refresh activity'}</Button></section>
    {error && <div className="error-box">{error}</div>}
    <div className="metric-grid"><Metric label="Envio status" value={envio?.envioAvailable ? 'Connected' : 'Not running'} /><Metric label="Orders placed" value={envio?.ordersPlaced ?? '—'} /><Metric label="Trades executed" value={envio?.tradesExecuted ?? '—'} /><Metric label="Indexed orders loaded" value={data.orders.length} /></div>
    <section className="card"><div className="card-head"><div><span className="label">RECENT ORDER ACTIVITY</span><h2>OrderPlaced events</h2></div><span className="muted">latest 20</span></div>{data.orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Side</th><th>Price</th><th>Quantity</th><th>Contract</th><th>Transaction</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td><code>#{order.orderId}</code></td><td>{Number(order.side) === 0 ? 'BUY' : 'SELL'}</td><td>{order.price}</td><td>{order.quantity}</td><td><code>{shortAddress(order.contractAddress)}</code></td><td><a href={`https://testnet.monadexplorer.com/tx/${order.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">No indexed orders are available.</p>}</section>
    <section className="card"><div className="card-head"><div><span className="label">RECENT TRADES</span><h2>TradeExecuted events</h2></div><span className="muted">latest 20</span></div>{data.trades.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Price</th><th>Quantity</th><th>Transaction</th></tr></thead><tbody>{data.trades.map((trade) => <tr key={trade.id}><td><code>#{trade.orderId}</code></td><td>{trade.price}</td><td>{trade.quantity}</td><td><a href={`https://testnet.monadexplorer.com/tx/${trade.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">No indexed trades are available.</p>}</section>
  </Page>;
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

function Trade({ wallet, go }) {
  const [side, setSide] = useState(0);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState();
  const [editPrice, setEditPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [lastTx, setLastTx] = useState();
  const [history, setHistory] = useState([]);

  const refresh = async () => {
    setError('');
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 10_000n ? latestBlock - 10_000n : 0n;
      const chunkSize = 100n;
      const logs = [];
      for (let cursor = fromBlock; cursor <= latestBlock; cursor += chunkSize) {
        const toBlock = cursor + chunkSize - 1n > latestBlock ? latestBlock : cursor + chunkSize - 1n;
        logs.push(...await publicClient.getLogs({ address: PAGE_SYNC_ADDRESS, event: orderPlacedEvent, fromBlock: cursor, toBlock }));
      }
      const uniqueIds = [...new Set(logs.map((log) => log.args.orderId.toString()))];
      const nextOrders = await Promise.all(uniqueIds.map(async (id) => {
        try {
          const [trader, currentPrice, currentQuantity, currentSide, status] = await publicClient.readContract({
            address: PAGE_SYNC_ADDRESS, abi: ORDER_BOOK_ABI, functionName: 'getOrder', args: [BigInt(id)],
          });
          return { id, trader, price: currentPrice.toString(), quantity: currentQuantity.toString(), side: Number(currentSide), status: Number(status) };
        } catch {
          return null;
        }
      }));
      setOrders(nextOrders.filter(Boolean).reverse());
    } catch (refreshError) {
      setError(refreshError.shortMessage || refreshError.message || 'Unable to load orders from Monad Testnet.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const transact = async (operation, functionName, args, orderId) => {
    if (!wallet.walletClient || wallet.chainId !== MONAD_CHAIN_ID) return;
    setBusy(operation);
    setError('');
    try {
      const hash = await wallet.walletClient.writeContract({ address: PAGE_SYNC_ADDRESS, abi: ORDER_BOOK_ABI, functionName, args, account: wallet.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const gasUsed = receipt.gasUsed.toString();
      const transaction = { hash, gasUsed, operation, orderId: orderId?.toString() || '—', status: 'Confirmed' };
      setLastTx(transaction);
      setHistory((previous) => [transaction, ...previous].slice(0, 10));
      await refresh();
    } catch (transactionError) {
      setError(transactionError.shortMessage || transactionError.message || 'Transaction failed.');
    } finally {
      setBusy('');
    }
  };

  const place = () => {
    try {
      if (!price || !quantity || BigInt(price) <= 0n || BigInt(quantity) <= 0n) throw new Error('Price and quantity must be positive integers.');
      const orderId = BigInt(Date.now());
      transact('place', 'placeOrder', [orderId, BigInt(price), BigInt(quantity), side], orderId);
      setPrice('');
      setQuantity('');
    } catch (placeError) { setError(placeError.message); }
  };

  const update = (order) => {
    try {
      if (!editPrice || !editQuantity || BigInt(editPrice) <= 0n || BigInt(editQuantity) <= 0n) throw new Error('Price and quantity must be positive integers.');
      transact('update', 'updateOrder', [BigInt(order.id), BigInt(editPrice), BigInt(editQuantity)], BigInt(order.id));
      setEditing();
    } catch (updateError) { setError(updateError.message); }
  };

  const canTrade = wallet.account && wallet.chainId === MONAD_CHAIN_ID;
  const active = orders.filter((order) => order.status === 0);
  const buys = active.filter((order) => order.side === 0).sort((a, b) => Number(b.price) - Number(a.price));
  const sells = active.filter((order) => order.side === 1).sort((a, b) => Number(a.price) - Number(b.price));
  const mine = wallet.account ? orders.filter((order) => order.trader.toLowerCase() === wallet.account.toLowerCase()) : [];
  const statusName = ['OPEN', 'CANCELLED', 'EXECUTED'];

  return <Page title="PageSync — Smart Contract Storage Optimizer" eyebrow="ANALYZE → OPTIMIZE → MEASURE → VERIFY" intro="Use a real Monad Testnet transaction to see how PageSync packs an order into fewer storage words. The order book is the workload; storage optimization is the product.">
    <section className="trade-toolbar card">
      <div><span className="label">LIVE STORAGE OPTIMIZATION DEMO</span><h2>On-Chain Optimization Demo</h2><p className="form-note">Create a real order and inspect how PageSync stores it.</p></div>
      <div className="network-actions">{!wallet.account ? <Button onClick={wallet.connect}>Connect Wallet</Button> : <span className="wallet-pill">{shortAddress(wallet.account)}</span>}{wallet.chainId !== MONAD_CHAIN_ID && wallet.account && <Button secondary onClick={wallet.switchNetwork}>Switch to Monad</Button>}<Button secondary onClick={refresh}>Refresh</Button></div>
    </section>
    {wallet.walletError && <div className="error-box">{wallet.walletError}</div>}
    {wallet.account && wallet.chainId !== MONAD_CHAIN_ID && <div className="callout warning"><b>Please switch to Monad Testnet</b><span>Your wallet is on chain {wallet.chainId}; transactions are intentionally disabled until chain 10143 is selected.</span><Button secondary onClick={wallet.switchNetwork}>Switch Network</Button></div>}
    <section className="storage-summary"><div className="storage-summary-intro"><span className="label">PAGESYNC STORAGE OPTIMIZATION</span><h2>Conventional Order → PageSync PackedOrder</h2><p>Same logical order, fewer storage words. This is the layout written by the deployed contract.</p></div><div className="layout-compare"><div><b>BEFORE · CONVENTIONAL</b><span>Slot 0 · trader</span><span>Slot 1 · price</span><span>Slot 2 · quantity</span><span>Slot 3 · side / status</span><strong>4 storage words</strong></div><div className="compare-arrow">→</div><div className="after"><b>AFTER · PAGESYNC</b><span>Slot 0 · trader + price</span><span>Slot 1 · quantity + side + status</span><strong>2 storage words</strong></div></div></section>
    {lastTx && <section className="tx-banner"><div><b>Transaction Confirmed ✓</b><span>Operation: {lastTx.operation}</span><span>Gas Used: {format(lastTx.gasUsed)}</span></div><div><span className="muted">PageSync PackedOrder · 2 storage words</span><a href={`https://testnet.monadexplorer.com/tx/${lastTx.hash}`} target="_blank" rel="noreferrer">View receipt ↗</a></div></section>}
    {error && <div className="error-box">{error}</div>}
    <div className="orderbook-grid">
      <section className="card"><div className="card-head"><div><span className="label">TRANSACTION WORKLOAD</span><h2>Create a real order</h2></div><span className="chip green">Monad Testnet</span></div><div className="side-toggle"><button className={side === 0 ? 'active' : ''} onClick={() => setSide(0)}>BUY</button><button className={side === 1 ? 'active sell' : ''} onClick={() => setSide(1)}>SELL</button></div><label>Price<input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ''))} placeholder="1000" /></label><label>Quantity<input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ''))} placeholder="10" /></label><Button onClick={place} disabled={!canTrade || busy === 'place'}>{busy === 'place' ? 'Confirming...' : 'Write to PageSync →'}</Button><p className="form-note">BUY / SELL are parameters of the existing order-book workload, not a separate trading product.</p><div className="contract-secondary"><span>Monad Testnet</span><code>PageSyncOrderBook</code><a href={`https://testnet.monadexplorer.com/address/${PAGE_SYNC_ADDRESS}`} target="_blank" rel="noreferrer">View Contract ↗</a></div></section>
      <section className="card"><div className="card-head"><div><span className="label">RECORDED EVIDENCE</span><h2>Gas comparison</h2></div><span className="chip">not a live saving claim</span></div><div className="gas-evidence"><div><b>YOUR LIVE TRANSACTION</b><strong>{lastTx ? `${format(lastTx.gasUsed)} gas` : '—'}</strong><span>PageSync receipt</span></div><div><b>RECORDED BENCHMARK</b><span>Naive median · {format(RESULTS[0][1])} gas</span><span>PageSync median · {format(RESULTS[0][2])} gas</span><strong>{reduction(RESULTS[0][1], RESULTS[0][2])}% lower</strong></div></div><p className="form-note">Recorded benchmark comparison. It does not claim that your live transaction saved this exact amount.</p></section>
    </div>
    <section className="card my-orders"><div className="card-head"><div><span className="label">WALLET-SCOPED OPERATIONS</span><h2>Your PageSync Transactions</h2></div><span className="muted">{history.length} recent operation{history.length === 1 ? '' : 's'}</span></div>{history.length ? <div className="table-wrap"><table><thead><tr><th>Operation</th><th>Order ID</th><th>Gas Used</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{history.map((item, index) => <tr key={`${item.hash}-${index}`}><td>{item.operation.toUpperCase()}</td><td><code>#{item.orderId}</code></td><td>{format(item.gasUsed)} gas</td><td><span className="status status-0">{item.status}</span></td><td><a href={`https://testnet.monadexplorer.com/tx/${item.hash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">Confirmed PageSync operations will appear here after you connect a wallet and write a transaction.</p>}</section>
    <section className="card order-state"><div className="card-head"><div><span className="label">CONTRACT STATE</span><h2>Orders represented by PageSync</h2></div><span className="muted">{mine.length} owned · {active.length} active workload orders</span></div><div className="book-columns"><OrderTable title="SELL WORKLOAD" rows={sells} empty="No active sell orders" /><OrderTable title="BUY WORKLOAD" rows={buys} empty="No active buy orders" /></div>{wallet.account && mine.length > 0 && <div className="table-wrap state-table"><table><thead><tr><th>Order ID</th><th>Side</th><th>Status</th><th>Contract actions</th></tr></thead><tbody>{mine.map((order) => <tr key={order.id}><td><code>#{order.id}</code></td><td>{order.side === 0 ? 'BUY' : 'SELL'}</td><td><span className={`status status-${order.status}`}>{statusName[order.status]}</span></td><td>{order.status === 0 && <div className="row-actions"><button onClick={() => { setEditing(order.id); setEditPrice(order.price); setEditQuantity(order.quantity); }}>Update</button><button onClick={() => transact('cancel', 'cancelOrder', [BigInt(order.id)], BigInt(order.id))} disabled={!canTrade || !!busy}>Cancel</button><button onClick={() => transact('execute', 'executeTrade', [BigInt(order.id)], BigInt(order.id))} disabled={!canTrade || !!busy}>Execute</button>{editing === order.id && <span className="inline-edit"><input value={editPrice} onChange={(event) => setEditPrice(event.target.value.replace(/\D/g, ''))} placeholder="price" /><input value={editQuantity} onChange={(event) => setEditQuantity(event.target.value.replace(/\D/g, ''))} placeholder="qty" /><button onClick={() => update(order)}>Save</button><button onClick={() => setEditing()}>Close</button></span>}</div>}</td></tr>)}</tbody></table></div>}</section>
    <section className="card storage-proof"><span className="label">HOW PAGESYNC STORED IT</span><h2>PageSync PackedOrder</h2><p>After a confirmed operation, the deployed contract decodes the order as two packed storage words. <strong>Slot 0:</strong> trader + price + reserved. <strong>Slot 1:</strong> quantity + side + status.</p><div className="metric-row"><Metric label="Storage words / order" value="2" /><Metric label="Packed fields" value="5" /><Metric label="Conventional layout" value="4 words" /></div><div className="actions"><Button secondary onClick={() => go('inspector')}>Inspect Storage</Button><Button secondary onClick={() => go('analyzer')}>Compare Layout</Button></div></section>
  </Page>;
}

function OrderTable({ title, rows, empty }) {
  return <div className="book-table"><h3>{title}</h3><div className="book-head"><span>Price</span><span>Quantity</span></div>{rows.length ? rows.map((order) => <div className="book-row" key={order.id}><span>{order.price}</span><span>{order.quantity}</span></div>) : <p className="empty-state">{empty}</p>}</div>;
}

function Home({ go }) {
  return <Page home><section className="hero"><div><span className="label">PAGESYNC / SMART CONTRACT STORAGE OPTIMIZER</span><h1>Analyze. Optimize.<br /><em>Measure. Verify.</em></h1><p>Understand Solidity storage layouts, compare compact representations, and verify the result with a real Monad Testnet transaction.</p><div className="actions"><Button onClick={() => go('trade')}>Open optimization demo →</Button><Button secondary onClick={() => go('analyzer')}>Analyze Solidity struct</Button><Button secondary onClick={() => go('benchmark')}>Compare gas</Button></div></div><div className="hero-art"><div className="art-grid">{Array.from({ length: 16 }, (_, index) => <i className={index % 3 === 0 ? 'lit' : ''} key={index} />)}</div><span>analyze / optimize / measure / verify</span></div></section><div className="feature-grid"><Feature number="01" title="Struct Analyzer" text="Map Solidity types to storage slots, offsets, and packing groups." onClick={() => go('analyzer')} /><Feature number="02" title="On-Chain Optimization Demo" text="Create a real order and inspect how PageSync writes its compact layout." onClick={() => go('trade')} /><Feature number="03" title="Receipt Evidence" text="Compare actual gas from Monad Testnet against conventional storage benchmarks." onClick={() => go('benchmark')} /></div></Page>;
}

function Feature({ number, title, text, onClick }) { return <button className="feature" onClick={onClick}><span>{number}</span><h2>{title} ↗</h2><p>{text}</p></button>; }
function Page({ title, eyebrow, intro, children, home }) { return <main className={home ? 'page home-page' : 'page'}>{!home && <header className="page-title"><span className="label">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></header>}{children}</main>; }

export default function App() {
  const [page, setPage] = useState('home');
  const wallet = useWallet();
  const content = useMemo(() => ({ home: <Home go={setPage} />, trade: <Trade wallet={wallet} go={setPage} />, kuru: <KuruWorkspace wallet={wallet} go={setPage} />, activity: <Activity />, analyzer: <Analyzer />, inspector: <Inspector />, benchmark: <Benchmark />, research: <Research /> }[page]), [page, wallet]);
  return <div className="app-shell"><aside className="sidebar"><button className="logo" onClick={() => setPage('home')}><span>PS</span><b>Page<span>Sync</span></b></button><nav><button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>Overview</button><button className={page === 'kuru' ? 'active live-nav' : 'live-nav'} onClick={() => setPage('kuru')}>Kuru Market <span>LIVE</span></button><button className={page === 'activity' ? 'active' : ''} onClick={() => setPage('activity')}>Activity</button><p>PRODUCT / TOOLS</p><button className={page === 'trade' ? 'active' : ''} onClick={() => setPage('trade')}>Optimization Demo</button><button className={page === 'analyzer' ? 'active' : ''} onClick={() => setPage('analyzer')}>Struct Analyzer</button><button className={page === 'inspector' ? 'active' : ''} onClick={() => setPage('inspector')}>Storage Inspector</button><button className={page === 'benchmark' ? 'active' : ''} onClick={() => setPage('benchmark')}>Gas Benchmark</button><p>RESEARCH</p><button className={page === 'research' ? 'active' : ''} onClick={() => setPage('research')}>Monad Case Study</button></nav><div className="sidebar-foot"><span className="dot" /> Monad Testnet <small>chain 10143</small></div></aside><div className="main"><header className="topbar"><span>PageSync / {page === 'home' ? 'Workspace' : page}</span><span className="top-status">{wallet.account ? `● ${shortAddress(wallet.account)}` : '● connect wallet to inspect'}</span></header>{content}<footer>PageSync — smart contract storage optimizer <span>Analyze · Optimize · Measure · Verify</span></footer></div></div>;
}
