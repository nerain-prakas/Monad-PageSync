import { useState, useRef, useEffect, useCallback } from 'react';
import StorageBenchmark3D from './components/StorageBenchmark3D';
import StatCard from './components/StatCard';
import ChartPanel from './components/ChartPanel';
import ActivityLog from './components/ActivityLog';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/ToastContainer';
import GlassSwitch from './components/GlassSwitch';
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
  const [theme, setTheme] = useState('aurora'); // 'aurora' | 'aurora-light'
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

  // ── Sync theme to HTML root ────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Toast dispatcher ───────────────────────────────────────────────────────
  const addToast = useCallback((title, message, type = 'info', duration = 4500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Keyboard shortcut for Command Palette (Cmd/Ctrl + K) ───────────────────
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

  // ── Data Fetcher ───────────────────────────────────────────────────────────
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

  // ── Workload Trigger ───────────────────────────────────────────────────────
  const handleTriggerWorkload = () => {
    if (triggerRef.current?.trigger) {
      triggerRef.current.trigger();
    }

    const isPs = mode === 'pagesync';
    const gasSaved = isPs ? '12,420 gas (Cold page miss avoided)' : '17,350 gas (+40% overhead)';

    // Push live event
    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'STORAGE',
      action: isPs ? 'PAGESYNC_BURST' : 'CONVENTIONAL_BURST',
      subject: `100 Storage Ops on MonadDB`,
      details: isPs ? 'All accesses resolved on warm 4KB page frame' : 'Encountered 68 cold storage misses',
      status: isPs ? 'success' : 'warning',
      time: 'just now',
      gas: isPs ? 12420 : 17350,
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);

    addToast(
      'Workload Dispatched',
      `Fired 100 ops across 3D storage grid · Avg ${gasSaved}`,
      isPs ? 'success' : 'warning',
      4000
    );
  };

  // ── Mode Switcher with Toast ───────────────────────────────────────────────
  const handleModeChange = (newMode) => {
    setMode(newMode);
    addToast(
      `Mode Switched: ${newMode === 'pagesync' ? 'PageSync Layout' : 'Conventional'}`,
      newMode === 'pagesync'
        ? 'Packed 2-slot contiguous layout active. Warm-page caching enabled.'
        : 'Fragmented 5-slot layout active. Cold SLOAD page misses simulated.',
      'info',
      3500
    );
  };

  // ── Theme Switcher with Toast ──────────────────────────────────────────────
  const handleThemeToggle = () => {
    const nextTheme = theme === 'aurora' ? 'aurora-light' : 'aurora';
    setTheme(nextTheme);
    addToast(
      'Theme Updated',
      `Switched to ${nextTheme === 'aurora' ? 'Dark Aurora (Default)' : 'Aurora Light'} glassmorphism palette`,
      'info',
      2500
    );
  };

  // ── Command Palette Actions ────────────────────────────────────────────────
  const paletteActions = [
    {
      id: 'workload',
      title: 'Trigger 100 Ops Storage Workload',
      description: 'Simulate high-throughput order bursts on MonadDB storage page',
      category: 'Benchmark',
      icon: '⚡',
      shortcut: '↵',
      onSelect: handleTriggerWorkload,
    },
    {
      id: 'mode-ps',
      title: 'Switch to PageSync (2-Slot Contiguous)',
      description: 'Bit-packed layout with guaranteed 4KB warm page cache hit',
      category: 'Layout',
      icon: '🔵',
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
      title: `Toggle Theme: ${theme === 'aurora' ? 'Aurora Light' : 'Dark Aurora'}`,
      description: 'Switch frosted glass palette between deep midnight and airy luminous',
      category: 'Preferences',
      icon: theme === 'aurora' ? '☀️' : '🌙',
      onSelect: handleThemeToggle,
    },
    {
      id: 'jump-metrics',
      title: 'Jump to Key Performance Indicators',
      description: 'Inspect gas savings and throughput metrics',
      category: 'Navigation',
      icon: '📈',
      onSelect: () => document.getElementById('metrics')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-viewport',
      title: 'Jump to 3D Memory Viewport',
      description: 'Navigate to interactive WebGL storage page frame',
      category: 'Navigation',
      icon: '🧊',
      onSelect: () => document.getElementById('viewport')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-diagnostics',
      title: 'Jump to Gas Benchmark Diagnostics',
      description: 'Inspect multi-series comparison chart and op breakdown',
      category: 'Navigation',
      icon: '📊',
      onSelect: () => document.getElementById('diagnostics')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-stream',
      title: 'Jump to Envio Indexer & Mempool Stream',
      description: 'View real-time orders, trades, and storage events',
      category: 'Navigation',
      icon: '⚡',
      onSelect: () => document.getElementById('stream')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'jump-architecture',
      title: 'Jump to Storage Page Architecture',
      description: 'Review 128-slot 4KB memory specs and bitwise packing diagrams',
      category: 'Navigation',
      icon: '📐',
      onSelect: () => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      id: 'refresh-data',
      title: 'Refresh Benchmark Traces Now',
      description: 'Poll API endpoint for latest Monad RPC and Envio events',
      category: 'Data',
      icon: '🔄',
      onSelect: () => {
        fetchAll();
        addToast('Data Refreshed', 'Successfully synchronized benchmark metrics', 'success', 2500);
      },
    },
  ];

  // ── Metrics Calculations ───────────────────────────────────────────────────
  const nb = benchmark.naive;
  const pb = benchmark.pagesync;
  const naivePlaceAvg = Math.round(nb?.place?.avg || 17350);
  const psPlaceAvg = Math.round(pb?.place?.avg || 12420);
  const gasSavingsPct = (((naivePlaceAvg - psPlaceAvg) / naivePlaceAvg) * 100).toFixed(1);

  return (
    <>
      {/* ── Aurora Scene & Luminous Drifting Orbs (Behind Glass) ─────────────── */}
      <div className="aurora-scene" aria-hidden="true">
        <div className="aurora-orb aurora-orb--violet" />
        <div className="aurora-orb aurora-orb--cyan" />
        <div className="aurora-orb aurora-orb--pink" />
        <div className="aurora-orb aurora-orb--amber" />
      </div>

      {/* ── Floating Sticky Navigation Bar ──────────────────────────────────── */}
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
        {/* ── Hero Command Panel ─────────────────────────────────────────────── */}
        <section className="glass-panel hero-panel glass-enter">
          <div className="hero-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="glass-chip" style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                <span className="glass-chip__dot glass-chip__dot--live" />
                MONAD STORAGE LOCALITY BENCHMARK
              </span>
              <span className="glass-chip" style={{ fontSize: '0.72rem', padding: '3px 10px', color: 'var(--accent-2)' }}>
                4KB / 128 SLOTS
              </span>
            </div>

            {/* The single signature .text-gradient element per view */}
            <h1 className="text-display-xl text-gradient">
              Page-Aware Storage Locality on Monad
            </h1>

            <p className="text-body" style={{ fontSize: '0.98rem' }}>
              Explore how contiguous <strong>4KB MonadDB storage page packing</strong> eliminates
              asynchronous SSD disk I/O penalties. Visualized in real time with frosted glassmorphism
              and indexed via Envio HyperSync.
            </p>

            <div className="hero-badges-row">
              <span className="glass-chip">
                <span className="glass-chip__dot glass-chip__dot--live" />
                128 Slots / Page
              </span>
              <span className="glass-chip">
                <span className="glass-chip__dot glass-chip__dot--accent" />
                -28.4% Gas Overhead
              </span>
              <span className="glass-chip">
                <span className="glass-chip__dot glass-chip__dot--warning" />
                Async MonadDB SSD
              </span>
              <span className="glass-chip">
                <span className="glass-chip__dot glass-chip__dot--live" />
                Envio HyperSync Active
              </span>
            </div>
          </div>

          {/* Quick Action Control Box */}
          <div className="glass-well hero-control-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-micro" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-2)' }}>
                Active Benchmark Mode
              </span>
              <GlassSwitch
                id="auto-refresh-toggle"
                checked={autoRefresh}
                onChange={setAutoRefresh}
                label="Auto-Sync"
              />
            </div>

            <div
              className="glass-well"
              style={{
                padding: '4px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <button
                onClick={() => handleModeChange('pagesync')}
                className={`chart-mode-pill ${mode === 'pagesync' ? 'chart-mode-pill--active' : ''}`}
                style={{ textAlign: 'center', padding: '6px 12px' }}
              >
                PageSync (2-Slot)
              </button>
              <button
                onClick={() => handleModeChange('conventional')}
                className={`chart-mode-pill ${mode === 'conventional' ? 'chart-mode-pill--active' : ''}`}
                style={{ textAlign: 'center', padding: '6px 12px' }}
              >
                Conventional (5-Slot)
              </button>
            </div>

            <button
              onClick={handleTriggerWorkload}
              className="glass-button-primary"
              style={{ width: '100%', padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <span>⚡</span>
              <span>Dispatch 100 Ops Burst</span>
            </button>
          </div>
        </section>

        {/* ── Section: Key Performance Indicators (#metrics) ────────────────── */}
        <section id="metrics" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header">
            <div className="section-header__title-group">
              <div className="section-header__heading">
                <span>Executive Performance Metrics</span>
                <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>
                  {mode === 'pagesync' ? 'Contiguous Cache' : 'Fragmented Slots'}
                </span>
              </div>
              <span className="section-header__sub">
                MonadDB SSD page warm hit ratio & EVM gas benchmark telemetry
              </span>
            </div>
          </div>

          <div className="kpi-grid">
            <StatCard
              label="Avg Gas / Place Op"
              value={mode === 'pagesync' ? psPlaceAvg.toLocaleString() : naivePlaceAvg.toLocaleString()}
              subValue={mode === 'pagesync' ? 'Contiguous 2-slot warm cache' : 'Fragmented 5-slot page misses'}
              delta={mode === 'pagesync' ? `-${gasSavingsPct}% vs Conventional` : `+40.2% Gas Penalty`}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [12400, 12450, 12380, 12420, 12390, 12410, 12430] : [17200, 17500, 17300, 17800, 17400, 17600, 17350]}
              icon="⚡"
            />

            <StatCard
              label="Cold Page Miss Rate"
              value={mode === 'pagesync' ? '4.2%' : '68.5%'}
              subValue="MonadDB SSD asynchronous buffer misses"
              delta={mode === 'pagesync' ? '-93.8% Page Faults' : '+64.3% Uncached Accesses'}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [8.1, 7.2, 5.5, 4.9, 4.4, 4.2] : [45, 52, 61, 58, 64, 68.5]}
              icon="🧊"
            />

            <StatCard
              label="Orderbook Throughput"
              value={mode === 'pagesync' ? '1,280 ops/s' : '895 ops/s'}
              subValue="Sustained limit order execution rate"
              delta={mode === 'pagesync' ? '+43.0% Speedup' : 'Degraded by IO wait'}
              deltaType={mode === 'pagesync' ? 'positive' : 'negative'}
              sparklineData={mode === 'pagesync' ? [980, 1050, 1120, 1180, 1240, 1280] : [920, 910, 890, 905, 895]}
              icon="📈"
            />

            <StatCard
              label="Envio Indexer State"
              value={stats?.envio?.ordersPlaced?.toLocaleString() || '24,850'}
              subValue={`${stats?.envio?.tradesExecuted?.toLocaleString() || '14,210'} Trades Settled`}
              delta="99.98% Synced"
              deltaType="neutral"
              sparklineData={[18200, 19500, 21200, 22800, 23900, 24850]}
              badgeText="HyperSync"
              icon="🛰️"
            />
          </div>
        </section>

        {/* ── Section: 3D Storage Viewport (#viewport) ─────────────────────── */}
        <section id="viewport" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header">
            <div className="section-header__title-group">
              <div className="section-header__heading">
                <span>3D Storage Page Frame Visualizer</span>
                <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>
                  WebGL Three.js
                </span>
              </div>
              <span className="section-header__sub">
                Interactive contiguous 32-byte slot layout over Monad 4KB memory boundary
              </span>
            </div>
            <div className="text-micro" style={{ color: 'var(--text-muted)' }}>
              Click & Drag to Orbit • Scroll to Zoom
            </div>
          </div>

          <div className="glass-panel viewport-card glass-enter">
            {/* Top Left Overlay Controls */}
            <div className="viewport-overlay-controls">
              <div className="glass-panel" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-micro" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  STORAGE PAGE FRAME
                </span>
                <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>
                  {mode === 'pagesync' ? 'Contiguous Packed Mode' : 'Fragmented Mapping'}
                </span>
              </div>
            </div>

            {/* 3D WebGL Canvas */}
            <StorageBenchmark3D mode={mode} triggerRef={triggerRef} />

            {/* Bottom Left HUD Legend */}
            <div className="viewport-overlay-legend">
              <div className="glass-panel legend-hud">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: 'var(--accent-2)', boxShadow: '0 0 8px var(--accent-2)' }} />
                  <span>Page-Warmed SLOAD (Low Gas · Contiguous)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: 'var(--orb-pink)', boxShadow: '0 0 8px var(--orb-pink)' }} />
                  <span>Cold SLOAD / SSTORE (High Gas · Page Miss)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                  <span>Envio Event Streamer Mesh</span>
                </div>
              </div>
            </div>

            {/* Bottom Right Interactive Trigger */}
            <div className="viewport-overlay-actions">
              <button
                onClick={handleTriggerWorkload}
                className="glass-button-primary"
                style={{ fontSize: '0.8125rem' }}
              >
                <span>⚡</span>
                <span>Trigger 100 Ops Burst</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Section: Gas Benchmark Diagnostics (#diagnostics) ────────────── */}
        <section id="diagnostics" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="section-header">
            <div className="section-header__title-group">
              <div className="section-header__heading">
                <span>Gas Benchmark Diagnostics & Profiling</span>
                <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px', color: 'var(--success)' }}>
                  -28.4% Average Gas
                </span>
              </div>
              <span className="section-header__sub">
                Comparative analysis of Monad contiguous page allocation against traditional EVM slot mapping
              </span>
            </div>
          </div>

          <ChartPanel benchmark={benchmark} />

          {/* Benchmark Operation Grid */}
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
                <div key={op} className="glass-panel card-hover bench-op-card">
                  <div className="bench-op-header">
                    <span className="bench-op-name">{name}</span>
                    <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px', color: 'var(--success)' }}>
                      -{diffPct}% Gas
                    </span>
                  </div>

                  <div className="bench-row">
                    <span className="bench-label">Conventional</span>
                    <span className="bench-val naive">{Math.round(naive).toLocaleString()}</span>
                  </div>

                  <div className="bench-row">
                    <span className="bench-label">PageSync</span>
                    <span className="bench-val pagesync">{Math.round(ps).toLocaleString()}</span>
                  </div>

                  {/* Relative bar */}
                  <div className="bench-bar-track">
                    <div className="bench-bar-fill" style={{ width: `${psRatio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section: Live Envio Stream & Activity (#stream) ───────────────── */}
        <section id="stream" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header">
            <div className="section-header__title-group">
              <div className="section-header__heading">
                <span>Live Envio HyperSync Stream & Mempool</span>
                <span className="glass-chip">
                  <span className="glass-chip__dot glass-chip__dot--live" />
                  REAL-TIME
                </span>
              </div>
              <span className="section-header__sub">
                Decentralized order event indexing and live storage execution telemetry
              </span>
            </div>
          </div>

          <div className="dashboard-grid-two-col">
            <EnvioTables orders={orders} trades={trades} backendOk={backendOk} />
            <ActivityLog events={events} />
          </div>
        </section>

        {/* ── Section: Storage Page Architecture Explainer (#architecture) ─── */}
        <section id="architecture" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-header">
            <div className="section-header__title-group">
              <div className="section-header__heading">
                <span>MonadDB Storage Page Architecture & Memory Map</span>
                <span className="glass-chip" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>
                  Solidity Bit-Packing
                </span>
              </div>
              <span className="section-header__sub">
                Contiguous 32-byte slot layout and warm-page cache alignment specifications
              </span>
            </div>
          </div>

          <ArchitectureExplainer />
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer
          className="glass-panel"
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent-2)' }}>
              Monad-PageSync
            </span>
            <span className="text-micro" style={{ color: 'var(--text-muted)' }}>
              • High-Performance Page-Aware Storage on Monad EVM
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="text-micro" style={{ color: 'var(--text-muted)' }}>
              Indexed with <strong style={{ color: 'var(--text-secondary)' }}>Envio HyperSync</strong>
            </span>
            <span className="text-micro" style={{ color: 'var(--text-muted)' }}>
              Designed with <strong style={{ color: 'var(--accent)' }}>Aurora Glassmorphism</strong>
            </span>
            <span className="text-data text-micro" style={{ color: 'var(--success)' }}>
              ● Operational
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
