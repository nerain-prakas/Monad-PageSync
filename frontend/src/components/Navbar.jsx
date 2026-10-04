import { useState, useEffect } from 'react';

/**
 * 6.2 Glass Navigation (Navbar & Floating Header)
 * - Full-width floating glass panel with --radius-lg
 * - Floating 16px from viewport edges
 * - Active item gets --glass-2, --glass-border-strong, and 3px gradient bar
 * - Theme toggle, Command palette trigger, and 100 Ops workload button
 */
export default function Navbar({
  mode,
  onModeChange,
  theme,
  onThemeToggle,
  onTriggerWorkload,
  onOpenCommandPalette,
  backendOk,
}) {
  const [activeSection, setActiveSection] = useState('viewport');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);

          const sections = ['metrics', 'viewport', 'diagnostics', 'stream', 'architecture'];
          for (const id of sections) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 200 && rect.bottom >= 120) {
                setActiveSection(id);
                break;
              }
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <header
      className={`glass-panel floating-navbar ${isScrolled ? 'floating-navbar--scrolled' : ''}`}
      style={{
        position: 'sticky',
        top: '16px',
        zIndex: 'var(--z-nav)',
        margin: '0 auto var(--space-4) auto',
        maxWidth: '1280px',
        width: 'calc(100% - 32px)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        borderRadius: 'var(--radius-lg)',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Brand & Connection Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          className="brand-logo"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
            display: 'grid',
            placeItems: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            boxShadow: '0 0 16px rgba(139, 123, 255, 0.5)',
            userSelect: 'none',
          }}
        >
          M
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="text-heading"
              style={{
                fontSize: '1rem',
                letterSpacing: '-0.01em',
                fontWeight: 700,
              }}
            >
              MONAD-PAGESYNC
            </span>
            <span
              className="glass-chip"
              style={{
                fontSize: '0.68rem',
                padding: '1px 8px',
                color: backendOk ? 'var(--success)' : 'var(--warning)',
              }}
            >
              <span
                className={`glass-chip__dot ${backendOk ? 'glass-chip__dot--live' : 'glass-chip__dot--warning'}`}
              />
              {backendOk ? 'NODE ONLINE' : 'DEMO MODE'}
            </span>
          </div>
          <span
            className="text-micro"
            style={{
              color: 'var(--accent-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              letterSpacing: '0.04em',
            }}
          >
            PAGE-AWARE STORAGE LOCALITY BENCHMARK
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav
        className="nav-links"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {[
          { id: 'viewport', label: '3D Memory' },
          { id: 'metrics', label: 'KPIs' },
          { id: 'diagnostics', label: 'Diagnostics' },
          { id: 'stream', label: 'Envio Indexer' },
          { id: 'architecture', label: 'Layout Specs' },
        ].map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`nav-link-btn ${isActive ? 'nav-link-btn--active' : ''}`}
              style={{
                background: isActive ? 'var(--glass-2)' : 'transparent',
                border: isActive ? '1px solid var(--glass-border-strong)' : '1px solid transparent',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-ui)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '14px',
                    height: '2px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                  }}
                />
              )}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Mode Selector Pill */}
        <div
          className="glass-well"
          style={{
            padding: '3px',
            display: 'inline-flex',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <button
            onClick={() => onModeChange('pagesync')}
            className={`chart-mode-pill ${mode === 'pagesync' ? 'chart-mode-pill--active' : ''}`}
            title="PageSync Contiguous 2-Slot Layout"
          >
            PageSync
          </button>
          <button
            onClick={() => onModeChange('conventional')}
            className={`chart-mode-pill ${mode === 'conventional' ? 'chart-mode-pill--active' : ''}`}
            title="Conventional 5-Slot Fragmented Mapping"
          >
            Conventional
          </button>
        </div>

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="glass-button"
          style={{ padding: '7px 12px', fontSize: '0.8rem' }}
          title="Open Command Palette (Cmd/Ctrl + K)"
        >
          <span>⌕</span>
          <kbd
            className="text-data"
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              background: 'var(--glass-2)',
              padding: '1px 5px',
              borderRadius: '3px',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={onThemeToggle}
          className="glass-button"
          style={{ padding: '7px 12px', fontSize: '0.85rem' }}
          title={`Switch to ${theme === 'aurora' ? 'Aurora Light' : 'Aurora Dark'} Theme`}
        >
          {theme === 'aurora' ? '☀️' : '🌙'}
        </button>

        {/* Workload Trigger Button */}
        <button
          onClick={onTriggerWorkload}
          className="glass-button-primary"
          style={{ padding: '8px 18px', fontSize: '0.8125rem' }}
        >
          <span>⚡</span>
          <span>100 Ops Workload</span>
        </button>
      </div>
    </header>
  );
}
