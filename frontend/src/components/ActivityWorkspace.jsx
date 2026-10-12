import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api';

const MONAD_EXPLORER = 'https://testnet.monadexplorer.com';

const KNOWN_CONTRACTS = {
  '0x5de52bc09a2a688f6c4615099465e9049cc83bc1': { name: 'PageSync OrderBook', tag: 'Packed (2 Slots)', color: '#7257FF' },
  '0x9eddb8b7612954014af0ffa58dc9d93db2c75d68': { name: 'Naive OrderBook', tag: 'Standard (4 Slots)', color: '#64748B' },
  '0xa241896a7dbe8a550d2e5ff7a914bb1989ced2d9': { name: 'Kuru Market DEX', tag: 'OrderBook Venue', color: '#10B981' },
};

function formatAddress(addr) {
  if (!addr) return '—';
  const a = addr.trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const num = typeof ts === 'string' ? parseInt(ts, 10) : ts;
  if (!num) return '—';
  // Check if milliseconds vs seconds
  const ms = num < 1e11 ? num * 1000 : num;
  const date = new Date(ms);
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);

  let relative = '';
  if (diffSec < 60) relative = `${diffSec}s ago`;
  else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
  else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
  else relative = `${Math.floor(diffSec / 86400)}d ago`;

  return { relative, full: date.toUTCString() };
}

