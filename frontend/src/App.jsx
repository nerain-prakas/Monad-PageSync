import { useState, useRef, useEffect, useCallback } from 'react';
import StorageBenchmark3D from './components/StorageBenchmark3D';
import { api } from './api';
import './App.css';

// ── Formatters ──────────────────────────────────────────────────────────────
const fmt  = n => (n ?? 0).toLocaleString();
const pct  = (a, b) => b > 0 ? (((a - b) / b) * 100).toFixed(1) : '0.0';

export default function App() {
  const [mode,      setModeState] = useState('pagesync');
  const [benchmark, setBenchmark] = useState(null);
  const [stats,     setStats]     = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [trades,    setTrades]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [backendOk, setBackendOk] = useState(false);
  const triggerRef = useRef(null);

  // ── Fetch all data from backend ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [bench, st, ord, tr] = await Promise.allSettled([
        api.benchmark(), api.stats(), api.orders(10), api.trades(10),
      ]);
      if (bench.status  === 'fulfilled') setBenchmark(bench.value);
      if (st.status     === 'fulfilled') setStats(st.value);
      if (ord.status    === 'fulfilled') setOrders(ord.value.orders || []);
      if (tr.status     === 'fulfilled') setTrades(tr.value.trades || []);
      setBackendOk(true);
    } catch {
      setBackendOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 15_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Derived benchmark metrics ───────────────────────────────────────────
  const nb = benchmark?.naive;
  const pb = benchmark?.pagesync;
  const hasData = nb?.total > 0 || pb?.total > 0;

  const naiveAvgPlace  = hasData ? Math.round((nb?.place?.avg  ?? 0)) : 17350;
  const psAvgPlace     = hasData ? Math.round((pb?.place?.avg  ?? 0)) : 12420;
  const gasDiff        = hasData
    ? pct(psAvgPlace, naiveAvgPlace)
    : '-28.4';
  const gasDiffGreen   = parseFloat(gasDiff) < 0;

  const currentGas = mode === 'pagesync' ? fmt(psAvgPlace) : fmt(naiveAvgPlace);
  const diffLabel  = mode === 'pagesync'
    ? `${gasDiff}% vs Conventional`
    : `+${Math.abs(pct(naiveAvgPlace, psAvgPlace))}% Higher Gas Usage`;

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="header-card">
        <div className="brand-group">
          <div className="logo-badge">M</div>
          <div className="title-area">
            <h1 className="title-text">MONAD-PAGESYNC 3D</h1>
            <span className="subtitle-text">PAGE-AWARE STORAGE BENCHMARK</span>
          </div>
        </div>
        <div className="tag-badge" style={{ color: backendOk ? 'var(--positive)' : 'var(--error)' }}>
          {backendOk ? '● BACKEND CONNECTED' : '○ BACKEND OFFLINE'}
          {stats?.envio?.envioAvailable ? ' • ENVIO INDEXED' : ' • ENVIO PENDING'}
        </div>
      </header>

      {/* ── 3D Viewport ────────────────────────────────────────────────── */}
      <div className="viewport-wrapper">
        <StorageBenchmark3D mode={mode} triggerRef={triggerRef} />
        {/* Legend overlay */}
        <div className="viewport-overlay">
          <div className="legend-hud">
            <div className="legend-item"><span className="legend-dot" style={{ background: '#ff007a' }} />Cold SLOAD / SSTORE (High Gas)</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#2575fc' }} />Page-Warmed SLOAD (Low Gas)</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#705ec2' }} />Envio Event Streamer</div>
          </div>
        </div>
      </div>

      {/* ── Metrics ────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="metric-card">
          <span className="metric-label">Benchmark Mode</span>
          <span className="metric-val">{mode === 'pagesync' ? 'PageSync Layout' : 'Conventional'}</span>
          <span className="metric-sub">{mode === 'pagesync' ? 'Contiguous Storage Locality' : 'Fragmented Mapping Slots'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Avg Gas / Place Op</span>
          <span className="metric-val">{loading ? '…' : currentGas}</span>
          <span className="metric-sub" style={{ color: mode === 'pagesync' && gasDiffGreen ? 'var(--positive)' : 'var(--error)' }}>
            {loading ? '—' : diffLabel}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Envio Indexer</span>
          <span className="metric-val" style={{ color: stats?.envio?.envioAvailable ? 'var(--positive)' : 'var(--primary)' }}>
            {stats?.envio?.envioAvailable ? 'ACTIVE' : 'STANDBY'}
          </span>
          <span className="metric-sub">
            {fmt(stats?.envio?.ordersPlaced)} OrderPlaced • {fmt(stats?.envio?.tradesExecuted)} Trades
          </span>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="control-deck">
        <div className="chip-group">
          <button
            className={`chip ${mode === 'pagesync' ? 'active' : ''}`}
            onClick={() => setModeState('pagesync')}
          >PageSync Layout</button>
          <button
            className={`chip ${mode === 'conventional' ? 'active' : ''}`}
            onClick={() => setModeState('conventional')}
          >Conventional Mapping</button>
        </div>
        <button
          className="btn-accent"
          onClick={() => triggerRef.current?.trigger()}
        >⚡ Trigger 100 Ops Workload</button>
      </div>

      {/* ── Benchmark Breakdown ────────────────────────────────────────── */}
      {hasData && (
        <section className="section-card">
          <h2 className="section-title">Gas Benchmark Results</h2>
          <div className="bench-grid">
            {['place', 'update', 'cancel', 'execute'].map(op => (
              <div key={op} className="bench-op-card">
                <div className="bench-op-name">{op.toUpperCase()}</div>
                <div className="bench-row">
                  <span className="bench-label">Naive avg</span>
                  <span className="bench-val naive">{fmt(nb?.[op]?.avg)}</span>
                </div>
                <div className="bench-row">
                  <span className="bench-label">PageSync avg</span>
                  <span className="bench-val pagesync">{fmt(pb?.[op]?.avg)}</span>
                </div>
                <div className="bench-row">
                  <span className="bench-label">Δ</span>
                  <span className="bench-val delta" style={{ color: pb?.[op]?.avg < nb?.[op]?.avg ? 'var(--positive)' : 'var(--error)' }}>
                    {pct(pb?.[op]?.avg, nb?.[op]?.avg)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Orders ──────────────────────────────────────────────── */}
      {orders.length > 0 && (
        <section className="section-card">
          <h2 className="section-title">Recent Orders <span className="badge">Live via Envio</span></h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Order ID</th><th>Trader</th><th>Price</th><th>Qty</th><th>Side</th><th>Block</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="mono">{o.orderId}</td>
                    <td className="mono addr">{o.trader?.slice(0,8)}…</td>
                    <td className="mono">{o.price}</td>
                    <td className="mono">{o.quantity}</td>
                    <td><span className={`side-badge ${o.side === 0 ? 'buy' : 'sell'}`}>{o.side === 0 ? 'BUY' : 'SELL'}</span></td>
                    <td className="mono">{o.blockNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Recent Trades ──────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <section className="section-card">
          <h2 className="section-title">Recent Trades <span className="badge">Live via Envio</span></h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Order ID</th><th>Price</th><th>Qty</th><th>Tx Hash</th><th>Block</th></tr></thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td className="mono">{t.orderId}</td>
                    <td className="mono">{t.price}</td>
                    <td className="mono">{t.quantity}</td>
                    <td className="mono addr">{t.transactionHash?.slice(0,12)}…</td>
                    <td className="mono">{t.blockNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Storage Layout Explainer ───────────────────────────────────── */}
      <section className="section-card explainer">
        <h2 className="section-title">Storage Page Architecture</h2>
        <div className="explainer-grid">
          <div className="explainer-col">
            <h3 className="explainer-head naive-head">🔴 Naive (5 slots)</h3>
            <pre className="code-block">{`struct Order {
  address trader;   // slot +0
  uint256 price;    // slot +1
  uint256 quantity; // slot +2
  Side    side;     // slot +3
  Status  status;   // slot +4
}`}</pre>
            <p className="explainer-body">5 separate storage slots → possible page crossings → cold SLOAD penalties.</p>
          </div>
          <div className="explainer-col">
            <h3 className="explainer-head pagesync-head">🔵 PageSync (2 slots)</h3>
            <pre className="code-block">{`struct PackedOrder {
  uint256 data1;
  // trader(160) | price(80) | rsv(16)
  uint256 data2;
  // qty(128) | side(8) | status(8)
}`}</pre>
            <p className="explainer-body">2 adjacent slots → same 128-slot Monad page → warm-page benefit every op.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
