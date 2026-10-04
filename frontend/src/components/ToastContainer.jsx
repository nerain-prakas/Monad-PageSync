import { useEffect, useState } from 'react';

/**
 * 6.6 Toast Notifications (Toast)
 * - .glass-panel-raised capsule in top-right
 * - Colored 3px left accent and matching glow
 * - Slide-in motion and thin progress hairline timer
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside aria-label="Notifications" className="toast-container" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 'var(--z-toast)', display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none', maxWidth: '380px', width: 'calc(100vw - 48px)' }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </aside>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4500;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.id, duration, onDismiss]);

  const type = toast.type || 'info';
  const accentColor =
    type === 'success'
      ? 'var(--success)'
      : type === 'warning'
      ? 'var(--warning)'
      : type === 'danger'
      ? 'var(--danger)'
      : 'var(--accent-2)';

  return (
    <div
      role="status"
      className="glass-panel-raised toast-item"
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        padding: '12px 16px',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 24px color-mix(in srgb, ${accentColor} 30%, transparent)`,
        animation: 'toastSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          className="glass-chip__dot"
          style={{
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
        <div>
          <div className="text-heading" style={{ fontSize: '0.875rem' }}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-micro" style={{ color: 'var(--text-secondary)' }}>
              {toast.message}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
        }}
      >
        ✕
      </button>

      {/* Progress hairline */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          width: `${progress}%`,
          background: accentColor,
          opacity: 0.8,
          transition: 'width 0.05s linear',
        }}
      />
    </div>
  );
}
