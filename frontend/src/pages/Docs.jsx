import { useEffect, useState } from 'react';
import { CONTRACTS, KURU_MARKET_ADDRESS, MONAD_CHAIN_ID, MONAD_RPC } from '../chain';

const EXPLORER = 'https://testnet.monadexplorer.com';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'quick-start', label: 'Quick start' },
  { id: 'lab', label: 'Storage Lab' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'market', label: 'Market' },
  { id: 'activity', label: 'Activity' },
  { id: 'wallet', label: 'Wallet & network' },
  { id: 'method', label: 'Method & limits' },
  { id: 'faq', label: 'Troubleshooting' },
  { id: 'glossary', label: 'Glossary' },
];

const TYPES_OK = [
  ['Value types', 'address, bool, uint8–uint256 and int8–int256 (multiples of 8), bytes1–bytes32'],
  ['Dynamic', 'string, bytes, and dynamic arrays such as uint256[]'],
  ['Arrays', 'One-dimensional fixed arrays of 1–256 elements, e.g. uint16[4]'],
  ['Mappings', 'mapping(KeyType => ValueType) with a supported key type'],
];

const TYPES_NO = [
  'More than one struct, or surrounding contracts, imports and inheritance',
  'User-defined and nested types (structs, enums, contract types inside the struct)',
  'Multi-dimensional arrays',
  'Fields without a trailing semicolon, or duplicate field names',
];

const FAQ = [
  [
    'Activity or the order tables are empty.',
    'The Activity page reads from the backend API, which reads the Envio indexer. Start the indexer and the backend, then press Refresh. Until then the page shows a standby state rather than data.',
  ],
  [
    'The Lab says “Unsupported field type”.',
    'The analyzer accepts exactly one struct built from the types listed under Storage Lab. Remove user-defined types, extra code or comments that contain stray braces, and make sure every field ends with a semicolon.',
  ],
  [
    'The analysis is labelled “Estimated only”.',
    'The slot map is computed from the Solidity storage rules but the compiler cross-check did not run or did not complete. Treat the numbers as an estimate and verify with your own compiler output (forge inspect … storageLayout).',
  ],
  [
    'Copy fails.',
    'Browsers only allow clipboard writes from a secure page after a click. Allow clipboard access for the site, or select the generated code and copy it manually.',
  ],
  [
    'My wallet button says “Switch to Monad”.',
    'The wallet is connected to a different network. Click the button and approve the prompt to switch to (or add) Monad Testnet, chain 10143.',
  ],
  [
    'Update and Execute show no saving in Evidence.',
    'They barely differ between the two contracts (+1.01% and +0.06%). The measured benefit comes from order placement and cancellation; the page reports every operation, including the ones that did not improve.',
  ],
];

