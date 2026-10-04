import { useState, useEffect, useRef } from 'react';

/**
 * 6.5 Command Palette / Modal (CommandPalette)
 * - Centered .glass-panel-overlay over a scrim with blur(6px)
 * - Large .glass-well input with subtle focus ring
 * - Results grouped with .text-micro headings
 * - glassRise entrance animation
 */
export default function CommandPalette({
  isOpen,
  onClose,
  onSelectAction,
  actions = [],
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Filter actions
  const filtered = actions.filter((act) => {
    const q = query.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      (act.category && act.category.toLowerCase().includes(q)) ||
      (act.description && act.description.toLowerCase().includes(q))
    );
  });

  // Group by category
  const categories = Array.from(new Set(filtered.map((a) => a.category || 'General')));

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelectAction(filtered[selectedIndex]);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelectAction]);

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 6, 16, 0.65)',
        WebkitBackdropFilter: 'blur(8px)',
        backdropFilter: 'blur(8px)',
        zIndex: 'var(--z-overlay)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'clamp(60px, 12vh, 120px)',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <div
        className="glass-panel-overlay glass-enter command-palette-modal"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 'var(--space-4)',
        }}
      >
        {/* Search Input Well */}
        <div
          className="glass-well"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: 'var(--space-3)',
          }}
        >
          <span style={{ color: 'var(--accent-2)', fontSize: '1.1rem' }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search action… (e.g. 'workload', 'mode', 'theme')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.9375rem',
              width: '100%',
            }}
          />
          <kbd
            className="text-data"
            style={{
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '4px',
          }}
        >
          {filtered.length === 0 ? (
            <div
              className="text-body"
              style={{
                textAlign: 'center',
                padding: 'var(--space-5)',
                color: 'var(--text-muted)',
              }}
            >
              No matching actions found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            categories.map((cat) => {
              const catActions = filtered.filter((a) => (a.category || 'General') === cat);
              if (catActions.length === 0) return null;

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    className="text-micro"
                    style={{
                      padding: '4px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--accent-2)',
                    }}
                  >
                    {cat}
                  </div>
                  {catActions.map((act) => {
                    flatIndex += 1;
                    const isSelected = flatIndex === selectedIndex;
                    const currentIndex = flatIndex;

                    return (
                      <div
                        key={act.id}
                        onClick={() => {
                          onSelectAction(act);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`command-item ${isSelected ? 'command-item--selected' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--glass-2)' : 'transparent',
                          border: isSelected ? '1px solid var(--glass-border-strong)' : '1px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.1rem' }}>{act.icon || '✦'}</span>
                          <div>
                            <div className="text-heading" style={{ fontSize: '0.875rem' }}>
                              {act.title}
                            </div>
                            {act.description && (
                              <div className="text-micro" style={{ color: 'var(--text-muted)' }}>
                                {act.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {act.shortcut && (
                          <span
                            className="text-data"
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              padding: '2px 6px',
                              background: 'var(--glass-1)',
                              borderRadius: '4px',
                            }}
                          >
                            {act.shortcut}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
          }}
          className="text-micro"
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="text-data">Monad PageSync v1.0</span>
        </div>
      </div>
    </div>
  );
}
