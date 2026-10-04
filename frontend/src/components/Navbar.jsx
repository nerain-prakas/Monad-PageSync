import { useState, useEffect } from 'react';

/**
 * Neo-Brutalist Sticky Dock Header
 * - Solid opaque panel with 3px ink border
 * - Hard offset shadow: 6px 6px 0px #000
 * - Sharp tactical buttons with mechanical click response
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
  const [activeSection, setActiveSection] = useState('metrics');

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sections = ['metrics', 'viewport', 'diagnostics', 'stream', 'architecture'];
          for (const id of sections) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 200 && rect.bottom >= 100) {
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
    <header className="brutalist-nav">
      {/* Brand Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="brand-badge">M</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '1.05rem',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              MONAD::PAGESYNC
            </span>
            <span
              className={`brutalist-badge ${backendOk ? 'brutalist-badge--volt' : 'brutalist-badge--pink'}`}
              style={{ fontSize: '0.65rem' }}
            >
              {backendOk ? '● ONLINE' : '● DEMO MODE'}
            </span>
          </div>
          <span className="text-micro" style={{ color: 'var(--accent-cyan)' }}>
            PAGE-AWARE STORAGE LOCALITY BENCHMARK
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="nav-links">
        {[
          { id: 'metrics', label: '01. KPIs' },
          { id: 'viewport', label: '02. 3D MEMORY' },
          { id: 'diagnostics', label: '03. DIAGNOSTICS' },
          { id: 'stream', label: '04. STREAM' },
          { id: 'architecture', label: '05. SPECS' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={`nav-link-btn ${activeSection === item.id ? 'nav-link-btn--active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Action Deck */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Mode Toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-well)',
            border: '1.5px solid var(--border-color)',
            padding: '2px',
          }}
        >
          <button
            onClick={() => onModeChange('pagesync')}
            className={`nav-link-btn ${mode === 'pagesync' ? 'nav-link-btn--active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
          >
            PageSync (2-Slot)
          </button>
          <button
            onClick={() => onModeChange('conventional')}
            className={`nav-link-btn ${mode === 'conventional' ? 'nav-link-btn--active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
          >
            Conventional (5-Slot)
          </button>
        </div>

        {/* Command Palette Trigger */}
        <button onClick={onOpenCommandPalette} className="brutalist-btn" style={{ padding: '6px 12px' }}>
          <span>⌕</span>
          <span>CMD+K</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className="brutalist-btn"
          style={{ padding: '6px 10px' }}
          title="Toggle Brutalist Theme"
        >
          {theme === 'brutalist-dark' ? '☀️' : '🌙'}
        </button>

        {/* Workload Trigger */}
        <button onClick={onTriggerWorkload} className="brutalist-btn-primary" style={{ padding: '8px 16px' }}>
          <span>⚡</span>
          <span>TRIGGER 100 OPS</span>
        </button>
      </div>
    </header>
  );
}
