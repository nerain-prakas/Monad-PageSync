import { useEffect } from 'react';

/**
 * Neo-Brutalist Toast Notifications
 * - Solid slab with 2.5px ink border
 * - Hard offset shadow: 4px 4px 0px #000
 * - Sharp colored status tags
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </aside>
  );
}

function ToastItem({ toast, onDismiss }) {
  const duration = toast.duration || 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const type = toast.type || 'info';
  const badgeClass =
    type === 'success'
      ? 'brutalist-badge--volt'
      : type === 'warning'
      ? 'brutalist-badge--pink'
      : 'brutalist-badge--cyan';

  return (
    <div
      role="status"
      style={{
        pointerEvents: 'auto',
        background: 'var(--bg-surface)',
        border: 'var(--border-thick) solid var(--border-color)',
        boxShadow: 'var(--shadow-hard-lg)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className={`brutalist-badge ${badgeClass}`} style={{ fontSize: '0.65rem' }}>
          {type.toUpperCase()}
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800 }}>
            {toast.title}
          </div>
          {toast.message && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {toast.message}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: '14px',
          padding: '4px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
