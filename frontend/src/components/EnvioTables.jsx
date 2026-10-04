import { useState } from 'react';

/**
 * Neo-Brutalist Envio HyperSync Tables
 * - Solid slab with 2px ink border & hard shadow
 * - High-contrast monospace table cells
 * - Stark BUY/SELL solid badges
 */
export default function EnvioTables({ orders = [], trades = [], backendOk }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [sideFilter, setSideFilter] = useState('ALL');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchTerm ||
      o.orderId?.toString().includes(searchTerm) ||
      o.trader?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSide =
      sideFilter === 'ALL' ||
      (sideFilter === 'BUY' && o.side === 0) ||
      (sideFilter === 'SELL' && o.side === 1);
    return matchesSearch && matchesSide;
  });

  const filteredTrades = trades.filter((t) => {
    return (
      !searchTerm ||
      t.orderId?.toString().includes(searchTerm) ||
      t.transactionHash?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="brutalist-panel" style={{ padding: '20px' }}>
      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('orders')}
            className={`brutalist-btn ${activeTab === 'orders' ? 'brutalist-btn-volt' : ''}`}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            Orders [{filteredOrders.length}]
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`brutalist-btn ${activeTab === 'trades' ? 'brutalist-btn-volt' : ''}`}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            Settled Trades [{filteredTrades.length}]
          </button>
          <span className={`brutalist-badge ${backendOk ? 'brutalist-badge--volt' : 'brutalist-badge--pink'}`} style={{ fontSize: '0.65rem' }}>
            {backendOk ? 'HYPERSYNC' : 'FIXTURE'}
          </span>
        </div>

        {/* Filter Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'orders' && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {['ALL', 'BUY', 'SELL'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`brutalist-btn ${sideFilter === s ? 'brutalist-btn-volt' : ''}`}
                  style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div
            className="brutalist-well"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              width: '180px',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>⌕</span>
            <input
              type="text"
              placeholder="Search ID / Hash…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="table-wrapper" style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {activeTab === 'orders' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>TRADER</th>
                <th>SIDE</th>
                <th>PRICE</th>
                <th>QTY</th>
                <th>SLOTS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    NO MATCHING ORDERS FOUND
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id || o.orderId}>
                    <td className="text-data" style={{ color: 'var(--accent-cyan)' }}>
                      #{o.orderId}
                    </td>
                    <td className="text-data" style={{ color: 'var(--text-muted)' }}>
                      {o.trader ? `${o.trader.slice(0, 6)}…${o.trader.slice(-4)}` : '0x8f2a…91c4'}
                    </td>
                    <td>
                      <span
                        className={`brutalist-badge ${
                          o.side === 0 ? 'brutalist-badge--volt' : 'brutalist-badge--pink'
                        }`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {o.side === 0 ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td className="text-data">{o.price} MON</td>
                    <td className="text-data">{o.quantity}</td>
                    <td>
                      <span className="brutalist-badge brutalist-badge--cyan" style={{ fontSize: '0.65rem' }}>
                        2 Packed
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>PRICE</th>
                <th>QTY</th>
                <th>TX HASH</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    NO TRADES RECORDED
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr key={t.id || t.orderId}>
                    <td className="text-data" style={{ color: 'var(--accent-cyan)' }}>
                      #{t.orderId}
                    </td>
                    <td className="text-data">{t.price} MON</td>
                    <td className="text-data">{t.quantity}</td>
                    <td className="text-data" style={{ color: 'var(--text-muted)' }}>
                      {t.transactionHash ? `${t.transactionHash.slice(0, 8)}…` : '0x3c9f…'}
                    </td>
                    <td>
                      <span className="brutalist-badge brutalist-badge--volt" style={{ fontSize: '0.65rem' }}>
                        SETTLED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