const GLOSSARY = [
  ['Storage slot', 'A 32-byte word in contract storage. Each write or read touches whole slots.'],
  ['Packing', 'Placing several small fields into one slot so fewer slots are used.'],
  ['Offset', 'The byte position of a field inside its slot.'],
  ['Receipt gas', 'The gasUsed value in a mined transaction receipt — the gas actually charged.'],
  ['Envio', 'The indexer that listens to contract events and exposes them through a GraphQL API.'],
  ['Chain ID 10143', 'The identifier of Monad Testnet.'],
];

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function Section({ id, n, title, children }) {
  return (
    <section className="doc-sec" id={id}>
      <span className="mono doc-sec__n">{n}</span>
      <h2 className="doc-sec__title">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ items }) {
  return (
    <ol className="doc-steps">
      {items.map(([t, d], i) => (
        <li key={t}>
          <span className="doc-steps__i">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <b>{t}</b>
            <p>{d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const Note = ({ kind = 'info', title, children }) => (
  <aside className={`doc-note is-${kind}`}>
    <b className="mono">{title}</b>
    <p>{children}</p>
  </aside>
);

export default function Docs({ go }) {
  const active = useActiveSection();
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="docs">
      <nav className="docs__toc" aria-label="On this page">
        <span className="mono">On this page</span>
        {SECTIONS.map((s) => (
          <button key={s.id} className={active === s.id ? 'is-active' : ''} onClick={() => jump(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="docs__body">
        <Section id="overview" n="00" title="Overview">
          <p>
            PageSync helps Solidity developers understand how a struct is laid out in contract storage, and shows
            measured evidence that a packed layout can lower gas on Monad Testnet. It has four tools:
          </p>
          <div className="doc-cards">
            {[
              ['/lab', 'Storage Lab', 'Analyse a struct and inspect the known order-book layouts.'],
              ['/evidence', 'Evidence', 'Receipt gas for 30 testnet transactions, plus a live reproduction.'],
              ['/market', 'Market', 'The Kuru MON/USDC order book on Monad Testnet.'],
              ['/activity', 'Activity', 'Orders and trades indexed by Envio.'],
            ].map(([to, t, d]) => (
              <button key={to} className="doc-card" onClick={() => go(to)}>
                <b>{t}</b>
                <span>{d}</span>
                <i aria-hidden="true">&rarr;</i>
              </button>
            ))}
          </div>
          <Note title="Scope">
            PageSync is a research and developer tool. It runs on testnet only, does not trade real value, and does
            not modify deployed contracts.
          </Note>
        </Section>

        <Section id="quick-start" n="01" title="Quick start">
          <Steps
            items={[
              ['Analyse a struct', 'Open Lab, paste a struct (or pick a preset) and press Optimize & Verify.'],
              ['Read the slot map', 'Each row is one 32-byte slot. Check how many slots are used and how many bytes are wasted.'],
              ['Copy the result', 'Use Copy Optimized Struct to get the reordered declaration for a new deployment.'],
              ['Check the evidence', 'Open Evidence → Receipts to see what the packed layout cost on Monad Testnet.'],
              ['Optional: go live', 'Connect a wallet on Monad Testnet to reproduce a transaction or use the Market.'],
            ]}
          />
        </Section>

        <Section id="lab" n="02" title="Storage Lab">
          <h3>Struct analyzer</h3>
          <p>
            Paste <b>one</b> struct declaration. The analyzer computes each field&rsquo;s slot, byte offset and unused
            space, estimates the slot count, and proposes a reordering that packs fields together. The original field
            order is never changed silently — the suggestion is a separate, copyable declaration.
          </p>
          <Steps
            items={[
              ['Load input', 'Choose a preset (Order, TokenBalance, DexPosition) or paste your own struct.'],
              ['Run', 'Press Optimize & Verify. The result is cross-checked with a Solidity compiler when available.'],
              ['Read', 'Compare the original and optimized slot maps, then review the generated declaration.'],
              ['Copy', 'Press Copy Optimized Struct to put the declaration on your clipboard.'],
            ]}
          />
          <h4>Supported types</h4>
          <dl className="doc-defs">
            {TYPES_OK.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h4>Not supported (fails with a clear message)</h4>
          <ul className="doc-list">
            {TYPES_NO.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <Note kind="warn" title="Storage compatibility">
            Reordering fields changes the storage layout. Do not apply a reordered struct to an existing deployment,
            persisted data or an upgradeable proxy. Use it for new deployments.
          </Note>
          <h3>Layout inspector</h3>
          <p>
            Switch to the Layout inspector to see the known <code>NaiveOrderBook</code> (4 slots) and{' '}
            <code>PageSyncOrderBook</code> (2 slots) layouts. Pick a contract, then click a storage word to see the
            fields it holds and how many bytes are unused.
          </p>
        </Section>

        <Section id="evidence" n="03" title="Evidence">
          <p>The Evidence page has three tabs.</p>
          <dl className="doc-defs">
            <div>
              <dt>Receipts</dt>
              <dd>
                The saved benchmark: 30 of 30 transactions succeeded. PageSync used about 20.42% less median total
                receipt gas than NaiveOrderBook. A per-operation table shows where the difference comes from.
              </dd>
            </div>
            <div>
              <dt>Simulation</dt>
              <dd>
                The two layouts drawn byte by byte, with the measured gas per operation as bars. Press Replay to
                animate the bars. Nothing here is simulated gas — it is the saved receipts.
              </dd>
            </div>
            <div>
              <dt>Reproduce</dt>
              <dd>
                Sends a real order to the PageSync contract so you can see its receipt gas yourself. Requires a wallet
                on Monad Testnet with a little test MON for gas.
              </dd>
            </div>
          </dl>
          <Steps
            items={[
              ['Connect', 'Press Connect in the top bar and approve the wallet prompt; switch to Monad Testnet if asked.'],
              ['Set the order', 'Choose Buy or Sell and enter a price and quantity.'],
              ['Send', 'Press Write Packed Order to Monad and confirm in your wallet.'],
              ['Read the receipt', 'When mined, the page shows the transaction and its gasUsed.'],
            ]}
          />
        </Section>

        <Section id="market" n="04" title="Market">
          <p>
            Market shows the Kuru MON/USDC order book on Monad Testnet. Best bid, best ask and market parameters are
            read directly from the chain and need no wallet. With a connected wallet the page also shows your USDC
            balance and allowance and your margin balances.
          </p>
          <Note kind="warn" title="Testnet funds only">
            Orders are placed on a testnet venue with testnet tokens. Nothing on this page involves real value.
          </Note>
        </Section>

        <Section id="activity" n="05" title="Activity">
          <p>
            Activity lists every order, trade and cancellation the Envio indexer has recorded for the PageSync, Naive
            and Kuru contracts, newest first, with links to the block, address and transaction on the Monad explorer.
          </p>
          <ul className="doc-list">
            <li>Filter by event type (orders, trades, Kuru) and by source contract, or search by value.</li>
            <li>Auto 10s refreshes the list every ten seconds; switch it off to freeze the view.</li>
            <li>It needs the backend API and the Envio indexer running; otherwise it shows a standby state.</li>
          </ul>
        </Section>

        <Section id="wallet" n="06" title="Wallet & network">
          <p>A wallet is only needed for Reproduce and for placing orders in Market. Everything else is read-only.</p>
          <table className="doc-table">
            <tbody>
              <tr><th>Network</th><td>Monad Testnet</td></tr>
              <tr><th>Chain ID</th><td>{MONAD_CHAIN_ID}</td></tr>
              <tr><th>Currency</th><td>MON</td></tr>
              <tr><th>RPC</th><td><code>{MONAD_RPC}</code></td></tr>
              <tr><th>Explorer</th><td><a href={EXPLORER} target="_blank" rel="noreferrer">{EXPLORER}</a></td></tr>
            </tbody>
          </table>
          <h4>Contracts</h4>
          <table className="doc-table">
            <tbody>
              {[
                ['NaiveOrderBook', CONTRACTS.NaiveOrderBook.address],
                ['PageSyncOrderBook', CONTRACTS.PageSyncOrderBook.address],
                ['Kuru Market', KURU_MARKET_ADDRESS],
              ].map(([n, a]) => (
                <tr key={n}>
                  <th>{n}</th>
                  <td>
                    <a href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer"><code>{a}</code></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note title="Never share keys">
            PageSync never asks for a seed phrase or private key. Only approve transactions you recognise.
          </Note>
        </Section>

        <Section id="method" n="07" title="Method & limits">
          <ul className="doc-list">
            <li>Both contracts were benchmarked on Monad Testnet, chain 10143, in separate transactions.</li>
            <li>Gas is the receipt <code>gasUsed</code> — not <code>gasleft()</code>, an estimate or a gas limit.</li>
            <li>Three repeated workloads completed; 30 of 30 receipt statuses were 1.</li>
            <li>PageSync showed about 20.42% lower median total receipt gas than NaiveOrderBook.</li>
          </ul>
          <Note kind="warn" title="What this does not show">
            This is evidence of a workload-specific benefit. Both contracts remain mapping-based, so the result does
            not prove an explicit Monad storage-page locality or warming mechanism. Savings are not guaranteed for
            other contracts. Envio is an indexer, not a gas profiler.
          </Note>
          <p>Non-goals: a production exchange, real-value trading, universal Solidity compilation, and automatic changes to deployed storage.</p>
        </Section>

        <Section id="faq" n="08" title="Troubleshooting">
          <div className="doc-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section id="glossary" n="09" title="Glossary">
          <dl className="doc-defs">
            {GLOSSARY.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