export default function ActivityWorkspace() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [kuru, setKuru] = useState({ orders: [], trades: [], cancellations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());

  // Filters & Pagination
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, ordersRes, tradesRes, kuruRes] = await Promise.allSettled([
        api.stats(),
        api.orders(100),
        api.trades(100),
        api.kuruActivity(100),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.orders || []);
      if (tradesRes.status === 'fulfilled') setTrades(tradesRes.value.trades || []);
      if (kuruRes.status === 'fulfilled') setKuru(kuruRes.value || { orders: [], trades: [], cancellations: [] });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load activity data', err);
      setError('Unable to load live activity stream from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      await loadData();
    };
    fetchAll();
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [loadData, autoRefresh]);

  // Normalize all events into a unified timeline
  const timeline = useMemo(() => {
    const list = [];

    // 1. PageSync / Naive Orders Placed
    orders.forEach((o) => {
      const cAddr = (o.contractAddress || '').toLowerCase();
      const info = KNOWN_CONTRACTS[cAddr] || { name: 'OrderBook Contract', tag: 'Custom', color: '#7257FF' };
      list.push({
        id: `order-${o.id || o.orderId}-${o.blockNumber}`,
        eventType: 'ORDER_PLACED',
        sourceName: info.name,
        sourceTag: info.tag,
        sourceColor: info.color,
        contractAddress: cAddr,
        orderId: o.orderId,
        actor: o.trader,
        actorRole: 'Trader',
        price: o.price,
        quantity: o.quantity,
        side: o.side === 0 || o.side === '0' ? 'BUY' : 'SELL',
        blockNumber: Number(o.blockNumber || 0),
        timestamp: Number(o.blockTimestamp || 0),
        txHash: o.transactionHash || '',
      });
    });

    // 2. Trades Executed
    trades.forEach((t) => {
      const cAddr = (t.contractAddress || '').toLowerCase();
      const info = KNOWN_CONTRACTS[cAddr] || { name: 'OrderBook Contract', tag: 'Executed', color: '#059669' };
      list.push({
        id: `trade-${t.id || t.orderId}-${t.blockNumber}`,
        eventType: 'TRADE_EXECUTED',
        sourceName: info.name,
        sourceTag: info.tag,
        sourceColor: '#059669',
        contractAddress: cAddr,
        orderId: t.orderId,
        actor: t.trader || '',
        actorRole: 'Participant',
        price: t.price,
        quantity: t.quantity,
        side: 'TRADE',
        blockNumber: Number(t.blockNumber || 0),
        timestamp: Number(t.blockTimestamp || 0),
        txHash: t.transactionHash || '',
      });
    });

    // 3. Kuru Orders Created
    (kuru.orders || []).forEach((ko) => {
      list.push({
        id: `kuru-order-${ko.id || ko.orderId}-${ko.blockNumber}`,
        eventType: 'KURU_ORDER',
        sourceName: 'Kuru Market DEX',
        sourceTag: 'CLOB Market',
        sourceColor: '#10B981',
        contractAddress: (ko.marketAddress || '0xa241896a7dbe8a550d2e5ff7a914bb1989ced2d9').toLowerCase(),
        orderId: ko.orderId,
        actor: ko.owner,
        actorRole: 'Maker',
        price: ko.price,
        quantity: ko.size,
        side: ko.isBuy ? 'BUY' : 'SELL',
        blockNumber: Number(ko.blockNumber || 0),
        timestamp: Number(ko.blockTimestamp || 0),
        txHash: ko.transactionHash || '',
      });
    });

    // 4. Kuru Trades
    (kuru.trades || []).forEach((kt) => {
      list.push({
        id: `kuru-trade-${kt.id || kt.orderId}-${kt.blockNumber}`,
        eventType: 'KURU_TRADE',
        sourceName: 'Kuru Market DEX',
        sourceTag: 'Fill',
        sourceColor: '#10B981',
        contractAddress: (kt.marketAddress || '').toLowerCase(),
        orderId: kt.orderId,
        actor: kt.takerAddress || kt.makerAddress,
        actorRole: 'Taker / Maker',
        price: kt.price,
        quantity: kt.filledSize || kt.updatedSize,
        side: kt.isBuy ? 'BUY FILL' : 'SELL FILL',
        blockNumber: Number(kt.blockNumber || 0),
        timestamp: Number(kt.blockTimestamp || 0),
        txHash: kt.transactionHash || '',
      });
    });

    // Sort by blockNumber descending, then timestamp descending
    list.sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
      return b.timestamp - a.timestamp;
    });

    return list;
  }, [orders, trades, kuru]);

  // Filter & Search
  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      // Type filter
      if (filterType === 'orders' && !item.eventType.includes('ORDER')) return false;
      if (filterType === 'trades' && !item.eventType.includes('TRADE')) return false;
      if (filterType === 'kuru' && !item.eventType.startsWith('KURU')) return false;

      // Source filter
      if (filterSource === 'pagesync' && !item.sourceName.includes('PageSync')) return false;
      if (filterSource === 'naive' && !item.sourceName.includes('Naive')) return false;
      if (filterSource === 'kuru' && !item.sourceName.includes('Kuru')) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesId = String(item.orderId || '').toLowerCase().includes(q);
        const matchesActor = String(item.actor || '').toLowerCase().includes(q);
        const matchesBlock = String(item.blockNumber || '').includes(q);
        const matchesSource = item.sourceName.toLowerCase().includes(q);
        if (!matchesId && !matchesActor && !matchesBlock && !matchesSource) return false;
      }

      return true;
    });
  }, [timeline, filterType, filterSource, searchQuery]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredTimeline.length / pageSize));
  const currentPageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTimeline.slice(start, start + pageSize);
  }, [filteredTimeline, page, pageSize]);

  const envioInfo = stats?.envio || {};
  const isEnvioLive = envioInfo.envioAvailable;

  return (
    <div className="glass-panel" id="section-activity">
      {/* Header & Status */}
      <div className="panel-header-row" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="section-eyebrow">MONAD TESTNET // REAL-TIME EVENT STREAM</span>
          <h2 className="panel-title">Indexed Activity & Settlement Ledger</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className={`status-badge ${isEnvioLive ? 'green' : 'amber'}`}>
            <span className="fps-dot" style={{ background: isEnvioLive ? '#10B981' : '#F59E0B' }} />
            {isEnvioLive ? 'ENVIO INDEXER ONLINE' : 'ENVIO STANDBY'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Synced: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            className="btn-secondary"
            onClick={loadData}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            {loading ? '⟳ Refreshing...' : '↻ Refresh'}
          </button>
          <button
            className={`preset-chip-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{ padding: '6px 10px', fontSize: '11px' }}
            title="Auto-refresh every 10 seconds"
          >
            {autoRefresh ? 'Auto 10s: ON' : 'Auto: OFF'}
          </button>
        </div>
      </div>

      {/* Indexer Telemetry Summary */}
      <div className="grid-four-col" style={{ marginBottom: '24px' }}>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Indexer Target Block</span>
          <strong className="metric-chip-val brand-color">
            {envioInfo.latestProcessedBlock ? `#${Number(envioInfo.latestProcessedBlock).toLocaleString()}` : 'Tracking head'}
          </strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Indexed Orders</span>
          <strong className="metric-chip-val green">
            {(envioInfo.ordersPlaced || 0) + (envioInfo.kuruOrders || 0)}
          </strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Indexed Trades</span>
          <strong className="metric-chip-val">
            {(envioInfo.tradesExecuted || 0) + (envioInfo.kuruTrades || 0)}
          </strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Chain ID & Network</span>
          <strong className="metric-chip-val purple">
            {envioInfo.chainId || 10143} · Monad Testnet
          </strong>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--bg-surface-elevated)',
          borderRadius: '10px',
          border: '1px solid var(--line-border)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', marginRight: '4px' }}>
            FILTER:
          </span>
          <button
            className={`preset-chip-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterType('all'); setPage(1); }}
          >
            All Events ({timeline.length})
          </button>
          <button
            className={`preset-chip-btn ${filterType === 'orders' ? 'active' : ''}`}
            onClick={() => { setFilterType('orders'); setPage(1); }}
          >
            Orders
          </button>
          <button
            className={`preset-chip-btn ${filterType === 'trades' ? 'active' : ''}`}
            onClick={() => { setFilterType('trades'); setPage(1); }}
          >
            Trades
          </button>
          <button
            className={`preset-chip-btn ${filterType === 'kuru' ? 'active' : ''}`}
            onClick={() => { setFilterType('kuru'); setPage(1); }}
          >
            Kuru DEX
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--line-border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Contracts</option>
            <option value="pagesync">PageSync OrderBook</option>
            <option value="naive">Naive OrderBook</option>
            <option value="kuru">Kuru Market</option>
          </select>

          <input
            type="text"
            placeholder="Search Order ID, Address, Block..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--line-border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '11px',
              minWidth: '220px',
            }}
          />
        </div>
      </div>

      {/* Activity Table */}
      {error && (
        <div className="info-callout warning" style={{ marginBottom: '16px' }}>
          <b>Notice:</b> {error}
        </div>
      )}

      {loading && timeline.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="status-beacon-pulse" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px' }}>Streaming indexed events from Monad Testnet...</p>
        </div>
      ) : filteredTimeline.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-pure)', marginBottom: '6px' }}>
            No Matching Events Found
          </p>
          <p style={{ fontSize: '12px' }}>
            {searchQuery || filterType !== 'all' || filterSource !== 'all'
              ? 'Try resetting your filter or search query.'
              : 'Submit an order in Developer Lab or Kuru Market to generate live events.'}
          </p>
        </div>
      ) : (
        <div className="table-scroll-wrapper">
          <table className="custom-data-table">
            <thead>
              <tr>
                <th>Event / Action</th>
                <th>Contract & Source</th>
                <th>Order ID</th>
                <th>Side</th>
                <th>Price & Quantity</th>
                <th>Trader / Account</th>
                <th>Block</th>
                <th>Time</th>
                <th>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {currentPageItems.map((item) => {
                const timeInfo = formatTimestamp(item.timestamp);
                const isBuy = item.side.includes('BUY');
                const isTrade = item.eventType.includes('TRADE');

                return (
                  <tr key={item.id}>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: isTrade ? 'rgba(5, 150, 105, 0.12)' : 'rgba(114, 87, 255, 0.12)',
                          color: isTrade ? 'var(--accent-green)' : 'var(--monad-purple)',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isTrade ? 'var(--accent-green)' : 'var(--monad-purple)',
                          }}
                        />
                        {item.eventType.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '12px', color: item.sourceColor }}>
                          {item.sourceName}
                        </strong>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {item.sourceTag}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        #{item.orderId || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: isTrade
                            ? 'var(--accent-green)'
                            : isBuy
                            ? 'var(--accent-green)'
                            : 'var(--crimson-red)',
                        }}
                      >
                        {item.side}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          P: {item.price || '—'}
                        </span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>·</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          Q: {item.quantity || '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {item.actor ? (
                        <a
                          href={`${MONAD_EXPLORER}/address/${item.actor}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: 'var(--monad-purple)',
                            textDecoration: 'none',
                          }}
                          title={item.actor}
                        >
                          {formatAddress(item.actor)} ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.blockNumber ? (
                        <a
                          href={`${MONAD_EXPLORER}/block/${item.blockNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: 'var(--text-main)',
                            textDecoration: 'none',
                          }}
                        >
                          #{item.blockNumber.toLocaleString()}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span title={timeInfo.full} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {timeInfo.relative}
                      </span>
                    </td>
                    <td>
                      {item.txHash ? (
                        <a
                          href={`${MONAD_EXPLORER}/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          Receipt ↗
                        </a>
                      ) : item.blockNumber ? (
                        <a
                          href={`${MONAD_EXPLORER}/block/${item.blockNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          Block ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Indexed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredTimeline.length > pageSize && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredTimeline.length)} of {filteredTimeline.length} events
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600 }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
