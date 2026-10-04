import { useState, useEffect, useRef } from 'react';

/**
 * Neo-Brutalist Command Palette Modal
 * - Solid slab with 3px ink border & hard offset shadow
 * - High-contrast search input with sharp corners
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
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filtered = actions.filter((act) => {
    const q = query.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      (act.category && act.category.toLowerCase().includes(q)) ||
      (act.description && act.description.toLowerCase().includes(q))
    );
  });

  const categories = Array.from(new Set(filtered.map((a) => a.category || 'GENERAL')));

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'clamp(60px, 12vh, 120px)',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <div
        className="brutalist-panel-raised"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '16px',
          border: '3px solid #000',
          boxShadow: '8px 8px 0px #000',
        }}
      >
        {/* Search Well */}
        <div
          className="brutalist-well"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            marginBottom: '12px',
          }}
        >
          <span style={{ color: 'var(--accent-volt)', fontWeight: 800 }}>&gt;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type command or filter (e.g. 'workload', 'mode')…"
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
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              fontWeight: 700,
              width: '100%',
            }}
          />
          <kbd
            className="brutalist-badge"
            style={{ fontSize: '0.65rem', padding: '1px 5px', color: 'var(--text-muted)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              NO COMMANDS MATCHING &ldquo;{query}&rdquo;
            </div>
          ) : (
            categories.map((cat) => {
              const catActions = filtered.filter((a) => (a.category || 'GENERAL') === cat);
              if (catActions.length === 0) return null;

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div className="text-micro" style={{ color: 'var(--accent-volt)', padding: '2px 6px' }}>
                    // {cat}
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-purple)' : 'transparent',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
                          border: isSelected ? '1.5px solid #000' : '1.5px solid transparent',
                          boxShadow: isSelected ? '2px 2px 0px #000' : 'none',
                          transition: 'all 0.05s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{act.icon || '■'}</span>
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700 }}>
                              {act.title}
                            </div>
                            {act.description && (
                              <div style={{ fontSize: '0.72rem', opacity: 0.8, fontFamily: 'var(--font-ui)' }}>
                                {act.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
