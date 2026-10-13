import { useEffect, useState } from 'react';
import { BENCHMARK_RESULTS, formatNum } from '../chain';

/**
 * Byte-accurate view of the two order-book layouts plus the measured
 * receipt gas per operation. Everything shown is derived from the known
 * layouts and the saved receipt benchmark — nothing is simulated.
 */
const LAYOUTS = {
  naive: {
    title: 'NaiveOrderBook',
    slots: [
      [['trader', 20], ['unused', 12]],
      [['price', 32]],
      [['quantity', 32]],
      [['side', 1], ['status', 1], ['unused', 30]],
    ],
  },
  pagesync: {
    title: 'PageSyncOrderBook',
    slots: [
      [['trader', 20], ['price', 8], ['reserved', 4]],
      [['quantity', 16], ['side', 1], ['status', 1], ['unused', 14]],
    ],
  },
};

const FIELD_TONE = { trader: 0, price: 1, quantity: 2, side: 3, status: 4 };
const isFree = (name) => name === 'unused' || name === 'reserved';

function stats(layout) {
  const allocated = layout.slots.length * 32;
  const used = layout.slots.flat().reduce((n, [name, b]) => n + (isFree(name) ? 0 : b), 0);
  return { slots: layout.slots.length, allocated, used, pct: Math.round((used / allocated) * 100) };
}

function Layout({ layout, accent }) {
  const s = stats(layout);
  return (
    <div className={`lr-layout ${accent ? 'is-accent' : ''}`}>
      <div className="lr-layout__head">
        <span className="lr-layout__title">{layout.title}</span>
        <span className="mono">{s.slots} slots &middot; {s.allocated} B</span>
      </div>
      <div className="lr-slots">
        {layout.slots.map((segs, i) => (
          <div className="lr-slot" key={i}>
            <span className="lr-slot__idx mono">S{i}</span>
            <div className="lr-slot__bar" role="img" aria-label={segs.map(([n, b]) => `${n} ${b} bytes`).join(', ')}>
              {segs.map(([name, bytes], j) => (
                <div
                  key={j}
                  className={`lr-seg ${isFree(name) ? 'is-free' : `tone-${FIELD_TONE[name]}`}`}
                  style={{ width: `${(bytes / 32) * 100}%` }}
                  title={`${name} · ${bytes} B`}
                >
                  {bytes >= 5 && <span>{isFree(name) ? '' : name}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lr-stats">
        <div><b>{s.slots}</b><span className="mono">storage slots</span></div>
        <div><b>{s.used}<small> / {s.allocated} B</small></b><span className="mono">bytes in use</span></div>
        <div><b>{s.pct}%</b><span className="mono">utilisation</span></div>
      </div>
    </div>
  );
}

function GasRows({ run }) {
  const max = Math.max(...BENCHMARK_RESULTS.flatMap(([, a, b]) => [a, b]));
  return (
    <div className="lr-gas">
      {BENCHMARK_RESULTS.map(([op, naive, ps, diff], i) => (
        <div className="lr-gas__row" key={op} style={{ '--d': `${i * 140}ms` }}>
          <div className="lr-gas__op">
            <span>{op}</span>
            <span className={`lr-delta ${diff.startsWith('-') ? 'is-down' : 'is-up'}`}>{diff}</span>
          </div>
          <div className="lr-gas__bar is-naive">
            <i style={{ width: run ? `${(naive / max) * 100}%` : 0 }} />
            <em>{formatNum(naive)}</em>
          </div>
          <div className="lr-gas__bar is-ps">
            <i style={{ width: run ? `${(ps / max) * 100}%` : 0 }} />
            <em>{formatNum(ps)}</em>
          </div>
        </div>
      ))}
      <div className="lr-legend mono">
        <span><i className="is-naive" />Naive</span>
        <span><i className="is-ps" />PageSync</span>
        <span>Receipt gasUsed</span>
      </div>
    </div>
  );
}

export default function LayoutReplay() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRun(true), 150);
    return () => clearTimeout(t);
  }, []);

  const replay = () => {
    setRun(false);
    setTimeout(() => setRun(true), 120);
  };

  return (
    <div className="lr">
      <section className="glass-panel">
        <div className="panel-header-row">
          <div>
            <span className="section-eyebrow">Layout / one order, byte by byte</span>
            <h2 className="panel-title">Where each field lives</h2>
          </div>
        </div>
        <div className="lr-compare">
          <Layout layout={LAYOUTS.naive} />
          <Layout layout={LAYOUTS.pagesync} accent />
        </div>
      </section>

      <section className="glass-panel">
        <div className="panel-header-row">
          <div>
            <span className="section-eyebrow">Measured / receipt gasUsed per operation</span>
            <h2 className="panel-title">What it cost on Monad Testnet</h2>
          </div>
          <button className="btn btn--small" onClick={replay}>Replay</button>
        </div>
        <GasRows run={run} />
        <p className="lr-note">
          Layouts come from the known contract storage; gas values are the saved receipts. Both contracts remain
          mapping-based, so this shows a workload-specific saving &mdash; not a proven Monad storage-page locality
          mechanism.
        </p>
      </section>
    </div>
  );
}
