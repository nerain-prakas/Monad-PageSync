 import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, createWalletClient, custom, decodeEventLog, defineChain, formatUnits, http, parseAbi, parseUnits } from 'viem';
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
  'function getMarketParams() view returns (uint96 pricePrecision, uint96 sizePrecision, address baseAssetAddress, uint8 baseAssetDecimals, address quoteAssetAddress, uint8 quoteAssetDecimals, uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps, uint256 makerFeeBps)',
  'function addBuyOrder(uint32 price, uint96 size, bool postOnly)',
  'function addSellOrder(uint32 price, uint96 size, bool postOnly)',
  'function batchCancelOrders(uint40[] orderIds)',
  'event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)',
  'event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)',
  'event OrdersCanceled(uint40[] orderId, address owner)',
]);
const KURU_EMPTY_PRICE = (1n << 256n) - 1n;
const MARGIN_ACCOUNT_ADDRESS = '0xd029C2D98ff85D8F64799017fE00a59B1159CE02';
const USDC_ADDRESS = '0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570';
const MARGIN_ABI = parseAbi([
  'function deposit(address user, address token, uint256 amount) payable',
  'function getBalance(address user, address token) view returns (uint256)',
]);
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);
const KURU_ORDER_CREATED_EVENT = KURU_ABI.find((item) => item.type === 'event' && item.name === 'OrderCreated');
const KURU_TRADE_EVENT = KURU_ABI.find((item) => item.type === 'event' && item.name === 'Trade');
const KURU_CANCELLED_EVENT = KURU_ABI.find((item) => item.type === 'event' && item.name === 'OrdersCanceled');

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
  const [params, setParams] = useState();
  const [balances, setBalances] = useState();
  const [orders, setOrders] = useState([]);
  const [marketError, setMarketError] = useState('');
  const [readErrors, setReadErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [tx, setTx] = useState();
  const [form, setForm] = useState({ side: 'buy', price: '', quantity: '', postOnly: true, depositUsdc: '10', depositMon: '1' });

  const refreshMarket = async () => {
    setLoading(true);
    setMarketError('');
    setReadErrors([]);
    try {
      const [[bestBid, bestAsk], marketParams] = await Promise.all([
        publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'bestBidAsk' }),
        publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'getMarketParams' }),
      ]);
      setQuote({ bestBid: bestBid === KURU_EMPTY_PRICE ? 'No resting orders' : bestBid.toString(), bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'No resting orders' : bestAsk.toString() });
      setParams({
        pricePrecision: marketParams[0], sizePrecision: marketParams[1], baseAssetAddress: marketParams[2],
        baseDecimals: Number(marketParams[3]), quoteAssetAddress: marketParams[4], quoteDecimals: Number(marketParams[5]),
        tickSize: marketParams[6], minSize: marketParams[7], maxSize: marketParams[8],
      });
      if (wallet.account && wallet.chainId === MONAD_CHAIN_ID) {
        const [nativeBalance, usdcBalance, usdcAllowance, monMargin, usdcMargin] = await Promise.all([
          publicClient.getBalance({ address: wallet.account }),
          publicClient.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet.account] }),
          publicClient.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [wallet.account, MARGIN_ACCOUNT_ADDRESS] }),
          publicClient.readContract({ address: MARGIN_ACCOUNT_ADDRESS, abi: MARGIN_ABI, functionName: 'getBalance', args: [wallet.account, '0x0000000000000000000000000000000000000000'] }),
          publicClient.readContract({ address: MARGIN_ACCOUNT_ADDRESS, abi: MARGIN_ABI, functionName: 'getBalance', args: [wallet.account, USDC_ADDRESS] }),
        ]);
        setBalances({ nativeBalance, usdcBalance, usdcAllowance, monMargin, usdcMargin });
      } else {
        setBalances();
      }
    } catch (error) {
      const message = error.shortMessage || error.message || 'Unable to read Kuru market state.';
      console.error('Kuru prerequisite RPC read failed', { rpcMethod: 'eth_call', message, error });
      setMarketError(`Kuru prerequisite RPC read failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = async () => {
    if (!wallet.account || wallet.chainId !== MONAD_CHAIN_ID) {
      setOrders([]);
      return;
    }
    try {
      const latestBlock = await publicClient.getBlockNumber();
      // Monad Testnet rejects the large response produced by a broad market log query
      // with HTTP 413. Keep this browser-side refresh bounded to a safe recent window.
      const fromBlock = latestBlock > 100n ? latestBlock - 100n : 0n;
      const [createdLogs, tradeLogs, cancelledLogs] = await Promise.all([
        publicClient.getLogs({ address: KURU_MARKET_ADDRESS, event: KURU_ORDER_CREATED_EVENT, fromBlock, toBlock: latestBlock }),
        publicClient.getLogs({ address: KURU_MARKET_ADDRESS, event: KURU_TRADE_EVENT, fromBlock, toBlock: latestBlock }),
        publicClient.getLogs({ address: KURU_MARKET_ADDRESS, event: KURU_CANCELLED_EVENT, fromBlock, toBlock: latestBlock }),
      ]);
      const mine = createdLogs.filter((log) => log.args.owner?.toLowerCase() === wallet.account.toLowerCase());
      const next = mine.map((log) => {
        const orderId = log.args.orderId.toString();
        const trades = tradeLogs.filter((trade) => trade.args.orderId.toString() === orderId && (trade.args.makerAddress?.toLowerCase() === wallet.account.toLowerCase() || trade.args.takerAddress?.toLowerCase() === wallet.account.toLowerCase()));
        const cancelled = cancelledLogs.some((cancelledLog) => cancelledLog.args.owner?.toLowerCase() === wallet.account.toLowerCase() && cancelledLog.args.orderId.map(String).includes(orderId));
        const originalRaw = log.args.size;
        const remainingRaw = trades.length ? trades[trades.length - 1].args.updatedSize : originalRaw;
        const filledRaw = trades.reduce((total, trade) => total + trade.args.filledSize, 0n);
        const status = cancelled ? 'Cancelled' : remainingRaw === 0n ? 'Filled' : filledRaw > 0n ? 'Partially Filled' : 'Confirmed';
        return { id: orderId, side: log.args.isBuy ? 'BUY' : 'SELL', price: log.args.price, original: originalRaw, remaining: remainingRaw, filled: filledRaw, status, hash: log.transactionHash };
      });
      setOrders(next.reverse());
    } catch (error) {
      const message = error.shortMessage || error.message || 'Unable to load Kuru order activity.';
      console.error('Kuru order-history RPC read failed', {
        rpcMethod: 'eth_getLogs',
        contract: KURU_MARKET_ADDRESS,
        fromBlockWindow: 'latest - 100 blocks',
        message,
        error,
      });
      setReadErrors((current) => [...current, `Order history unavailable (eth_getLogs): ${message}`]);
    }
  };

  useEffect(() => { refreshMarket(); }, [wallet.account, wallet.chainId]);
  useEffect(() => { refreshOrders(); }, [wallet.account, wallet.chainId]);

  const sendTransaction = async (label, request) => {
    if (!wallet.walletClient || !wallet.account || wallet.chainId !== MONAD_CHAIN_ID) throw new Error('Connect a wallet on Monad Testnet first.');
    setBusy(label);
    setTx({ label, status: 'Pending' });
    try {
      const hash = await request();
      setTx({ label, status: 'Pending', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction was mined but failed.');
      setTx({ label, status: 'Confirmed', hash });
      await Promise.all([refreshMarket(), refreshOrders()]);
      return receipt;
    } catch (error) {
      setTx({ label, status: 'Failed', hash: error.transactionHash, error: error.shortMessage || error.message || 'Transaction rejected or failed.' });
      throw error;
    } finally {
      setBusy('');
    }
  };

  const approveUsdc = async () => {
    try {
      await sendTransaction('Approve USDC', () => wallet.walletClient.writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [MARGIN_ACCOUNT_ADDRESS, parseUnits(form.depositUsdc || '0', 6)], account: wallet.account }));
    } catch {}
  };

  const deposit = async (token, amount, decimals) => {
    try {
      const value = parseUnits(amount || '0', decimals);
      await sendTransaction(`Deposit ${token}`, () => wallet.walletClient.writeContract({ address: MARGIN_ACCOUNT_ADDRESS, abi: MARGIN_ABI, functionName: 'deposit', args: [wallet.account, token === 'MON' ? '0x0000000000000000000000000000000000000000' : USDC_ADDRESS, value], value: token === 'MON' ? value : 0n, account: wallet.account }));
    } catch {}
  };

  const placeOrder = async () => {
    try {
      if (!params) throw new Error('Market parameters are still loading.');
      if (!form.price || !form.quantity) throw new Error('Enter a price and quantity.');
      const price = parseUnits(form.price, 8);
      const size = parseUnits(form.quantity, 10);
      if (price <= 0n || size <= 0n) throw new Error('Price and quantity must be positive.');
      if (price % params.tickSize !== 0n) throw new Error(`Price must follow the market tick size of ${params.tickSize} raw units.`);
      if (size < params.minSize || size > params.maxSize) throw new Error(`Quantity must be between ${formatUnits(params.minSize, 10)} and ${formatUnits(params.maxSize, 10)} MON.`);
      const marginRequired = form.side === 'buy'
        ? (price * size * 10n ** 6n) / (10n ** 8n * 10n ** 10n)
        : (size * 10n ** 18n) / 10n ** 10n;
      const available = form.side === 'buy' ? balances?.usdcMargin : balances?.monMargin;
      if (!available || available < marginRequired) throw new Error(`Insufficient ${form.side === 'buy' ? 'USDC' : 'MON'} margin. Deposit the required asset first.`);
      const receipt = await sendTransaction('Place Kuru limit order', () => wallet.walletClient.writeContract({
        address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: form.side === 'buy' ? 'addBuyOrder' : 'addSellOrder',
        args: [price, size, form.postOnly], account: wallet.account,
      }));
      const created = receipt.logs.map((log) => { try { return decodeEventLog({ abi: KURU_ABI, data: log.data, topics: log.topics }); } catch { return null; } }).find((event) => event?.eventName === 'OrderCreated');
      if (created) setTx((current) => ({ ...current, orderId: created.args.orderId.toString() }));
      setForm((current) => ({ ...current, price: '', quantity: '' }));
    } catch (error) {
      setTx({ label: 'Place Kuru limit order', status: 'Failed', error: error.shortMessage || error.message || 'Order failed.' });
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await sendTransaction(`Cancel Kuru order #${orderId}`, () => wallet.walletClient.writeContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'batchCancelOrders', args: [[BigInt(orderId)]], account: wallet.account }));
    } catch {}
  };

  const tradingReady = Boolean(wallet.account && wallet.chainId === MONAD_CHAIN_ID && balances && params);
  const estimateValue = form.price && form.quantity ? Number(form.price) * Number(form.quantity) : 0;
  const fmt = (value, decimals) => value === undefined ? '—' : `${Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}`;

  return <Page title="Kuru Market Workspace" eyebrow="PRODUCT / ONCHAIN FINANCE" intro="Trade the real Monad Testnet MON/USDC market through Kuru. PageSyncOrderBook remains a separate storage-optimization reference implementation.">
    <section className="trade-toolbar card"><div><span className="label">KURU · MON / USDC</span><h2>Real trading venue</h2><p className="form-note">Kuru handles MON/USDC settlement through its MarginAccount. PageSyncOrderBook is not used for Kuru trading.</p></div><div className="network-actions">{!wallet.account ? <Button onClick={wallet.connect}>Connect Wallet</Button> : <span className="wallet-pill">{shortAddress(wallet.account)}</span>}{wallet.account && wallet.chainId !== MONAD_CHAIN_ID && <Button secondary onClick={wallet.switchNetwork}>Switch to Monad</Button>}<Button secondary onClick={refreshMarket} disabled={loading}>{loading ? 'Reading...' : 'Refresh market'}</Button></div></section>
    {wallet.walletError && <div className="error-box">{wallet.walletError}</div>}
    {marketError && <div className="error-box">{marketError}</div>}
    {readErrors.map((message) => <div className="error-box" key={message}>{message}</div>)}
    <section className="card kuru-status"><div className="card-head"><div><span className="label">TRADING STATUS</span><h2>Prerequisites</h2></div><span className={`chip ${tradingReady ? 'green' : ''}`}>{tradingReady ? 'wallet state loaded' : 'not ready'}</span></div><div className="status-grid"><StatusLine label="Wallet" value={wallet.account ? `Connected · ${shortAddress(wallet.account)}` : 'Disconnected'} ok={Boolean(wallet.account)} /><StatusLine label="Network" value={wallet.chainId === MONAD_CHAIN_ID ? 'Monad Testnet' : wallet.chainId ? `Wrong network · chain ${wallet.chainId}` : 'Not connected'} ok={wallet.chainId === MONAD_CHAIN_ID} /><StatusLine label="Market" value="Kuru MON / USDC" ok={Boolean(params)} /><StatusLine label="MarginAccount" value={shortAddress(MARGIN_ACCOUNT_ADDRESS)} ok={Boolean(balances)} /><StatusLine label="USDC approval" value={balances ? `${fmt(balances.usdcAllowance, 6)} USDC allowance` : 'Connect wallet to check'} ok={Boolean(balances?.usdcAllowance > 0n)} /><StatusLine label="Margin balances" value={balances ? `${fmt(balances.monMargin, 18)} MON · ${fmt(balances.usdcMargin, 6)} USDC` : 'Connect wallet to check'} ok={Boolean(balances && (balances.monMargin > 0n || balances.usdcMargin > 0n))} /></div><strong className={tradingReady ? 'ready-text' : 'warning-text'}>{tradingReady ? 'Trading controls available after balance and validation checks.' : 'Trading not ready — complete the missing wallet, network, and margin prerequisites.'}</strong></section>
    <div className="metric-grid"><Metric label="Best bid" value={quote?.bestBid || '—'} /><Metric label="Best ask" value={quote?.bestAsk || '—'} /><Metric label="Wallet MON" value={fmt(balances?.nativeBalance, 18)} /><Metric label="Wallet USDC" value={fmt(balances?.usdcBalance, 6)} /></div>
    <div className="tool-grid"><section className="card"><div className="card-head"><div><span className="label">MARGIN FUNDING</span><h2>Fund Kuru balances</h2></div><span className="chip">real transactions</span></div><label>USDC amount<input inputMode="decimal" value={form.depositUsdc} onChange={(event) => setForm({ ...form, depositUsdc: event.target.value })} placeholder="10" /></label><div className="actions"><Button secondary onClick={approveUsdc} disabled={!wallet.account || wallet.chainId !== MONAD_CHAIN_ID || busy === 'Approve USDC'}>{busy === 'Approve USDC' ? 'Approving...' : 'Approve USDC'}</Button><Button onClick={() => deposit('USDC', form.depositUsdc, 6)} disabled={!wallet.account || wallet.chainId !== MONAD_CHAIN_ID || busy === 'Deposit USDC'}>{busy === 'Deposit USDC' ? 'Depositing...' : 'Deposit USDC'}</Button></div><label>MON amount<input inputMode="decimal" value={form.depositMon} onChange={(event) => setForm({ ...form, depositMon: event.target.value })} placeholder="1" /></label><Button onClick={() => deposit('MON', form.depositMon, 18)} disabled={!wallet.account || wallet.chainId !== MONAD_CHAIN_ID || busy === 'Deposit MON'}>{busy === 'Deposit MON' ? 'Depositing...' : 'Deposit MON'}</Button><p className="form-note">Buy orders require USDC margin. Sell orders require MON margin. Deposits are confirmed only after the Monad receipt succeeds.</p></section>
      <section className="card"><div className="card-head"><div><span className="label">LIMIT ORDER</span><h2>Place on Kuru MON / USDC</h2></div><span className="chip green">Kuru venue</span></div><div className="side-toggle"><button className={form.side === 'buy' ? 'active' : ''} onClick={() => setForm({ ...form, side: 'buy' })}>BUY MON</button><button className={form.side === 'sell' ? 'active sell' : ''} onClick={() => setForm({ ...form, side: 'sell' })}>SELL MON</button></div><label>Price · USDC per MON<input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="1.001" /></label><label>Quantity · MON<input inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="200" /></label><label className="checkbox-row"><input type="checkbox" checked={form.postOnly} onChange={(event) => setForm({ ...form, postOnly: event.target.checked })} /> Post-only order</label><div className="order-value">Estimated order value: <strong>{estimateValue ? `${estimateValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC` : '—'}</strong></div><Button onClick={placeOrder} disabled={!tradingReady || !!busy}>{busy === 'Place Kuru limit order' ? 'Confirming...' : 'Place Kuru order →'}</Button><p className="form-note">Market parameters: tick {params ? formatUnits(params.tickSize, 8) : '—'} · min {params ? formatUnits(params.minSize, 10) : '—'} MON · max {params ? formatUnits(params.maxSize, 10) : '—'} MON.</p></section></div>
    {tx && <section className={`tx-banner ${tx.status === 'Failed' ? 'tx-failed' : ''}`}><div><b>{tx.label} · {tx.status}</b>{tx.orderId && <span>Order ID: #{tx.orderId}</span>}{tx.error && <span>{tx.error}</span>}{tx.hash && <a href={`https://testnet.monadexplorer.com/tx/${tx.hash}`} target="_blank" rel="noreferrer">Transaction {shortAddress(tx.hash)} ↗</a>}</div></section>}
    <section className="card"><div className="card-head"><div><span className="label">YOUR KURU ORDERS</span><h2>Confirmed MON/USDC orders</h2></div><span className="muted">{orders.length} indexed from recent events</span></div>{orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Side</th><th>Price</th><th>Original</th><th>Remaining</th><th>Filled</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><code>#{order.id}</code><br /><a href={`https://testnet.monadexplorer.com/tx/${order.hash}`} target="_blank" rel="noreferrer">Tx ↗</a></td><td>{order.side}</td><td>{order.price.toString()}</td><td>{formatUnits(order.original, 10)}</td><td>{formatUnits(order.remaining, 10)}</td><td>{formatUnits(order.filled, 10)}</td><td><span className="status">{order.status}</span></td><td>{['Confirmed', 'Partially Filled'].includes(order.status) && <Button secondary onClick={() => cancelOrder(order.id)} disabled={!!busy}>Cancel</Button>}</td></tr>)}</tbody></table></div> : <p className="empty-state">Connect a Monad wallet and place a confirmed Kuru order to see it here.</p>}</section>
    <section className="card"><span className="label">REFERENCE IMPLEMENTATION</span><h2>PageSyncOrderBook ≠ Kuru</h2><p className="form-note">The PageSync order-book controls remain available under Optimization Demo and continue to measure packed storage. Kuru MON/USDC transactions above use only the verified Kuru market contract.</p><Button secondary onClick={() => go('trade')}>Open PageSync Optimization Demo →</Button></section>
  </Page>;
}

function StatusLine({ label, value, ok }) {
  return <div className="status-line"><span>{label}</span><strong className={ok ? 'status-ok' : 'status-missing'}>{ok ? '✓' : '!'}</strong><b>{value}</b></div>;
}

function Activity() {
  const [data, setData] = useState({ orders: [], trades: [], kuru: { orders: [], trades: [], cancellations: [] }, stats: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all(['/orders?limit=20', '/trades?limit=20', '/stats', '/kuru/activity?limit=20'].map((path) => fetch(`http://localhost:3001${path}`)));
      if (responses.some((response) => !response.ok)) throw new Error('The PageSync backend returned an error.');
      const [orders, trades, stats, kuru] = await Promise.all(responses.map((response) => response.json()));
      setData({ orders: orders.orders || [], trades: trades.trades || [], kuru, stats });
    } catch (requestError) {
      setError(`Envio activity is unavailable. Start the backend and Envio indexer to load historical data. (${requestError.message})`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);
  const envio = data.stats?.envio;
  return <Page title="Activity & Analytics" eyebrow="DATA / ENVIO INDEXED ACTIVITY" intro="Kuru events and PageSync reference events are indexed and displayed as separate data products.">
    <section className="trade-toolbar card"><div><span className="label">INDEXED DATA LAYER</span><h2>Envio activity</h2><p className="form-note">KURU ACTIVITY is the real MON/USDC venue. PAGE SYNC ACTIVITY is the storage-optimization reference implementation.</p></div><Button secondary onClick={refresh} disabled={loading}>{loading ? 'Loading...' : 'Refresh activity'}</Button></section>
    {error && <div className="error-box">{error}</div>}
    <div className="metric-grid"><Metric label="Envio status" value={envio?.envioAvailable ? 'Connected' : 'Not running'} /><Metric label="PageSync orders" value={envio?.ordersPlaced ?? '—'} /><Metric label="Kuru orders" value={envio?.kuruOrders ?? '—'} /><Metric label="Kuru trades" value={envio?.kuruTrades ?? '—'} /></div>
    <section className="card"><div className="card-head"><div><span className="label">KURU ACTIVITY · MON / USDC</span><h2>Real venue events</h2></div><span className="muted">latest 20</span></div>{data.kuru.orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Side</th><th>Price</th><th>Size</th><th>Owner</th><th>Transaction</th></tr></thead><tbody>{data.kuru.orders.map((order) => <tr key={order.id}><td><code>#{order.orderId}</code></td><td>{order.isBuy ? 'BUY' : 'SELL'}</td><td>{order.price}</td><td>{order.size}</td><td><code>{shortAddress(order.owner)}</code></td><td><a href={`https://testnet.monadexplorer.com/tx/${order.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">No Kuru events are indexed yet. Start Envio to populate this section.</p>}</section>
    <section className="card"><div className="card-head"><div><span className="label">RECENT ORDER ACTIVITY</span><h2>OrderPlaced events</h2></div><span className="muted">latest 20</span></div>{data.orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Side</th><th>Price</th><th>Quantity</th><th>Contract</th><th>Transaction</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td><code>#{order.orderId}</code></td><td>{Number(order.side) === 0 ? 'BUY' : 'SELL'}</td><td>{order.price}</td><td>{order.quantity}</td><td><code>{shortAddress(order.contractAddress)}</code></td><td><a href={`https://testnet.monadexplorer.com/tx/${order.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">No indexed orders are available.</p>}</section>
    <section className="card"><div className="card-head"><div><span className="label">RECENT TRADES</span><h2>TradeExecuted events</h2></div><span className="muted">latest 20</span></div>{data.trades.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Price</th><th>Quantity</th><th>Transaction</th></tr></thead><tbody>{data.trades.map((trade) => <tr key={trade.id}><td><code>#{trade.orderId}</code></td><td>{trade.price}</td><td>{trade.quantity}</td><td><a href={`https://testnet.monadexplorer.com/tx/${trade.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div> : <p className="empty-state">No indexed trades are available.</p>}</section>
  </Page>;
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

function useKuruSnapshot() {
  const [snapshot, setSnapshot] = useState({ quote: null, block: null, loading: true, error: '' });
  const refresh = async () => {
    setSnapshot((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [[bestBid, bestAsk], block] = await Promise.all([
        publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'bestBidAsk' }),
        publicClient.getBlockNumber(),
      ]);
      setSnapshot({
        quote: {
          bestBid: bestBid === KURU_EMPTY_PRICE ? null : Number(formatUnits(bestBid, 8)),
          bestAsk: bestAsk === KURU_EMPTY_PRICE ? null : Number(formatUnits(bestAsk, 8)),
        },
        block: block.toString(),
        loading: false,
        error: '',
      });
    } catch (error) {
      setSnapshot({ quote: null, block: null, loading: false, error: error.shortMessage || error.message || 'Unable to read the Kuru market.' });
    }
  };
  useEffect(() => { refresh(); }, []);
  const bid = snapshot.quote?.bestBid;
  const ask = snapshot.quote?.bestAsk;
  return {
    ...snapshot,
    refresh,
    mid: bid !== undefined && bid !== null && ask !== undefined && ask !== null ? (bid + ask) / 2 : null,
    spread: bid !== undefined && bid !== null && ask !== undefined && ask !== null ? ask - bid : null,
  };
}

function MarketSummary({ snapshot }) {
  const value = (number, suffix = '') => number === null || number === undefined ? '—' : `${number.toLocaleString(undefined, { maximumFractionDigits: 6 })}${suffix}`;
  return <div className="metric-grid market-metrics">
    <Metric label="Best bid" value={value(snapshot.quote?.bestBid, ' USDC')} />
    <Metric label="Best ask" value={value(snapshot.quote?.bestAsk, ' USDC')} />
    <Metric label="Spread" value={value(snapshot.spread, ' USDC')} />
    <Metric label="Mid price" value={value(snapshot.mid, ' USDC')} />
  </div>;
}

function MarketCard({ snapshot, go }) {
  return <section className="card market-card">
    <div className="card-head"><div><span className="label">KURU LIVE MARKET · MON / USDC</span><h2>Market state</h2></div><span className="chip green">Monad Testnet</span></div>
    <p className="form-note">Kuru is the real trading venue. PageSync reads the public market state and adds context; it does not replace Kuru.</p>
    <MarketSummary snapshot={snapshot} />
    {snapshot.error && <div className="error-box">{snapshot.error}</div>}
    <div className="actions"><Button secondary onClick={snapshot.refresh} disabled={snapshot.loading}>{snapshot.loading ? 'Reading market...' : 'Refresh market'}</Button><Button onClick={() => go('kuru')}>Open optional Kuru trading →</Button></div>
  </section>;
}

function PublicActivityPreview({ go }) {
  const [data, setData] = useState({ orders: [], trades: [], cancellations: [] });
  const [state, setState] = useState('loading');
  useEffect(() => {
    fetch('http://localhost:3001/kuru/activity?limit=5')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Activity API returned an error.')))
      .then((result) => { setData(result); setState('ready'); })
      .catch(() => setState('unavailable'));
  }, []);
  const rows = [
    ...data.orders.map((item) => ({ ...item, kind: 'Order created', side: item.isBuy ? 'BUY' : 'SELL', detail: `${item.size} MON @ ${item.price}` })),
    ...data.trades.map((item) => ({ ...item, kind: 'Trade', side: item.isBuy ? 'BUY' : 'SELL', detail: `${item.filledSize} filled @ ${item.price}` })),
    ...data.cancellations.map((item) => ({ ...item, kind: 'Order cancelled', side: '—', detail: `Order ${item.orderIds}` })),
  ].sort((a, b) => Number(b.blockTimestamp || 0) - Number(a.blockTimestamp || 0)).slice(0, 5);
  return <section className="card"><div className="card-head"><div><span className="label">ONCHAIN ACTIVITY · KURU</span><h2>What is happening?</h2></div><Button secondary onClick={() => go('activity')}>View all activity →</Button></div>
    {state === 'unavailable' && <p className="empty-state">Historical activity is unavailable. Start the optional backend and Envio indexer to load it.</p>}
    {state === 'ready' && !rows.length && <p className="empty-state">No indexed Kuru events yet.</p>}
    {rows.length > 0 && <div className="activity-list">{rows.map((row) => <div className="activity-row" key={row.id}><span className="activity-kind">{row.kind}</span><b>{row.side}</b><span>{row.detail}</span><a href={`https://testnet.monadexplorer.com/tx/${row.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></div>)}</div>}
  </section>;
}

function Overview({ go, wallet }) {
  const snapshot = useKuruSnapshot();
  return <Page home>
    <section className="market-hero"><div><span className="label">PAGESYNC / ONCHAIN MARKET INTELLIGENCE</span><h1>Understand the market.<br /><em>Understand the activity.</em></h1><p>Monitor MON/USDC activity, understand on-chain market behavior, and measure the storage and gas cost behind it.</p><div className="market-definition"><b>MON/USDC</b><span>MON is the asset being traded. USDC is the quote currency. Buying MON means spending USDC to receive MON.</span></div></div><div className="hero-market-panel"><span className="label">LIVE MARKET</span><strong>MON / USDC</strong><span className="hero-price">{snapshot.mid === null ? '—' : snapshot.mid.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><small>{snapshot.loading ? 'Reading Kuru...' : snapshot.error ? 'Market read unavailable' : 'mid price · Monad Testnet'}</small></div></section>
    <MarketCard snapshot={snapshot} go={go} />
    <div className="overview-grid"><section className="card"><div className="card-head"><div><span className="label">MARKET OVERVIEW</span><h2>Order book at a glance</h2></div><span className="chip">public data</span></div><p className="form-note">Best bid is the highest current buy offer. Best ask is the lowest current sell offer. The spread is the difference between them.</p><div className="book-preview"><div><span>BEST BID</span><strong>{snapshot.quote?.bestBid ?? '—'}</strong><small>highest buyer</small></div><div><span>BEST ASK</span><strong>{snapshot.quote?.bestAsk ?? '—'}</strong><small>cheapest seller</small></div></div><Button secondary onClick={() => go('markets')}>Explore MON/USDC →</Button></section><section className="card"><div className="card-head"><div><span className="label">YOUR ACTIVITY</span><h2>Wallet optional</h2></div><span className="chip">{wallet.account ? 'connected' : 'not connected'}</span></div><p className="form-note">{wallet.account ? `Viewing activity for ${shortAddress(wallet.account)}.` : 'Connect only when you want to see your orders, fills and cancellations.'}</p><Button onClick={() => go('orders')}>{wallet.account ? 'View my orders →' : 'View my orders'}</Button></section></div>
    <PublicActivityPreview go={go} />
    <section className="card intelligence-callout"><div><span className="label">GAS & STORAGE INTELLIGENCE</span><h2>20.42% lower median receipt gas in a measured benchmark</h2><p className="form-note">Across three repeated Monad Testnet workloads, the PageSync packed representation used 20.42% less median receipt gas than the conventional representation. This is measured evidence, not guaranteed production savings.</p></div><Button secondary onClick={() => go('gas')}>View benchmark →</Button></section>
    <section className="developer-strip"><div><span className="label">DEVELOPER TOOLS</span><h2>Inspect the evidence behind PageSync</h2></div><div className="tool-links"><button onClick={() => go('analyzer')}>Struct Analyzer ↗</button><button onClick={() => go('inspector')}>Storage Inspector ↗</button><button onClick={() => go('gas')}>Gas Benchmark ↗</button></div></section>
  </Page>;
}

function Markets({ go }) {
  const snapshot = useKuruSnapshot();
  return <Page title="MON/USDC Market" eyebrow="MARKETS / LIVE KURU STATE" intro="A simple view of the real Monad Testnet market. Trading remains optional."><MarketCard snapshot={snapshot} go={go} /><div className="overview-grid"><section className="card"><div className="card-head"><div><span className="label">ORDER BOOK</span><h2>Current best prices</h2></div></div><MarketSummary snapshot={snapshot} /><div className="empty-state">Detailed depth is not exposed by the current public market read. Showing only verified best bid and ask values.</div></section><section className="card"><div className="card-head"><div><span className="label">RECENT TRADES</span><h2>Indexed fills</h2></div></div><p className="empty-state">Open Activity to see Kuru trades indexed by Envio, including price, size, block and transaction.</p><Button secondary onClick={() => go('activity')}>Open activity →</Button></section></div></Page>;
}

function Watch({ go }) {
  const snapshot = useKuruSnapshot();
  return <Page title="Watch MON/USDC" eyebrow="WATCH / WHAT CHANGED" intro="A lightweight checkpoint for the market state and the latest indexed activity."><MarketCard snapshot={snapshot} go={go} /><PublicActivityPreview go={go} /><section className="card"><span className="label">READ THIS VIEW</span><h2>Check what changed since your last visit</h2><p className="form-note">This page intentionally stays focused: current market state plus the latest Kuru order, trade and cancellation events. Notifications and alert rules are not enabled.</p></section></Page>;
}

function MyOrders({ wallet, go }) {
  return <Page title="My Orders" eyebrow="PERSONAL / WALLET-SCOPED ACTIVITY" intro="Your wallet is optional. Connect to inspect your own orders, fills and cancellations."><section className="card personal-empty">{wallet.account ? <><span className="label">CONNECTED WALLET</span><h2>{shortAddress(wallet.account)}</h2><p className="form-note">Kuru order tracking and PageSync transaction history are available in their respective workspaces.</p><div className="actions"><Button onClick={() => go('kuru')}>Open Kuru order workspace →</Button><Button secondary onClick={() => go('trade')}>Open PageSync demo →</Button></div></> : <><span className="label">WALLET OPTIONAL</span><h2>Connect wallet to view your orders, fills and cancellations.</h2><p className="form-note">Public market information remains available without connecting.</p><Button onClick={wallet.connect}>Connect wallet</Button></>}</section></Page>;
}

function Guide({ go }) {
  const steps = [
    { number: '01', title: 'Start with the market', text: 'Open Overview to see the MON/USDC market, current best prices, the spread, and a plain-language explanation of what is being traded.', action: 'Open Overview', page: 'home' },
    { number: '02', title: 'Understand the activity', text: 'Use Activity for indexed Kuru order, trade, and cancellation events. Kuru is the venue; Envio makes those events searchable.', action: 'Explore Activity', page: 'activity' },
    { number: '03', title: 'Watch what changes', text: 'Use Watch as a quick checkpoint for the latest market state and activity. It is public and does not require a wallet.', action: 'Open Watch', page: 'watch' },
    { number: '04', title: 'Inspect your own activity', text: 'Connect a wallet only when you want to see your orders, fills, cancellations, or use the optional Kuru trading workspace.', action: 'View My Orders', page: 'orders' },
    { number: '05', title: 'Understand the cost', text: 'Gas & Storage explains the measured receipt-gas comparison between a conventional order representation and PageSync’s packed representation.', action: 'View Gas & Storage', page: 'gas' },
  ];
  return <Page title="How to use PageSync" eyebrow="GUIDE / START HERE" intro="A simple path from market context to on-chain evidence. You can explore everything public before connecting a wallet.">
    <section className="guide-hero"><div><span className="label">YOUR FIRST 5 MINUTES</span><h2>See the market.<br /><em>Follow the activity.</em></h2><p>PageSync is an intelligence layer around the MON/USDC market. Kuru provides the real trading venue, Envio indexes activity, and PageSync helps you understand the market and the storage evidence behind it.</p><div className="actions"><Button onClick={() => go('home')}>Start with Overview →</Button><Button secondary onClick={() => go('markets')}>Explore the market</Button></div></div><div className="guide-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><b>PS</b><span>market<br />intelligence</span></div><span className="orbit-label orbit-kuru">KURU · VENUE</span><span className="orbit-label orbit-envio">ENVIO · ACTIVITY</span><span className="orbit-label orbit-pagesync">PAGESYNC · EVIDENCE</span></div></section>
    <section className="guide-section"><div className="section-heading"><span className="label">THE JOURNEY</span><h2>Follow the signal, not the noise.</h2><p>Each section answers one beginner question. Nothing here requires a wallet until you decide to trade or inspect personal activity.</p></div><div className="guide-steps">{steps.map((step) => <article className="guide-step" key={step.number}><span className="guide-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p><button onClick={() => go(step.page)}>{step.action} <span>↗</span></button></div></article>)}</div></section>
    <section className="guide-section"><div className="section-heading"><span className="label">THE BASICS</span><h2>Three ideas to keep in mind.</h2></div><div className="guide-basics"><article><span className="basic-icon">◈</span><h3>MON/USDC</h3><p><b>MON</b> is the asset being traded. <b>USDC</b> is the quote currency. Buying MON means spending USDC to receive MON.</p></article><article><span className="basic-icon">↕</span><h3>Order book</h3><p>A list of buy and sell interest. The <b>best bid</b> is the highest buyer; the <b>best ask</b> is the cheapest seller; the spread is the difference.</p></article><article><span className="basic-icon">⌁</span><h3>Gas</h3><p>Gas is the computation and storage cost paid for an on-chain transaction. It is measured from transaction receipts, not guessed from a chart.</p></article></div></section>
    <section className="guide-section source-section"><div className="section-heading"><span className="label">WHO DOES WHAT?</span><h2>One market, three layers.</h2></div><div className="source-flow"><div><strong>Kuru</strong><span>Real MON/USDC trading venue</span></div><i>→</i><div><strong>Envio</strong><span>Indexed orders, trades, and cancellations</span></div><i>→</i><div><strong>PageSync</strong><span>Market context and storage/gas intelligence</span></div></div></section>
    <section className="guide-section"><div className="section-heading"><span className="label">WALLET OPTIONAL</span><h2>Connect only when you need to act.</h2><p>Public market information is available without MetaMask. A wallet is needed for personal activity, margin funding, placing Kuru orders, or writing to the PageSync reference contract.</p></div><div className="wallet-journey"><div><span>01</span><b>Browse publicly</b><small>Overview · Markets · Activity · Watch</small></div><div><span>02</span><b>Connect safely</b><small>Monad Testnet · wallet approval</small></div><div><span>03</span><b>Act or inspect</b><small>Orders · Kuru · live transactions</small></div></div></section>
    <section className="guide-footer-callout"><div><span className="label">READY TO EXPLORE?</span><h2>Start with the market, then follow the evidence.</h2></div><Button onClick={() => go('home')}>Open Overview →</Button></section>
  </Page>;
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

function Page({ title, eyebrow, intro, children, home }) { return <main className={home ? 'page home-page' : 'page'}>{!home && <header className="page-title"><span className="label">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></header>}{children}</main>; }

export default function App() {
  const [page, setPage] = useState('home');
  const wallet = useWallet();
  const content = useMemo(() => ({
    home: <Overview go={setPage} wallet={wallet} />,
    guide: <Guide go={setPage} />,
    markets: <Markets go={setPage} />,
    activity: <Activity />,
    orders: <MyOrders wallet={wallet} go={setPage} />,
    watch: <Watch go={setPage} />,
    gas: <Benchmark />,
    tools: <Research />,
    trade: <Trade wallet={wallet} go={setPage} />,
    kuru: <KuruWorkspace wallet={wallet} go={setPage} />,
    analyzer: <Analyzer />,
    inspector: <Inspector />,
    benchmark: <Benchmark />,
    research: <Research />,
  }[page]), [page, wallet]);
  const nav = (id, label) => <button className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>;
  return <div className="app-shell"><aside className="sidebar"><button className="logo" onClick={() => setPage('home')}><span>PS</span><b>Page<span>Sync</span></b></button><nav>
    {nav('home', 'Overview')}{nav('guide', 'How to use')}{nav('markets', 'Markets')}{nav('activity', 'Activity')}{nav('orders', 'My Orders')}{nav('watch', 'Watch')}
    <p>INTELLIGENCE</p>{nav('gas', 'Gas & Storage')}{nav('tools', 'Developer Tools')}<p>OPTIONAL TRADING</p><button className={page === 'kuru' ? 'active live-nav' : 'live-nav'} onClick={() => setPage('kuru')}>Kuru Market <span>LIVE</span></button><p>REFERENCE WORKSPACES</p>{nav('trade', 'Optimization Demo')}{nav('analyzer', 'Struct Analyzer')}{nav('inspector', 'Storage Inspector')}{nav('research', 'Monad Case Study')}
  </nav><div className="sidebar-foot"><span className="dot" /> Monad Testnet <small>chain 10143</small></div></aside><div className="main"><header className="topbar"><span>PageSync / {page === 'home' ? 'Overview' : page}</span><span className="top-status">{wallet.account ? `● ${shortAddress(wallet.account)}` : '● public market view'}</span></header>{content}<footer>PageSync — onchain market intelligence <span>Market · Activity · Cost · Storage</span></footer></div></div>;
}
