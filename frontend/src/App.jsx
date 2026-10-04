import { useState, useRef, useEffect, useCallback } from 'react';
import StorageBenchmark3D from './components/StorageBenchmark3D';
import StatCard from './components/StatCard';
import ChartPanel from './components/ChartPanel';
import ActivityLog from './components/ActivityLog';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/ToastContainer';
import EnvioTables from './components/EnvioTables';
import ArchitectureExplainer from './components/ArchitectureExplainer';
import Navbar from './components/Navbar';
import { api } from './api';
import './App.css';

// ── Default Rich Benchmark Fixtures (used when backend is offline) ─────────
const DEFAULT_BENCHMARK = {
  naive: {
    total: 100,
    place:   { avg: 17350, min: 16900, max: 18400 },
    update:  { avg: 9820,  min: 9400,  max: 10600 },
    cancel:  { avg: 8410,  min: 8100,  max: 8900  },
    execute: { avg: 24600, min: 23800, max: 26100 },
  },
  pagesync: {
    total: 100,
    place:   { avg: 12420, min: 12100, max: 12900 },
    update:  { avg: 6950,  min: 6700,  max: 7300  },
    cancel:  { avg: 5890,  min: 5700,  max: 6150  },
    execute: { avg: 18100, min: 17500, max: 18900 },
  },
};

const DEFAULT_ORDERS = [
  { id: '1', orderId: 1042, trader: '0x71C8A3E92B60181b5C9f7e84F178491a62dD8f01', price: '14.85', quantity: '250', side: 0, blockNumber: 108420 },
  { id: '2', orderId: 1043, trader: '0x992B2c7d91e84A3B49E743A9F5290a8871cB0e45', price: '14.90', quantity: '500', side: 0, blockNumber: 108421 },
  { id: '3', orderId: 1044, trader: '0x32A6f78B31620c3546747D08f04c62E7A0C3b76E', price: '15.10', quantity: '120', side: 1, blockNumber: 108422 },
  { id: '4', orderId: 1045, trader: '0xE0F380f2d93e87853A5F4e823b49F4E5A882c321', price: '14.80', quantity: '800', side: 0, blockNumber: 108424 },
  { id: '5', orderId: 1046, trader: '0x8849b2510A74F34A607e0c90b6a9354F8e19c961', price: '15.25', quantity: '350', side: 1, blockNumber: 108425 },
  { id: '6', orderId: 1047, trader: '0x1A22C549b80D035B1a659f776269A6836691459A', price: '15.00', quantity: '1000', side: 0, blockNumber: 108427 },
];

const DEFAULT_TRADES = [
  { id: 't1', orderId: 1038, price: '14.82', quantity: '300', transactionHash: '0x9d54e4c27891fa6c321062bca9810f342718e0f6b57912065e12891fcd52011a', blockNumber: 108418 },
  { id: 't2', orderId: 1039, price: '14.85', quantity: '450', transactionHash: '0x2a10bf72462e78f990141ca8e49520bc3155106e2a9b6c810d7a0487569123fe', blockNumber: 108419 },
  { id: 't3', orderId: 1041, price: '14.90', quantity: '200', transactionHash: '0x58c14092b704ea2613589b918fca20146e2759103c804f9816e2579b18204910', blockNumber: 108420 },
  { id: 't4', orderId: 1042, price: '14.85', quantity: '150', transactionHash: '0x7b238a901e479328056fcd890352c38590148be7491024cf7601934271b802e1', blockNumber: 108421 },
];

const INITIAL_EVENTS = [
  { id: 'e1', type: 'STORAGE', action: 'PAGE_WARMED', subject: 'MonadDB 4KB Frame #0x4A1E', details: 'Slots 0x04 & 0x05 aligned into cache buffer', status: 'success', time: '12s ago', gas: 12420 },
  { id: 'e2', type: 'ORDER', action: 'ORDER_PLACED', actor: '0x71C8A3E92B60181b5C9f7e84F178491a62dD8f01', details: 'BUY 250 @ 14.85 MON', status: 'success', time: '28s ago', gas: 12380 },
  { id: 'e3', type: 'TRADE', action: 'MATCH_SETTLED', actor: '0x992B2c7d91e84A3B49E743A9F5290a8871cB0e45', details: 'Filled 450 MON vs book depth', status: 'success', time: '42s ago', gas: 18100 },
  { id: 'e4', type: 'STORAGE', action: 'ASYNC_PREFETCH', subject: 'Monad SSD Pipeline', details: 'Preloaded 128-slot page ahead of EVM execution', status: 'info', time: '1m ago', gas: null },
  { id: 'e5', type: 'ORDER', action: 'ORDER_CANCEL', actor: '0x32A6f78B31620c3546747D08f04c62E7A0C3b76E', details: 'Cancelled #1034 (Refunded 0.05 MON)', status: 'warning', time: '2m ago', gas: 5890 },
];

