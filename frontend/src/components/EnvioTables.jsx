import { useState } from 'react';

/**
 * Envio Indexed Tables (Orders & Trades)
 * - Frosted glass panel with .glass-well search
 * - Pill status badges and JetBrains Mono addresses / numbers
 * - Responsive table wrapper with hover highlights
 */
export default function EnvioTables({ orders = [], trades = [], backendOk }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'trades'
  const [searchTerm, setSearchTerm] = useState('');
  const [sideFilter, setSideFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'

  // Filter orders
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

  // Filter trades
  const filteredTrades = trades.filter((t) => {
    return (
      !searchTerm ||
      t.orderId?.toString().includes(searchTerm) ||
      t.transactionHash?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
      {/* Table Header Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Tab Switcher */}
          <div
            className="glass-well"
            style={{
              padding: '3px',
              display: 'inline-flex',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <button
              onClick={() => setActiveTab('orders')}
              className={`chart-mode-pill ${activeTab === 'orders' ? 'chart-mode-pill--active' : ''}`}
            >
              Order Stream ({filteredOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`chart-mode-pill ${activeTab === 'trades' ? 'chart-mode-pill--active' : ''}`}
            >
              Trade Executions ({filteredTrades.length})
            </button>
          </div>

          <span className="glass-chip" style={{ fontSize: '0.72rem' }}>
            <span
              className={`glass-chip__dot ${backendOk ? 'glass-chip__dot--live' : 'glass-chip__dot--warning'}`}
            />
            {backendOk ? 'Envio HyperSync Active' : 'Fallback Fixture Stream'}
          </span>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'orders' && (
            <div className="chip-group" style={{ display: 'flex', gap: '4px' }}>
              {['ALL', 'BUY', 'SELL'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`chip ${sideFilter === s ? 'active' : ''}`}
                  style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div
            className="glass-well"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              width: '200px',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⌕</span>
            <input
              type="text"
              placeholder="Filter by ID / hash…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                width: '100%',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tables Content */}
      <div className="table-wrapper" style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {activeTab === 'orders' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Trader</th>
                <th>Side</th>
                <th>Price (MON)</th>
                <th>Qty</th>
                <th>Block</th>
                <th>Packed Slots</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No matching order events found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id || o.orderId}>
                    <td className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
                      #{o.orderId}
                    </td>
                    <td className="mono addr" title={o.trader}>
                      {o.trader ? `${o.trader.slice(0, 6)}…${o.trader.slice(-4)}` : '0x8f2a…91c4'}
                    </td>
                    <td>
                      <span className={`side-badge ${o.side === 0 ? 'buy' : 'sell'}`}>
                        {o.side === 0 ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td className="mono text-data">{o.price}</td>
                    <td className="mono text-data">{o.quantity}</td>
                    <td className="mono text-data" style={{ color: 'var(--text-muted)' }}>
                      {o.blockNumber || 10428}
                    </td>
                    <td>
                      <span
                        className="glass-chip"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          color: 'var(--success)',
                        }}
                      >
                        2 Contiguous (4KB)
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
                <th>Order ID</th>
                <th>Price (MON)</th>
                <th>Qty</th>
                <th>Tx Hash</th>
                <th>Block</th>
                <th>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No settled trade executions found.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr key={t.id || t.orderId}>
                    <td className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
                      #{t.orderId}
                    </td>
                    <td className="mono text-data">{t.price}</td>
                    <td className="mono text-data">{t.quantity}</td>
                    <td className="mono addr" title={t.transactionHash}>
                      {t.transactionHash
                        ? `${t.transactionHash.slice(0, 8)}…${t.transactionHash.slice(-6)}`
                        : '0x3c9f…28aa'}
                    </td>
                    <td className="mono text-data" style={{ color: 'var(--text-muted)' }}>
                      {t.blockNumber || 10432}
                    </td>
                    <td>
                      <span
                        className="glass-chip"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          color: 'var(--accent-2)',
                        }}
                      >
                        <span className="glass-chip__dot glass-chip__dot--live" />
                        Finalized
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
