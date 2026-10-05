import { useMemo, useState } from 'react';
import './App.css';
import StorageBenchmark3D from './components/StorageBenchmark3D';

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

function Button({ children, onClick, secondary = false }) {
  return <button className={secondary ? 'button secondary' : 'button'} onClick={onClick}>{children}</button>;
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

function Home({ go }) {
  return <Page home><section className="hero"><div><span className="label">PAGESYNC / DEVELOPER TOOLKIT</span><h1>Smart Contract<br /><em>Storage Optimizer</em></h1><p>Analyze Solidity storage layouts, inspect contract storage, and benchmark real gas usage.</p><div className="actions"><Button onClick={() => go('analyzer')}>Analyze Solidity struct →</Button><Button secondary onClick={() => go('inspector')}>Inspect contract</Button><Button secondary onClick={() => go('benchmark')}>Benchmark gas</Button></div></div><div className="hero-art"><div className="art-grid">{Array.from({ length: 16 }, (_, index) => <i className={index % 3 === 0 ? 'lit' : ''} key={index} />)}</div><span>storage words / packed layout</span></div></section><div className="feature-grid"><Feature number="01" title="Struct Analyzer" text="Map supported Solidity types to slots, offsets, and packing groups." onClick={() => go('analyzer')} /><Feature number="02" title="Storage Inspector" text="Explore the verified layouts behind the deployed research contracts." onClick={() => go('inspector')} /><Feature number="03" title="Gas Benchmark" text="Compare receipt gas from the controlled Monad Testnet experiment." onClick={() => go('benchmark')} /></div></Page>;
}

function Feature({ number, title, text, onClick }) { return <button className="feature" onClick={onClick}><span>{number}</span><h2>{title} ↗</h2><p>{text}</p></button>; }
function Page({ title, eyebrow, intro, children, home }) { return <main className={home ? 'page home-page' : 'page'}>{!home && <header className="page-title"><span className="label">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></header>}{children}</main>; }

export default function App() {
  const [page, setPage] = useState('home');
  const content = useMemo(() => ({ home: <Home go={setPage} />, analyzer: <Analyzer />, inspector: <Inspector />, benchmark: <Benchmark />, research: <Research /> }[page]), [page]);
  return <div className="app-shell"><aside className="sidebar"><button className="logo" onClick={() => setPage('home')}><span>PS</span><b>Page<span>Sync</span></b></button><nav><button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>Overview</button><p>PRODUCT / TOOLS</p><button className={page === 'analyzer' ? 'active' : ''} onClick={() => setPage('analyzer')}>Struct Analyzer</button><button className={page === 'inspector' ? 'active' : ''} onClick={() => setPage('inspector')}>Storage Inspector</button><button className={page === 'benchmark' ? 'active' : ''} onClick={() => setPage('benchmark')}>Gas Benchmark</button><p>RESEARCH</p><button className={page === 'research' ? 'active' : ''} onClick={() => setPage('research')}>Monad Case Study</button></nav><div className="sidebar-foot"><span className="dot" /> Monad Testnet <small>chain 10143</small></div></aside><div className="main"><header className="topbar"><span>PageSync / {page === 'home' ? 'Workspace' : page}</span><span className="top-status">● read-only research data</span></header>{content}<footer>PageSync — storage analysis and benchmark tooling <span>Not a production exchange · no guaranteed savings</span></footer></div></div>;
}