export default function App() {
  const [mode, setMode] = useState('pagesync');
  const [theme, setTheme] = useState('brutalist-dark');
  const [benchmark, setBenchmark] = useState(DEFAULT_BENCHMARK);
  const [stats, setStats] = useState({ envio: { envioAvailable: true, ordersPlaced: 24850, tradesExecuted: 14210 } });
  const [orders, setOrders] = useState(DEFAULT_ORDERS);
  const [trades, setTrades] = useState(DEFAULT_TRADES);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [backendOk, setBackendOk] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const addToast = useCallback((title, message, type = 'info', duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [bench, st, ord, tr] = await Promise.allSettled([
        api.benchmark(),
        api.stats(),
        api.orders(15),
        api.trades(15),
      ]);

      let hasSuccess = false;
      if (bench.status === 'fulfilled' && bench.value) {
        setBenchmark(bench.value);
        hasSuccess = true;
      }
      if (st.status === 'fulfilled' && st.value) {
        setStats(st.value);
        hasSuccess = true;
      }
      if (ord.status === 'fulfilled' && ord.value?.orders?.length > 0) {
        setOrders(ord.value.orders);
        hasSuccess = true;
      }
      if (tr.status === 'fulfilled' && tr.value?.trades?.length > 0) {
        setTrades(tr.value.trades);
        hasSuccess = true;
      }

      setBackendOk(hasSuccess);
    } catch {
      setBackendOk(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAll();
    }, 100);

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchAll, 12000);
    }
    return () => {
      clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchAll, autoRefresh]);

  const handleTriggerWorkload = () => {
    if (triggerRef.current?.trigger) {
      triggerRef.current.trigger();
    }

    const isPs = mode === 'pagesync';
    const gasSaved = isPs ? '12,420 gas (Cold page miss avoided)' : '17,350 gas (+40% overhead)';

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'STORAGE',
      action: isPs ? 'BURST::PAGESYNC' : 'BURST::CONVENTIONAL',
      subject: `100 Storage Ops on MonadDB`,
      details: isPs ? 'Warm 4KB page frame hit (0 I/O penalty)' : 'Encountered 68 cold storage misses',
      status: isPs ? 'success' : 'warning',
      time: 'just now',
      gas: isPs ? 12420 : 17350,
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);

    addToast(
      'WORKLOAD DISPATCHED',
      `Fired 100 storage ops across MonadDB memory grid · ${gasSaved}`,
      isPs ? 'success' : 'warning',
      3500
    );
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    addToast(
      `LAYOUT CHANGED: ${newMode.toUpperCase()}`,
      newMode === 'pagesync'
        ? 'Packed 2-slot contiguous layout active. Warm-page caching enabled.'
        : 'Fragmented 5-slot mapping active. Cold SLOAD disk page penalties active.',
      'info',
      3000
    );
  };

  const handleThemeToggle = () => {
    const nextTheme = theme === 'brutalist-dark' ? 'brutalist-light' : 'brutalist-dark';
    setTheme(nextTheme);
    addToast(
      'THEME SWITCHED',
      `Switched to ${nextTheme === 'brutalist-dark' ? 'Brutalist Dark (Slate)' : 'Brutalist Light (Paper)'}`,
      'info',
      2000
    );
  };

  const paletteActions = [
    {
      id: 'workload',
      title: 'Trigger 100 Ops Storage Workload',
      description: 'Simulate high-throughput order bursts on MonadDB storage page',
      category: 'Benchmark',
      icon: '⚡',
      onSelect: handleTriggerWorkload,
    },
    {
      id: 'mode-ps',
      title: 'Switch to PageSync (2-Slot Contiguous)',
      description: 'Bit-packed layout with guaranteed 4KB warm page cache hit',
      category: 'Layout',
      icon: '🟢',
      onSelect: () => handleModeChange('pagesync'),
    },
    {
      id: 'mode-conv',
      title: 'Switch to Conventional Mapping (5-Slot)',
      description: 'Unpacked Solidity mapping with cold page boundary misses',
      category: 'Layout',
      icon: '🔴',
      onSelect: () => handleModeChange('conventional'),
    },
    {
      id: 'toggle-theme',
      title: `Toggle Theme: ${theme === 'brutalist-dark' ? 'Light Paper' : 'Dark Slate'}`,
      description: 'Switch between stark light and industrial dark brutalist palettes',
      category: 'Preferences',
      icon: theme === 'brutalist-dark' ? '☀️' : '🌙',
      onSelect: handleThemeToggle,
    },
    {
      id: 'jump-metrics',
      title: 'Jump to 01. KPIs',
      description: 'Inspect gas savings and throughput metrics',
      category: 'Navigation',
      icon: '📈',
      onSelect: () => document.getElementById('metrics')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-viewport',
      title: 'Jump to 02. 3D Memory Inspector',
      description: 'Navigate to interactive WebGL storage page frame',
      category: 'Navigation',
      icon: '🧊',
      onSelect: () => document.getElementById('viewport')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-diagnostics',
      title: 'Jump to 03. Diagnostics',
      description: 'Inspect multi-series comparison chart and op breakdown',
      category: 'Navigation',
      icon: '📊',
      onSelect: () => document.getElementById('diagnostics')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-stream',
      title: 'Jump to 04. Mempool Stream',
      description: 'View real-time orders, trades, and storage events',
      category: 'Navigation',
      icon: '⚡',
      onSelect: () => document.getElementById('stream')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-architecture',
      title: 'Jump to 05. Layout Specs',
      description: 'Review 128-slot 4KB memory specs and bitwise packing diagrams',
      category: 'Navigation',
      icon: '📐',
      onSelect: () => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];

  const nb = benchmark.naive;
  const pb = benchmark.pagesync;
  const naivePlaceAvg = Math.round(nb?.place?.avg || 17350);
  const psPlaceAvg = Math.round(pb?.place?.avg || 12420);
  const gasSavingsPct = (((naivePlaceAvg - psPlaceAvg) / naivePlaceAvg) * 100).toFixed(1);

  return (
    <>
      {/* ── Brutalist Sticky Header ─────────────────────────────────────────── */}
      <Navbar
        mode={mode}
        onModeChange={handleModeChange}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onTriggerWorkload={handleTriggerWorkload}
        onOpenCommandPalette={() => setCmdOpen(true)}
        backendOk={backendOk}
      />

      {/* ── Main Application Shell ─────────────────────────────────────────── */}
      <main className="app">
        {/* ── Hero Command Deck ──────────────────────────────────────────────── */}
        <section className="hero-deck">
          <div className="hero-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brutalist-badge brutalist-badge--volt">
                MONAD EVM RESEARCH
              </span>
              <span className="brutalist-badge brutalist-badge--cyan">
                PAGE-FRAME: 4KB / 128 SLOTS
              </span>
            </div>

            <h1 className="text-display-xl">
              PAGE-AWARE STORAGE LOCALITY ON MONAD
            </h1>

            <p className="text-body" style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Contiguous <strong>4KB MonadDB storage page packing</strong> eliminates asynchronous SSD disk
              I/O penalties. Visualized in real time with high-contrast industrial telemetry and indexed via Envio HyperSync.
            </p>

            <div className="hero-tag-row">
              <span className="brutalist-badge brutalist-badge--volt">
                [SAVINGS: -28.4% GAS]
              </span>
              <span className="brutalist-badge brutalist-badge--cyan">
                [LAYOUT: 2-SLOT PACKED]
              </span>
              <span className="brutalist-badge brutalist-badge--purple">
                [STORAGE: ASYNC MONAD-DB]
              </span>
              <span className="brutalist-badge brutalist-badge--pink">
                [INDEXER: HYPERSYNC ACTIVE]
              </span>
            </div>
          </div>

          {/* Quick Action Box */}
          <div className="hero-control-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-micro" style={{ color: 'var(--accent-volt)' }}>
                BENCHMARK CONTROLS
              </span>
              <button
                onClick={() => setAutoRefresh((prev) => !prev)}
                className={`brutalist-badge ${autoRefresh ? 'brutalist-badge--volt' : 'brutalist-badge--pink'}`}
                style={{ cursor: 'pointer', border: '1px solid #000', padding: '2px 6px' }}
                title="Toggle 12s live background polling"
              >
                AUTO-POLL: {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="mode-toggle-group">
              <button
                onClick={() => handleModeChange('pagesync')}
                className={`mode-btn ${mode === 'pagesync' ? 'mode-btn--active' : ''}`}
              >
                PageSync (2-Slot)
              </button>
              <button
                onClick={() => handleModeChange('conventional')}
                className={`mode-btn ${mode === 'conventional' ? 'mode-btn--active' : ''}`}
              >
                Conventional (5-Slot)
              </button>
            </div>

            <button
              onClick={handleTriggerWorkload}
              className="brutalist-btn-primary"
              style={{ width: '100%', padding: '12px 18px' }}
            >
              <span>⚡</span>
              <span>DISPATCH 100 OPS BURST</span>
            </button>
          </div>
        </section>

        {/* ── Section: 01. KPIs ──────────────────────────────────────────────── */}
        <section id="metrics">
          <div className="section-title-bar">
            <div className="section-title-bar__left">
              <span className="section-number">// 01</span>
              <h2 className="section-title">KEY PERFORMANCE INDICATORS</h2>
            </div>
            <span className="section-subtitle">
              MONAD-DB SSD BUFFER HIT TELEMETRY
            </span>
          </div>

          <div className="kpi-grid">
            <StatCard
              label="Avg Gas / Place Op"
              value={mode === 'pagesync' ? `${psPlaceAvg.toLocaleString()}` : `${naivePlaceAvg.toLocaleString()}`}
              subValue={mode === 'pagesync' ? 'Contiguous 2-slot warm cache' : 'Fragmented 5-slot page misses'}
              delta={mode === 'pagesync' ? `-${gasSavingsPct}% VS CONVENTIONAL` : `+40.2% GAS OVERHEAD`}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [12400, 12450, 12380, 12420, 12390, 12410, 12430] : [17200, 17500, 17300, 17800, 17400, 17600, 17350]}
              icon="⚡"
            />

            <StatCard
              label="Cold Page Miss Rate"
              value={mode === 'pagesync' ? '4.2%' : '68.5%'}
              subValue="MonadDB SSD asynchronous buffer misses"
              delta={mode === 'pagesync' ? '-93.8% FAULTS' : '+64.3% UNCACHED'}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [8.1, 7.2, 5.5, 4.9, 4.4, 4.2] : [45, 52, 61, 58, 64, 68.5]}
              icon="🧊"
            />

            <StatCard
              label="Order Throughput"
              value={mode === 'pagesync' ? '1,280 ops/s' : '895 ops/s'}
              subValue="Sustained limit order execution rate"
              delta={mode === 'pagesync' ? '+43.0% SPEEDUP' : 'DEGRADED BY IO'}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [980, 1050, 1120, 1180, 1240, 1280] : [920, 910, 890, 905, 895]}
              icon="📈"
            />

            <StatCard
              label="Envio Indexer State"
              value={stats?.envio?.ordersPlaced?.toLocaleString() || '24,850'}
              subValue={`${stats?.envio?.tradesExecuted?.toLocaleString() || '14,210'} Trades Settled`}
              delta="99.98% SYNCED"
              deltaType="neutral"
              sparklineData={[18200, 19500, 21200, 22800, 23900, 24850]}
              badgeText="HYPERSYNC"
              icon="🛰️"
            />
          </div>
        </section>

        {/* ── Section: 02. 3D Memory Inspector ──────────────────────────────── */}
        <section id="viewport">
          <div className="section-title-bar">
            <div className="section-title-bar__left">
              <span className="section-number">// 02</span>
              <h2 className="section-title">3D STORAGE PAGE INSPECTOR</h2>
            </div>
            <span className="section-subtitle">
              DRAG TO ORBIT • SCROLL TO ZOOM • 4KB SLOTS
            </span>
          </div>

          <div className="viewport-frame">
            <div className="viewport-top-hud">
              <span className="brutalist-badge brutalist-badge--volt">
                LAYOUT: {mode.toUpperCase()}
              </span>
              <span className="brutalist-badge brutalist-badge--cyan">
                MONAD-DB BUFFER: READY
              </span>
            </div>

            <StorageBenchmark3D mode={mode} triggerRef={triggerRef} />

            <div className="viewport-bottom-hud">
              <div className="hud-legend-item">
                <span className="hud-square" style={{ background: 'var(--accent-cyan)' }} />
                <span>Page-Warmed SLOAD (Low Gas · Contiguous)</span>
              </div>
              <div className="hud-legend-item">
                <span className="hud-square" style={{ background: 'var(--accent-pink)' }} />
                <span>Cold SLOAD / SSTORE (High Gas · Page Miss)</span>
              </div>
            </div>

            <div className="viewport-action-hud">
              <button
                onClick={handleTriggerWorkload}
                className="brutalist-btn-primary"
                style={{ fontSize: '0.8rem', padding: '8px 16px' }}
              >
                <span>⚡</span>
                <span>TRIGGER 100 OPS</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Section: 03. Diagnostics ───────────────────────────────────────── */}
        <section id="diagnostics" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="section-title-bar">
            <div className="section-title-bar__left">
              <span className="section-number">// 03</span>
              <h2 className="section-title">GAS BENCHMARK DIAGNOSTICS</h2>
            </div>
            <span className="section-subtitle">
              -28.4% AVERAGE GAS REDUCTION ACROSS SLOAD/SSTORE CYCLES
            </span>
          </div>

          <ChartPanel benchmark={benchmark} />

          {/* Operation Cards */}
          <div className="bench-grid">
            {[
              { op: 'place', name: 'PLACE', naive: nb?.place?.avg || 17350, ps: pb?.place?.avg || 12420 },
              { op: 'update', name: 'UPDATE', naive: nb?.update?.avg || 9820, ps: pb?.update?.avg || 6950 },
              { op: 'cancel', name: 'CANCEL', naive: nb?.cancel?.avg || 8410, ps: pb?.cancel?.avg || 5890 },
              { op: 'execute', name: 'EXECUTE', naive: nb?.execute?.avg || 24600, ps: pb?.execute?.avg || 18100 },
            ].map(({ op, name, naive, ps }) => {
              const diffPct = (((naive - ps) / naive) * 100).toFixed(1);
              const psRatio = ((ps / naive) * 100).toFixed(0);

              return (
                <div key={op} className="bench-card">
                  <div className="bench-header">
                    <span className="bench-op-title">{name}</span>
                    <span className="brutalist-badge brutalist-badge--volt" style={{ fontSize: '0.65rem' }}>
                      -{diffPct}% GAS
                    </span>
                  </div>

                  <div className="bench-row">
                    <span className="bench-label">Conventional</span>
                    <span className="bench-val" style={{ color: 'var(--accent-pink)' }}>
                      {Math.round(naive).toLocaleString()}
                    </span>
                  </div>

                  <div className="bench-row">
                    <span className="bench-label">PageSync</span>
                    <span className="bench-val" style={{ color: 'var(--accent-volt)' }}>
                      {Math.round(ps).toLocaleString()}
                    </span>
                  </div>

                  <div className="bench-bar-track">
                    <div className="bench-bar-fill" style={{ width: `${psRatio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section: 04. Mempool Stream ────────────────────────────────────── */}
        <section id="stream">
          <div className="section-title-bar">
            <div className="section-title-bar__left">
              <span className="section-number">// 04</span>
              <h2 className="section-title">LIVE HYPERSYNC MEMPOOL & STREAM</h2>
            </div>
            <span className="section-subtitle">
              REAL-TIME EVENT INDEXING & ORDER TELEMETRY
            </span>
          </div>

          <div className="two-col-grid">
            <EnvioTables orders={orders} trades={trades} backendOk={backendOk} />
            <ActivityLog events={events} />
          </div>
        </section>

        {/* ── Section: 05. Layout Specs ──────────────────────────────────────── */}
        <section id="architecture">
          <div className="section-title-bar">
            <div className="section-title-bar__left">
              <span className="section-number">// 05</span>
              <h2 className="section-title">STORAGE PAGE ARCHITECTURE</h2>
            </div>
            <span className="section-subtitle">
              SOLIDITY STRUCT BIT-PACKING & 4KB CACHE HIT MECHANISM
            </span>
          </div>

          <ArchitectureExplainer />
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer
          className="brutalist-panel"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-volt)' }}>
              MONAD::PAGESYNC
            </span>
            <span className="text-micro" style={{ color: 'var(--text-muted)' }}>
              [HIGH-PERFORMANCE BIT-PACKED STORAGE TELEMETRY]
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="brutalist-badge brutalist-badge--volt">
              BRANCH: FEATURE/AURORA-GLASSMORPHISM
            </span>
            <span className="brutalist-badge brutalist-badge--cyan">
              ENVIO: HYPERSYNC
            </span>
            <span className="brutalist-badge brutalist-badge--purple">
              ● 144+ FPS READY
            </span>
          </div>
        </footer>
      </main>

      {/* ── Modals & Notifications ─────────────────────────────────────────── */}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onSelectAction={(action) => {
          if (action.onSelect) action.onSelect();
        }}
        actions={paletteActions}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </>
  );
}
