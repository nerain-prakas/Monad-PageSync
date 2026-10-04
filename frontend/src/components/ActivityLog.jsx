import { useState } from 'react';

/**
 * Neo-Brutalist Activity Log & Mempool Stream
 * - Solid slab with 2px ink border & hard shadow
 * - Terminal style feed with mono timestamps and action tags
 */
export default function ActivityLog({ events = [] }) {
  const [filter, setFilter] = useState('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    return ev.type === filter;
  });

  return (
    <div className="brutalist-panel" style={{ padding: '20px' }}>
      {/* Header */}
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
          <h3 className="text-heading">Event Stream & Mempool</h3>
          <span className="brutalist-badge brutalist-badge--volt" style={{ fontSize: '0.65rem' }}>
            ● LIVE
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['ALL', 'ORDER', 'TRADE', 'STORAGE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`brutalist-btn ${filter === f ? 'brutalist-btn-volt' : ''}`}
              style={{ fontSize: '0.68rem', padding: '3px 8px' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List in Terminal Well */}
      <div
        className="brutalist-well"
        style={{
          maxHeight: '360px',
          overflowY: 'auto',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            NO EVENTS LOGGED IN BUFFER
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const isTrade = ev.type === 'TRADE';
            const isStorage = ev.type === 'STORAGE';
            const badgeClass = isTrade
              ? 'brutalist-badge--volt'
              : isStorage
              ? 'brutalist-badge--cyan'
              : 'brutalist-badge--purple';

            return (
              <div
                key={ev.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom:
                    index === filteredEvents.length - 1
                      ? 'none'
                      : '1px solid var(--border-color)',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span className={`brutalist-badge ${badgeClass}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    {ev.action}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="text-data" style={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                      {ev.actor ? `${ev.actor.slice(0, 8)}…${ev.actor.slice(-4)}` : ev.subject}
                    </span>
                    {ev.details && (
                      <span className="text-micro" style={{ color: 'var(--text-muted)', textTransform: 'none' }}>
                        {ev.details}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span className="text-data text-micro" style={{ color: 'var(--text-muted)' }}>
                    {ev.time || 'now'}
                  </span>
                  {ev.gas && (
                    <span className="text-data" style={{ color: 'var(--accent-volt)', fontSize: '0.75rem' }}>
                      {ev.gas.toLocaleString()} gas
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
