import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import './App.css';

const operations = ['place', 'update', 'cancel', 'execute'];
const operationLabels = { place: 'Place order', update: 'Update order', cancel: 'Cancel order', execute: 'Execute trade' };

const formatNumber = value => (value === null || value === undefined ? '—' : Number(value).toLocaleString());
const shortHash = value => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—';
const percent = (naive, pagesync) => naive > 0 ? (((naive - pagesync) / naive) * 100).toFixed(2) : '0.00';

function StatCard({ label, value, detail, tone = '' }) {
  return <div className="stat-card">
    <span className="eyebrow">{label}</span>
    <strong className={tone}>{value}</strong>
    {detail && <span className="stat-detail">{detail}</span>}
  </div>;
}

function EmptyState({ title, message }) {
  return <div className="empty-state"><strong>{title}</strong><span>{message}</span></div>;
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function BenchmarkTable({ benchmark }) {
  const naive = benchmark?.naive;
  const pagesync = benchmark?.pagesync;
  const hasResults = Boolean(naive?.total || pagesync?.total);
  return <div className="table-scroll">
    <table className="data-table benchmark-table">
      <thead><tr><th>Operation</th><th>Conventional</th><th>PageSync</th><th>Difference</th><th>Sample size</th></tr></thead>
      <tbody>
        {operations.map(operation => {
          const n = naive?.[operation];
          const p = pagesync?.[operation];
          const diff = n?.total || p?.total ? percent(n?.total || 0, p?.total || 0) : null;
          return <tr key={operation}>
            <td><strong>{operationLabels[operation]}</strong></td>
            <td className="mono">{hasResults ? formatNumber(n?.avg) : '—'} <small>avg gas</small></td>
            <td className="mono pagesync-text">{hasResults ? formatNumber(p?.avg) : '—'} <small>avg gas</small></td>
            <td>{diff === null ? '—' : <StatusPill tone={Number(diff) >= 0 ? 'positive' : 'negative'}>{diff}%</StatusPill>}</td>
            <td className="mono">{n?.count || p?.count ? formatNumber(n?.count || p?.count) : '—'}</td>
          </tr>;
        })}
        <tr className="total-row">
          <td><strong>Total gas</strong></td>
          <td className="mono"><strong>{hasResults ? formatNumber(naive?.total) : '—'}</strong></td>
          <td className="mono pagesync-text"><strong>{hasResults ? formatNumber(pagesync?.total) : '—'}</strong></td>
          <td><strong>{hasResults ? formatNumber((naive?.total || 0) - (pagesync?.total || 0)) : '—'}</strong></td>
          <td>All operations</td>
        </tr>
      </tbody>
    </table>
  </div>;
}

function OrdersTable({ orders, onSelect }) {
  if (!orders.length) return <EmptyState title="No indexed orders yet" message="Start Envio and run the benchmark workload to see OrderPlaced events here." />;
  return <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Order</th><th>Trader</th><th>Price</th><th>Quantity</th><th>Side</th><th>Block</th><th>Transaction</th></tr></thead>
    <tbody>{orders.map(order => <tr key={order.id} onClick={() => onSelect(order.orderId)} className="clickable-row">
      <td className="mono">#{order.orderId}</td>
      <td className="mono">{shortHash(order.trader)}</td>
      <td className="mono">{formatNumber(order.price)}</td>
      <td className="mono">{formatNumber(order.quantity)}</td>
      <td><StatusPill tone={Number(order.side) === 0 ? 'positive' : 'negative'}>{Number(order.side) === 0 ? 'BUY' : 'SELL'}</StatusPill></td>
      <td className="mono">{formatNumber(order.blockNumber)}</td>
      <td className="mono">{shortHash(order.transactionHash)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function TradesTable({ trades }) {
  if (!trades.length) return <EmptyState title="No indexed trades yet" message="Executed trades will appear after TradeExecuted events are indexed by Envio." />;
  return <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Order</th><th>Price</th><th>Quantity</th><th>Block</th><th>Transaction</th><th>Contract</th></tr></thead>
    <tbody>{trades.map(trade => <tr key={trade.id}>
      <td className="mono">#{trade.orderId}</td><td className="mono">{formatNumber(trade.price)}</td>
      <td className="mono">{formatNumber(trade.quantity)}</td><td className="mono">{formatNumber(trade.blockNumber)}</td>
      <td className="mono">{shortHash(trade.transactionHash)}</td><td className="mono">{shortHash(trade.contractAddress)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function Overview({ stats, benchmark, orders, trades, onNavigate }) {
  const totalGas = benchmark?.naive?.total || benchmark?.pagesync?.total;
  const savings = benchmark?.naive?.total ? percent(benchmark.naive.total, benchmark.pagesync?.total || 0) : null;
  return <div className="page-content">
    <section className="hero-panel">
      <div><span className="kicker">MONAD TESTNET / ONCHAIN FINANCE</span><h1>Measure storage locality.<br /><em>Prove the difference.</em></h1>
        <p>PageSync runs an identical order-book workload against conventional and page-aware storage layouts, then reports measured gas behavior through Envio.</p>
        <button className="primary-button" onClick={() => onNavigate('benchmark')}>View benchmark results <span>→</span></button>
      </div>
      <div className="hero-diagram"><div className="diagram-node">NAIVE<br /><small>5 storage slots</small></div><div className="diagram-line" /><div className="diagram-node highlighted">PAGESYNC<br /><small>2 packed slots</small></div><div className="diagram-caption">same workload → measured gas</div></div>
    </section>
    <div className="stats-grid">
      <StatCard label="Orders indexed" value={formatNumber(stats?.envio?.ordersPlaced)} detail={`${formatNumber(stats?.envio?.ordersUpdated)} updates`} />
      <StatCard label="Trades indexed" value={formatNumber(stats?.envio?.tradesExecuted)} detail={`${formatNumber(stats?.envio?.ordersCancelled)} cancellations`} />
      <StatCard label="Benchmark total gas" value={totalGas ? formatNumber(totalGas) : 'Not run'} detail={benchmark ? 'Measured from Foundry run' : 'Run RunBenchmark.s.sol'} />
      <StatCard label="Measured improvement" value={savings === null ? 'Not available' : `${savings}%`} detail="Naive total minus PageSync total" tone={savings > 0 ? 'positive-text' : ''} />
    </div>
    <div className="two-column">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST DATA</span><h2>Order activity</h2></div><button className="text-button" onClick={() => onNavigate('orders')}>View all →</button></div><OrdersTable orders={orders.slice(0, 5)} onSelect={() => onNavigate('orders')} /></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST DATA</span><h2>Trade activity</h2></div><button className="text-button" onClick={() => onNavigate('trades')}>View all →</button></div><TradesTable trades={trades.slice(0, 5)} /></section>
    </div>
  </div>;
}

function BenchmarkPage({ benchmark }) {
  const hasResults = Boolean(benchmark?.naive?.total || benchmark?.pagesync?.total);
  return <div className="page-content"><div className="page-heading"><div><span className="kicker">EVIDENCE, NOT ASSUMPTIONS</span><h1>Gas benchmark</h1><p>Both contracts receive the same 100 placements, 100 updates, 50 cancellations and 50 executions.</p></div><StatusPill tone={hasResults ? 'positive' : 'warning'}>{hasResults ? 'Measured result' : 'Awaiting benchmark'}</StatusPill></div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">OPERATION COMPARISON</span><h2>Conventional vs PageSync</h2></div><span className="muted">Gas units • lower is better</span></div><BenchmarkTable benchmark={benchmark} />{!hasResults && <div className="callout warning-callout"><strong>No benchmark data has been generated.</strong><span>Deploy both contracts and run <code>forge script script/RunBenchmark.s.sol --broadcast</code>. The dashboard never substitutes estimated gas for measured values.</span></div>}</section>
    <div className="two-column"><section className="panel"><span className="eyebrow">METHODOLOGY</span><h2>Fair workload</h2><ul className="clean-list"><li><strong>100</strong> placeOrder calls</li><li><strong>100</strong> updateOrder calls</li><li><strong>50</strong> cancelOrder calls</li><li><strong>50</strong> executeTrade calls</li></ul></section><section className="panel"><span className="eyebrow">INTERPRETATION</span><h2>How to read this</h2><p className="body-copy">A positive difference means PageSync used less gas than the conventional layout. Results are produced by the Foundry script and written to <code>benchmark/results/benchmark.json</code>; Envio does not measure SLOAD or SSTORE operations.</p></section></div>
  </div>;
}

function AnalyticsPage({ stats }) {
  const items = [['Orders created', stats?.envio?.ordersPlaced], ['Orders updated', stats?.envio?.ordersUpdated], ['Orders cancelled', stats?.envio?.ordersCancelled], ['Trades executed', stats?.envio?.tradesExecuted]];
  return <div className="page-content"><div className="page-heading"><div><span className="kicker">ENVIO HYPERINDEX</span><h1>Analytics</h1><p>Historical application events indexed from both order-book contracts.</p></div><StatusPill tone={stats?.envio?.envioAvailable ? 'positive' : 'warning'}>{stats?.envio?.envioAvailable ? 'Indexer active' : 'Indexer unavailable'}</StatusPill></div>
    <div className="stats-grid analytics-stats">{items.map(([label, value]) => <StatCard key={label} label={label} value={formatNumber(value)} detail="indexed events" />)}</div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">DATA PIPELINE</span><h2>Event coverage</h2></div></div><div className="pipeline"><div><strong>Monad testnet</strong><span>OrderBook contracts</span></div><b>→</b><div><strong>Envio</strong><span>Event indexing</span></div><b>→</b><div><strong>PageSync UI</strong><span>Historical analytics</span></div></div><div className="callout"><strong>What Envio contributes</strong><span>OrderPlaced, OrderUpdated, OrderCancelled and TradeExecuted events, including block, transaction and contract metadata.</span></div></section>
  </div>;
}

function StoragePage() {
  return <div className="page-content"><div className="page-heading"><div><span className="kicker">DESIGN EXPLAINER</span><h1>Storage architecture</h1><p>Why the two implementations exist and what PageSync is testing on Monad.</p></div></div>
    <div className="two-column storage-columns"><section className="panel storage-panel naive-panel"><span className="storage-number">01</span><h2>Conventional layout</h2><p>NaiveOrderBook stores each field in a separate struct slot.</p><pre>{`struct Order {\n  address trader;    // slot +0\n  uint256 price;     // slot +1\n  uint256 quantity;  // slot +2\n  Side side;         // slot +3\n  Status status;     // slot +4\n}`}</pre><div className="storage-note">Five slots can cross Monad storage-page boundaries.</div></section><section className="panel storage-panel page-panel"><span className="storage-number">02</span><h2>PageSync layout</h2><p>PageSyncOrderBook packs frequently accessed fields into two adjacent slots.</p><pre>{`uint256 data1;\n// trader (160) | price (80)\n\nuint256 data2;\n// qty (128) | side (8) | status (8)`}</pre><div className="storage-note">Two adjacent slots are designed to benefit from page warming.</div></section></div>
    <section className="panel"><span className="eyebrow">THE EXPERIMENT</span><h2>Same workload, different layout</h2><div className="experiment-steps"><div><b>1</b><span>Deploy both contracts</span></div><div><b>2</b><span>Run identical operations</span></div><div><b>3</b><span>Record actual gas</span></div><div><b>4</b><span>Compare the evidence</span></div></div></section>
  </div>;
}

function ActivityPage({ type, orders, trades, onSelect, filter, setFilter }) {
  const isOrders = type === 'orders';
  const source = isOrders ? orders : trades;
  const filtered = source.filter(item => JSON.stringify(item).toLowerCase().includes(filter.toLowerCase()));
  return <div className="page-content"><div className="page-heading"><div><span className="kicker">ENVIO DATA</span><h1>{isOrders ? 'Order activity' : 'Trade activity'}</h1><p>{isOrders ? 'OrderPlaced events with trader, side, block and transaction context.' : 'TradeExecuted events emitted by the order books.'}</p></div></div>
    <section className="panel"><div className="toolbar"><input value={filter} onChange={event => setFilter(event.target.value)} placeholder={isOrders ? 'Search order ID or trader…' : 'Search order ID or transaction…'} /><span className="muted">{filtered.length} shown</span></div>{isOrders ? <OrdersTable orders={filtered} onSelect={onSelect} /> : <TradesTable trades={filtered} />}</section>
  </div>;
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [benchmark, setBenchmark] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [addresses, setAddresses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchAll = useCallback(async () => {
    setError('');
    const results = await Promise.allSettled([api.benchmark(), api.stats(), api.orders(100), api.trades(100), api.addresses()]);
    const [bench, stat, ord, tr, addr] = results;
    if (bench.status === 'fulfilled') setBenchmark(bench.value);
    if (stat.status === 'fulfilled') setStats(stat.value);
    if (ord.status === 'fulfilled') setOrders(ord.value.orders || []);
    if (tr.status === 'fulfilled') setTrades(tr.value.trades || []);
    if (addr.status === 'fulfilled') setAddresses(addr.value);
    if (results.slice(0, 4).every(result => result.status === 'rejected')) setError('Backend is unavailable. Start the Node server to load live benchmark and Envio data.');
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const interval = setInterval(fetchAll, 15000); return () => clearInterval(interval); }, [fetchAll]);

  const navItems = useMemo(() => [['overview', 'Overview'], ['benchmark', 'Benchmark'], ['orders', 'Orders'], ['trades', 'Trades'], ['analytics', 'Analytics'], ['storage', 'Storage design']], []);
  const selectOrder = id => { setSelectedOrder(id); };
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">M</span><div><strong>MONAD<span>-</span>PAGESYNC</strong><small>STORAGE RESEARCH TOOL</small></div></div><nav>{navItems.map(([id, label]) => <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(id)}><span className={`nav-icon icon-${id}`} />{label}</button>)}</nav><div className="sidebar-footer"><div className="network-status"><span className={stats?.envio?.envioAvailable ? 'online-dot' : 'warning-dot'} />{stats?.envio?.envioAvailable ? 'Envio connected' : 'Envio pending'}</div><small>Monad Testnet · chain 10143</small></div></aside>
    <main className="main-area"><header className="topbar"><div><span className="mobile-brand">MONAD-PAGESYNC</span><span className="breadcrumb">RESEARCH DASHBOARD / {page.toUpperCase()}</span></div><div className="topbar-actions"><span className={error ? 'connection error' : 'connection'}>{error ? '● Backend offline' : loading ? '● Connecting…' : '● Live data'}</span><button className="refresh-button" onClick={fetchAll} disabled={loading}>↻ Refresh</button></div></header>
      {error && <div className="error-banner">{error}<button onClick={fetchAll}>Retry</button></div>}
      {page === 'overview' && <Overview stats={stats} benchmark={benchmark} orders={orders} trades={trades} onNavigate={setPage} />}
      {page === 'benchmark' && <BenchmarkPage benchmark={benchmark} />}
      {page === 'analytics' && <AnalyticsPage stats={stats} />}
      {page === 'storage' && <StoragePage />}
      {page === 'orders' && <ActivityPage type="orders" orders={orders} trades={trades} onSelect={selectOrder} filter={orderFilter} setFilter={setOrderFilter} />}
      {page === 'trades' && <ActivityPage type="trades" orders={orders} trades={trades} onSelect={selectOrder} filter={tradeFilter} setFilter={setTradeFilter} />}
      <footer className="footer"><span>Monad-PageSync · experimental research tool</span><span>{addresses?.network || 'Monad Testnet'} · Data refreshes every 15s</span></footer>
    </main>
    {selectedOrder && <OrderDetail orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />}
  </div>;
}

function OrderDetail({ orderId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.order(orderId).then(setDetail).catch(err => setError(err.message)); }, [orderId]);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">ORDER DETAIL</span><h2>Order #{orderId}</h2></div><button className="close-button" onClick={onClose}>×</button></div>{error ? <EmptyState title="Unable to load order" message={error} /> : !detail ? <div className="loading-state">Loading indexed history…</div> : <div className="detail-grid"><div><span>Status</span><strong><StatusPill tone={detail.status === 'ACTIVE' ? 'positive' : 'warning'}>{detail.status}</StatusPill></strong></div><div><span>Trader</span><strong className="mono">{shortHash(detail.placed?.trader)}</strong></div><div><span>Price</span><strong className="mono">{formatNumber(detail.placed?.price)}</strong></div><div><span>Quantity</span><strong className="mono">{formatNumber(detail.placed?.quantity)}</strong></div><div><span>Updates</span><strong>{detail.updates?.length || 0}</strong></div><div><span>Execution</span><strong>{detail.executed ? 'TradeExecuted' : '—'}</strong></div></div>}</div></div>;
}
