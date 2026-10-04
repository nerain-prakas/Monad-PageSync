import { useState } from 'react';

/**
 * 6.4 Activity Feed (ActivityLog)
 * - Recessed .glass-well container with rows separated by 1px rgba(255,255,255,0.08) dividers
 * - Timestamps in mono --text-muted
 * - Actor names / addresses in --text-primary
 * - Small .glass-chip__dot (success / warning / danger)
 * - Header with pulsing live chip
 */
export default function ActivityLog({ events = [] }) {
  const [filter, setFilter] = useState('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    return ev.type === filter;
  });

  return (
    <div className="glass-panel activity-feed-panel" style={{ padding: 'var(--space-5)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="text-heading">Event Stream & Mempool</h3>
          <span className="glass-chip">
            <span className="glass-chip__dot glass-chip__dot--live" />
            LIVE
          </span>
        </div>

        {/* Filter Pills */}
        <div className="chip-group" style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ORDER', 'TRADE', 'STORAGE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip ${filter === f ? 'active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '4px 12px' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List in .glass-well */}
      <div
        className="glass-well"
        style={{
          maxHeight: '340px',
          overflowY: 'auto',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div
            className="text-body"
            style={{
              padding: 'var(--space-5)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            No events recorded in this stream filter.
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const dotType =
              ev.status === 'success' || ev.type === 'TRADE'
                ? 'var(--success)'
                : ev.status === 'warning'
                ? 'var(--warning)'
                : ev.status === 'error'
                ? 'var(--danger)'
                : 'var(--accent-2)';

            return (
              <div
                key={ev.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom:
                    index === filteredEvents.length - 1
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  gap: '12px',
                  transition: 'background 0.15s ease',
                }}
                className="activity-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span
                    className="glass-chip__dot"
                    style={{
                      background: dotType,
                      boxShadow: `0 0 8px ${dotType}`,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className="text-micro"
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          background: 'var(--glass-2)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {ev.action}
                      </span>
                      <span className="text-data text-micro" style={{ color: 'var(--text-secondary)' }}>
                        {ev.actor ? `${ev.actor.slice(0, 8)}…${ev.actor.slice(-4)}` : ev.subject}
                      </span>
                    </div>
                    {ev.details && (
                      <span className="text-micro" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        {ev.details}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <span className="text-data text-micro" style={{ color: 'var(--text-muted)' }}>
                    {ev.time || 'just now'}
                  </span>
                  {ev.gas && (
                    <span
                      className="text-data text-micro"
                      style={{
                        color: ev.gas < 15000 ? 'var(--success)' : 'var(--warning)',
                        marginTop: '2px',
                      }}
                    >
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
