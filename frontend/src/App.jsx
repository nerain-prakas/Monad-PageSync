import { useEffect, useRef, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  http,
  parseAbi,
} from 'viem';
import './App.css';
import CityExtrusion3D from './components/CityExtrusion3D';

// ========================================================
// MONAD TESTNET & CONTRACT CONFIGURATION
// ========================================================
const MONAD_CHAIN_ID = 10143;
const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
const MONAD = defineChain({
  id: MONAD_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
});

const PAGE_SYNC_ADDRESS = '0x5De52bC09A2A688f6c4615099465e9049CC83bC1';
const ORDER_BOOK_ABI = parseAbi([
  'function placeOrder(uint256 orderId, uint256 price, uint256 quantity, uint8 side)',
  'function updateOrder(uint256 orderId, uint256 newPrice, uint256 newQuantity)',
  'function cancelOrder(uint256 orderId)',
  'function executeTrade(uint256 orderId)',
  'function getOrder(uint256 orderId) view returns (address trader, uint256 price, uint256 quantity, uint8 side, uint8 status)',
  'event OrderPlaced(uint256 indexed orderId, address indexed trader, uint256 price, uint256 quantity, uint8 side)',
]);
const orderPlacedEvent = ORDER_BOOK_ABI.find((item) => item.type === 'event' && item.name === 'OrderPlaced');
const publicClient = createPublicClient({ chain: MONAD, transport: http(MONAD_RPC) });

const KURU_MARKET_ADDRESS = '0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9';
const KURU_ABI = parseAbi([
  'function bestBidAsk() view returns (uint256 bestBid, uint256 bestAsk)',
  'function getMarketParams() view returns (uint96 pricePrecision, uint96 sizePrecision, address baseAssetAddress, uint8 baseAssetDecimals, address quoteAssetAddress, uint8 quoteAssetDecimals, uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps, uint256 makerFeeBps)',
  'function addBuyOrder(uint32 price, uint96 size, bool postOnly)',
  'function addSellOrder(uint32 price, uint96 size, bool postOnly)',
  'function batchCancelOrders(uint40[] orderIds)',
  'event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)',
  'event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)',
  'event OrdersCanceled(uint40[] orderId, address owner)',
]);
const KURU_EMPTY_PRICE = (1n << 256n) - 1n;

// ========================================================
// WALLET HOOK
// ========================================================
function useWallet() {
  const [account, setAccount] = useState();
  const [chainId, setChainId] = useState();
  const [walletClient, setWalletClient] = useState();
  const [walletError, setWalletError] = useState('');

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return undefined;
    const sync = async () => {
      const [accounts, currentChain] = await Promise.all([
        provider.request({ method: 'eth_accounts' }),
        provider.request({ method: 'eth_chainId' }),
      ]);
      setAccount(accounts[0]);
      setChainId(Number(currentChain));
      if (accounts[0]) {
        setWalletClient(createWalletClient({ account: accounts[0], chain: MONAD, transport: custom(provider) }));
      }
    };
    sync().catch(() => setWalletError('Unable to read wallet state.'));

    const onAccountsChanged = ([nextAccount]) => {
      setAccount(nextAccount);
      setWalletClient(
        nextAccount
          ? createWalletClient({ account: nextAccount, chain: MONAD, transport: custom(provider) })
          : undefined
      );
    };
    const onChainChanged = (nextChain) => setChainId(Number(nextChain));
    provider.on?.('accountsChanged', onAccountsChanged);
    provider.on?.('chainChanged', onChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  const connect = async () => {
    setWalletError('');
    if (!window.ethereum) {
      setWalletError('No injected wallet detected. Install MetaMask or Rabby.');
      return;
    }
    try {
      const [nextAccount, nextChain] = await Promise.all([
        window.ethereum.request({ method: 'eth_requestAccounts' }),
        window.ethereum.request({ method: 'eth_chainId' }),
      ]);
      const next = nextAccount[0];
      setAccount(next);
      setChainId(Number(nextChain));
      setWalletClient(createWalletClient({ account: next, chain: MONAD, transport: custom(window.ethereum) }));
    } catch (error) {
      setWalletError(error.shortMessage || error.message || 'Wallet connection was rejected.');
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      setChainId(MONAD_CHAIN_ID);
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x279f',
              chainName: MONAD.name,
              nativeCurrency: MONAD.nativeCurrency,
              rpcUrls: [MONAD_RPC],
              blockExplorerUrls: ['https://testnet.monadexplorer.com'],
            },
          ],
        });
        setChainId(MONAD_CHAIN_ID);
      } else {
        setWalletError(error.shortMessage || error.message || 'Unable to switch network.');
      }
    }
  };

  return { account, chainId, walletClient, walletError, connect, switchNetwork };
}

// ========================================================
// STATIC BENCHMARK EVIDENCE & KNOWN CONTRACTS
// ========================================================
const CONTRACTS = {
  NaiveOrderBook: {
    address: '0x9eDDb8B7612954014Af0fFA58dc9d93dB2C75d68',
    slots: [
      { slot: 0, title: 'trader', type: 'address', bytes: 20, offset: 0, note: 'Order mapping word (12 bytes unused)' },
      { slot: 1, title: 'price', type: 'uint256', bytes: 32, offset: 0, note: 'Full 32-byte storage slot' },
      { slot: 2, title: 'quantity', type: 'uint256', bytes: 32, offset: 0, note: 'Full 32-byte storage slot' },
      { slot: 3, title: 'side + status', type: 'uint8 + uint8', bytes: 2, offset: 0, note: 'Packed fields; 30 bytes unused' },
    ],
    words: 4,
  },
  PageSyncOrderBook: {
    address: '0x5De52bC09A2A688f6c4615099465e9049CC83bC1',
    slots: [
      { slot: 0, title: 'data1 (trader + price)', type: 'packed trader + price', bytes: 32, offset: 0, note: 'Trader (160b), Price (64b), Reserved (32b)' },
      { slot: 1, title: 'data2 (quantity + flags)', type: 'packed quantity + flags', bytes: 32, offset: 0, note: 'Quantity (128b), Side (8b), Status (8b), Padding (112b)' },
    ],
    words: 2,
  },
};

const BENCHMARK_RESULTS = [
  ['Order Placement', 99870, 81986, '-17.91%'],
  ['Second Placement', 116950, 81998, '-29.89%'],
  ['Update Order', 36030, 36394, '+1.01%'],
  ['Cancel Order', 51769, 34806, '-32.77%'],
  ['Execute Trade', 35273, 35294, '+0.06%'],
];

const sampleStructs = {
  Order: `struct Order {
    address trader;
    uint256 price;
    uint256 quantity;
    uint8 side;
    uint8 status;
}`,
  TokenBalance: `struct AccountStake {
    address user;
    uint128 stakedAmount;
    uint64 lockTimestamp;
    bool isExempt;
    uint8 tier;
}`,
  DexPosition: `struct LiquidityPosition {
    address owner;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
    uint256 feeGrowthInside0LastX128;
    uint256 feeGrowthInside1LastX128;
}`,
};

const typeBytes = (type) => {
  const match = type.match(/^(u?int|bytes)(\d+)?$/);
  if (type === 'address') return 20;
  if (type === 'bool') return 1;
  if (match) return match[1] === 'bytes' ? Number(match[2] || 1) : Number(match[2] || 256) / 8;
  return null;
};

function analyzeStruct(source) {
  const structMatch = source.match(/struct\s+(\w+)\s*\{([\s\S]*?)\}/);
  if (!structMatch) throw new Error('Paste a valid Solidity struct declaration (e.g. struct MyStruct { ... }).');
  const fields = [];
  for (const line of structMatch[2].split(';')) {
    const clean = line.replace(/\/\/.*$/, '').trim();
    if (!clean) continue;
    const parts = clean.split(/\s+/);
    if (parts.length !== 2 || !/^(address|bool|u?int(8|16|32|64|128|256)?|bytes([1-9]|[12]\d|3[0-2]))$/.test(parts[0])) {
      throw new Error(`Unsupported type or syntax: "${clean}".`);
    }
    const bytes = typeBytes(parts[0]);
    if (!bytes) throw new Error(`Unsupported type: ${parts[0]}.`);
    fields.push({ name: parts[1], type: parts[0], bytes });
  }
  if (!fields.length) throw new Error('No valid struct fields found.');

  const slots = [];
  let current = { slot: 0, used: 0, fields: [] };
  fields.forEach((field) => {
    if (field.bytes === 32 || current.used + field.bytes > 32) {
      if (current.fields.length) slots.push(current);
      current = { slot: current.slot + (current.fields.length ? 1 : 0), used: 0, fields: [] };
    }
    field.offset = current.used;
    field.slot = current.slot;
    field.packingGroup = current.fields.length ? `group-${current.slot}` : `single-${current.slot}`;
    current.fields.push(field);
    current.used += field.bytes;
  });
  if (current.fields.length) slots.push(current);

  const bytesUsed = fields.reduce((sum, field) => sum + field.bytes, 0);
  return {
    name: structMatch[1],
    fields,
    slots,
    bytesUsed,
    storageSlots: slots.length,
    capacity: slots.length * 32,
    unusedBytes: slots.length * 32 - bytesUsed,
  };
}

const shortAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
const formatNum = (v) => Number(v).toLocaleString();

// ========================================================
// MAIN COMPONENT
// ========================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('observatory');
  const [theme, setTheme] = useState('monad'); // 'monad' | 'crimson'
  const [highlightMode, setHighlightMode] = useState('standard'); // 'standard' | 'storage_packed'
  const [scrollProgress, setScrollProgress] = useState(0.0);
  const [telemetry, setTelemetry] = useState({
    altitude: '0.2',
    pitch: '-68.0',
    passedOrigin: false,
    passedCheckpoint: false,
    passedVenue: false,
  });

  const wallet = useWallet();
  const trackRef = useRef(null);

  // Apply theme attribute to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Window scroll binding for the ~2,800px track
  useEffect(() => {
    const handleScroll = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const scrollDistance = -rect.top;
      const maxScroll = track.offsetHeight - window.innerHeight;
      if (maxScroll > 0) {
        const raw = scrollDistance / maxScroll;
        const clamped = Math.min(Math.max(raw, 0.0), 1.0);
        setScrollProgress(clamped);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleManualSlider = (e) => {
    const val = parseFloat(e.target.value) / 100.0;
    setScrollProgress(val);
  };

  const jumpToPreset = (pct) => {
    setScrollProgress(pct);
    const track = trackRef.current;
    if (track) {
      const topPos = track.getBoundingClientRect().top + window.scrollY;
      const targetY = topPos + (track.offsetHeight - window.innerHeight) * pct;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  };

  const pctFormatted = (scrollProgress * 100).toFixed(1) + '%';

  return (
    <div className="pagesync-root-app">
      {/* ========================================================
          TOP FIXED TELEMETRY NAVBAR
          ======================================================== */}
      <header className="telemetry-navbar">
        <div className="brand-section">
          <div className="status-beacon-pulse" />
          <span className="brand-title">PAGESYNC // 3D OBSERVATORY</span>
          <span className="sector-chip">
            {theme === 'monad' ? 'Monad 10143 Live' : 'Sector 07 Surveillance'}
          </span>
        </div>

        <nav className="nav-links-row">
          <button
            className={`nav-tab-btn ${activeTab === 'observatory' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('observatory');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            3D Observatory
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            Struct Analyzer
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            Storage Inspector
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmark')}
          >
            Gas Benchmark
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'demo' ? 'active' : ''}`}
            onClick={() => setActiveTab('demo')}
          >
            Optimization Demo
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'kuru' ? 'active' : ''}`}
            onClick={() => setActiveTab('kuru')}
          >
            Kuru Market
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveTab('guide')}
          >
            Guide
          </button>
        </nav>

        <div className="telemetry-status-group">
          <div className="readout-pill">
            <span>SCROLL ELEVATION:</span>
            <strong id="nav-scroll-readout">{pctFormatted}</strong>
          </div>
          <div className="readout-pill">
            <span>CUBIC TOWERS:</span>
            <strong>1,600</strong>
          </div>
          <div className="fps-badge">
            <span className="fps-dot" />
            <span style={{ color: '#10B981', fontSize: '10px' }}>60 FPS · WebGL 2.0</span>
          </div>
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === 'monad' ? 'crimson' : 'monad'))}
            title="Toggle Visual Theme"
          >
            {theme === 'monad' ? '⚡ Monad Purple' : '🚨 Crimson'}
          </button>
          {!wallet.account ? (
            <button className="wallet-connect-btn" onClick={wallet.connect}>
              Connect Wallet
            </button>
          ) : (
            <button
              className="wallet-connect-btn"
              onClick={wallet.chainId !== MONAD_CHAIN_ID ? wallet.switchNetwork : undefined}
            >
              {wallet.chainId !== MONAD_CHAIN_ID ? 'Switch to Monad' : shortAddress(wallet.account)}
            </button>
          )}
        </div>
      </header>

      {/* ========================================================
          HERO INTRO SECTION
          ======================================================== */}
      <section className="hero-intro-section">
        <div className="hero-kicker-tag">
          <span className="hero-kicker-dot" />
          Scroll-Driven Procedural WebGL Matrix · Monad Testnet
        </div>
        <h1 className="hero-main-title">
          Reactive 3D Wireframe <br />
          <span className="hero-title-gradient">Onchain Observatory & Storage Extrusion</span>
        </h1>
        <p className="hero-lead-copy">
          A scroll-bound metropolitan surveillance & storage packing matrix reverse-engineered from Chrome DevTools AI Assistance specs. As you scroll down the page, 1,600 dynamic wireframe cubes rise from the flat plane into a towering city skyline representing 32-byte Monad EVM storage pages.
        </p>
        <div className="hero-quick-hints">
          <div className="hint-scroll-indicator">
            <svg className="bounce-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Scroll down to extrude cubes</span>
          </div>
          <span>·</span>
          <span>Or scrub the elevation slider below</span>
          <span>·</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Mode: {highlightMode === 'standard' ? 'Metropolitan Skyline' : 'Packed Storage Heatmap'}
          </span>
          <button
            onClick={() => setHighlightMode((m) => (m === 'standard' ? 'storage_packed' : 'standard'))}
            style={{
              color: 'var(--active-brand)',
              textDecoration: 'underline',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            [Toggle {highlightMode === 'standard' ? 'Storage Mode' : 'Skyline Mode'}]
          </button>
        </div>
      </section>

      {/* ========================================================
          TALL SCROLL TRACK WRAPPER (~2,800px tall)
          STICKY 100svh VIEWPORT CONTAINER (.route-map__pin)
          ======================================================== */}
      <main className="observatory-track-wrapper" id="route-map-track" ref={trackRef}>
        <div className="route-map__pin">
          {/* Atmospheric Scrim Gradients */}
          <div className="route-map__scrim" />

          {/* Moving Technical Film Grain Layer */}
          <div className="grain-overlay" />

          {/* Canvas Wrap with Radial Mask (DevTools exact spec) */}
          <div className="route-map__canvas-wrap" id="route-threejs-canvas-host">
            <CityExtrusion3D
              progress={scrollProgress}
              theme={theme}
              highlightMode={highlightMode}
              onTelemetryUpdate={(data) => {
                setTelemetry({
                  altitude: data.altitude,
                  pitch: data.pitch,
                  passedOrigin: data.passedOrigin,
                  passedCheckpoint: data.passedCheckpoint,
                  passedVenue: data.passedVenue,
                });
              }}
            />
          </div>

          {/* TACTICAL OVERLAY HUD SYSTEM */}
          <div className="hud-layer">
            <div className="hud-layout-container">
              {/* Top Readout Row */}
              <div className="hud-top-readout-row">
                {/* Surveillance Briefing Card */}
                <div className="hud-briefing-card hud-interactive">
                  <div className="card-status-header">
                    <span className="card-status-label">
                      <span className="fps-dot" style={{ background: 'var(--active-brand)' }} />
                      Sector 07 Surveillance
                    </span>
                    <span className="card-live-chip">ACTIVE MATRIX</span>
                  </div>
                  <h2 className="hud-card-title">Spatial Route & Storage Matrix</h2>
                  <p className="hud-card-desc">
                    1,600 cubic towers with <strong style={{ color: 'var(--active-brand)' }}>EdgesGeometry</strong> square outlines (zero diagonal lines). Inner towers extrude upwards first via distance falloff algorithms.
                  </p>
                  <div className="hud-metric-triplet">
                    <div className="hud-metric-box">
                      <div className="hud-metric-label">Est. Dist</div>
                      <div className="hud-metric-val">3.42 KM</div>
                    </div>
                    <div className="hud-metric-box">
                      <div className="hud-metric-label">Mean Alt</div>
                      <div className="hud-metric-val brand-color" id="hud-altitude-readout">
                        {telemetry.altitude} M
                      </div>
                    </div>
                    <div className="hud-metric-box">
                      <div className="hud-metric-label">Target Venue</div>
                      <div className="hud-metric-val green-color">KURU / PS</div>
                    </div>
                  </div>
                </div>

                {/* Live Waypoint Progress Indicator */}
                <div className="waypoint-stack hud-interactive">
                  <div className={`waypoint-node-item ${telemetry.passedOrigin ? 'active' : ''}`} id="wp-node-origin">
                    <span className="node-bullet origin" />
                    <span className="node-name">23:58 // 0x0000 GENESIS LIMITS</span>
                    <span className="node-dist">0.0 KM</span>
                  </div>
                  <div className={`waypoint-node-item ${telemetry.passedCheckpoint ? 'active' : ''}`} id="wp-node-checkpoint">
                    <span className="node-bullet checkpoint" />
                    <span className="node-name">02:41 // ENVIO INDEXER PIPE</span>
                    <span className="node-dist">1.8 KM</span>
                  </div>
                  <div className={`waypoint-node-item ${telemetry.passedVenue ? 'active' : ''}`} id="wp-node-hospital">
                    <span className="node-bullet venue" />
                    <span className="node-name">04:17 // KURU & PAGESYNC SETTLEMENT</span>
                    <span className="node-dist">3.4 KM</span>
                  </div>
                </div>
              </div>

              {/* Bottom Controller & Elevation Scrub Bar */}
              <div className="hud-bottom-controller-row hud-interactive">
                {/* Scrub Slider Card */}
                <div className="scrub-slider-card">
                  <div className="slider-top-label-row">
                    <span className="slider-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      DYNAMIC CUBE EXTRUSION
                    </span>
                    <span className="slider-pct-val" id="slider-percentage">
                      {pctFormatted}
                    </span>
                  </div>
                  <div className="slider-track-input-row">
                    <span className="slider-edge-label">Flat</span>
                    <input
                      id="manual-scroll-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(scrollProgress * 100)}
                      onChange={handleManualSlider}
                      className="styled-range-slider"
                    />
                    <span className="slider-edge-label">Extruded</span>
                  </div>
                  <div className="slider-subtext-row">
                    <span>Scroll page or drag slider</span>
                    <span id="camera-angle-readout">
                      Camera Pitch: {telemetry.pitch}° ({scrollProgress > 0.7 ? 'Isometric' : scrollProgress > 0.3 ? 'Mid-Angle' : "Bird's Eye"})
                    </span>
                  </div>
                </div>

                {/* Camera Preset Perspectives */}
                <div className="camera-presets-card">
                  <button
                    id="preset-nadir"
                    className={`preset-chip-btn ${scrollProgress < 0.25 ? 'active' : ''}`}
                    onClick={() => jumpToPreset(0.0)}
                  >
                    NADIR (0%)
                  </button>
                  <button
                    id="preset-mid"
                    className={`preset-chip-btn ${scrollProgress >= 0.25 && scrollProgress <= 0.75 ? 'active' : ''}`}
                    onClick={() => jumpToPreset(0.5)}
                  >
                    MID (50%)
                  </button>
                  <button
                    id="preset-isometric"
                    className={`preset-chip-btn ${scrollProgress > 0.75 ? 'active' : ''}`}
                    onClick={() => jumpToPreset(1.0)}
                  >
                    ISOMETRIC (100%)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================
          INTEGRATED PAGESYNC WORKSPACES (UNDER THE 3D SCENE)
          ======================================================== */}
      <section className="page-workspace-shell">
        {/* STRUCT ANALYZER */}
        {(activeTab === 'observatory' || activeTab === 'analyzer') && (
          <StructAnalyzerSection />
        )}

        {/* STORAGE INSPECTOR */}
        {(activeTab === 'observatory' || activeTab === 'inspector') && (
          <StorageInspectorSection />
        )}

        {/* GAS BENCHMARK EVIDENCE */}
        {(activeTab === 'observatory' || activeTab === 'benchmark') && (
          <GasBenchmarkSection />
        )}

        {/* LIVE OPTIMIZATION DEMO */}
        {(activeTab === 'observatory' || activeTab === 'demo') && (
          <OptimizationDemoSection wallet={wallet} />
        )}

        {/* KURU TRADING VENUE */}
        {(activeTab === 'observatory' || activeTab === 'kuru') && (
          <KuruWorkspaceSection wallet={wallet} />
        )}

        {/* HOW TO USE GUIDE */}
        {(activeTab === 'observatory' || activeTab === 'guide') && (
          <GuideSection onNavigate={setActiveTab} />
        )}
      </section>

      {/* ========================================================
          FOOTER & METHODOLOGY SPECIFICATION
          ======================================================== */}
      <footer className="observatory-footer">
        <div className="footer-content-container">
          <div className="footer-methodology-grid">
            <div>
              <h3 className="footer-column-title">1. Sticky Viewport Setup</h3>
              <p>
                The container is pinned via <code>position: sticky; top: 0; height: 100svh;</code> within a 2,800px track. This binds continuous mousewheel, touchpad, and touch scroll gestures directly to GPU uniforms and camera fly-through coordinates.
              </p>
            </div>
            <div>
              <h3 className="footer-column-title">2. Proximity Extrusion Formula</h3>
              <p>
                Height scales dynamically via <code>dummy.scale.y = maxH * effectiveProgress</code> with exponential falloff. Central towers elevate first, establishing an organic skyline that visually maps to 32-byte storage slots.
              </p>
            </div>
            <div>
              <h3 className="footer-column-title">3. Camera Flight & Shaders</h3>
              <p>
                The perspective camera sweeps down from an overhead bird&apos;s-eye nadir angle (Y:38) to an aggressive low-angle isometric viewpoint (Y:18) with synchronized waypoint reveals and zero-diagonal line rendering.
              </p>
            </div>
          </div>
          <div className="footer-sub-bar">
            <span>PageSync Onchain Observatory // Three.js WebGL 2.0 Engine</span>
            <span>Reverse-Engineered Chrome DevTools Specification · Monad Testnet (Chain 10143)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ========================================================
// SECTION SUB-COMPONENTS
// ========================================================

function StructAnalyzerSection() {
  const [selectedPreset, setSelectedPreset] = useState('Order');
  const [source, setSource] = useState(sampleStructs.Order);
  const [analysis, setAnalysis] = useState(() => analyzeStruct(sampleStructs.Order));
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const runAnalysis = () => {
    try {
      setAnalysis(analyzeStruct(source));
      setError('');
    } catch (err) {
      setAnalysis(null);
      setError(err.message);
    }
  };

  const loadPreset = (name) => {
    setSelectedPreset(name);
    setSource(sampleStructs[name]);
    try {
      setAnalysis(analyzeStruct(sampleStructs[name]));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text, msg) => {
    navigator.clipboard?.writeText(text);
    setCopyStatus(msg);
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div className="glass-panel" id="section-analyzer">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">TOOL / SOLIDITY STORAGE ENGINE</span>
          <h2 className="panel-title">Solidity Struct Slot Analyzer</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.keys(sampleStructs).map((name) => (
            <button
              key={name}
              className={`preset-chip-btn ${selectedPreset === name ? 'active' : ''}`}
              onClick={() => loadPreset(name)}
            >
              Preset: {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-two-col">
        {/* Input Column */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            PASTE SOLIDITY STRUCT DECLARATION:
          </label>
          <textarea
            className="solidity-code-textarea"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck="false"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Supported: address · uint/int8–256 · bool · bytes1–32
            </span>
            <button className="btn-primary" onClick={runAnalysis}>
              Analyze Slots →
            </button>
          </div>
          {error && <div className="info-callout warning" style={{ marginTop: '14px' }}>{error}</div>}
        </div>

        {/* Layout Report Column */}
        <div>
          {analysis && (
            <div>
              <div className="grid-three-col" style={{ marginBottom: '16px' }}>
                <div className="metric-summary-chip">
                  <span className="metric-chip-label">Storage Slots</span>
                  <strong className="metric-chip-val purple">{analysis.storageSlots} words</strong>
                </div>
                <div className="metric-summary-chip">
                  <span className="metric-chip-label">Bytes Used</span>
                  <strong className="metric-chip-val">{analysis.bytesUsed} / {analysis.capacity}</strong>
                </div>
                <div className="metric-summary-chip">
                  <span className="metric-chip-label">Unused Padding</span>
                  <strong className="metric-chip-val green">{analysis.unusedBytes} bytes</strong>
                </div>
              </div>

              <div className="slot-block-list">
                {analysis.slots.map((slot) => (
                  <div className="storage-slot-card" key={slot.slot}>
                    <div className="slot-header-bar">
                      <strong style={{ color: 'var(--text-pure)' }}>Storage Slot {slot.slot}</strong>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {32 - slot.used} bytes unused ({slot.used}/32 B filled)
                      </span>
                    </div>
                    <div className="slot-visual-bar-32">
                      {slot.fields.map((field) => (
                        <div
                          className="slot-field-segment"
                          style={{ flexBasis: `${(field.bytes / 32) * 100}%` }}
                          key={field.name}
                          title={`${field.name} (${field.type}) - ${field.bytes} bytes at offset ${field.offset}`}
                        >
                          <span className="segment-name">{field.name}</span>
                          <span className="segment-bytes">{field.bytes}B</span>
                        </div>
                      ))}
                    </div>
                    <div className="slot-fields-metadata">
                      {slot.fields.map((field) => (
                        <span key={field.name}>
                          <b>{field.name}</b>: {field.type} (offset {field.offset})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="info-callout" style={{ marginTop: '16px' }}>
                <b>Packaging Recommendation:</b>
                <span>
                  {analysis.slots.some((s) => s.fields.length > 1)
                    ? 'Adjacent small fields are successfully packed into shared 32-byte EVM storage slots.'
                    : 'Consider grouping adjacent smaller variables (e.g. uint128, uint64, bool) to consolidate storage words.'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => copyToClipboard(source, 'Struct copied!')}
                >
                  {copyStatus || 'Copy Solidity Struct'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StorageInspectorSection() {
  const [selectedContract, setSelectedContract] = useState('NaiveOrderBook');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);

  const contract = CONTRACTS[selectedContract];
  const item = contract.slots[selectedSlotIndex];

  return (
    <div className="glass-panel" id="section-inspector">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">TOOL / ONCHAIN LAYOUT VERIFIER</span>
          <h2 className="panel-title">Compiled Storage Layout Inspector</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`preset-chip-btn ${selectedContract === 'NaiveOrderBook' ? 'active' : ''}`}
            onClick={() => {
              setSelectedContract('NaiveOrderBook');
              setSelectedSlotIndex(0);
            }}
          >
            NaiveOrderBook (4 Slots)
          </button>
          <button
            className={`preset-chip-btn ${selectedContract === 'PageSyncOrderBook' ? 'active' : ''}`}
            onClick={() => {
              setSelectedContract('PageSyncOrderBook');
              setSelectedSlotIndex(0);
            }}
          >
            PageSyncOrderBook (2 Slots)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', fontSize: '11px' }}>
        <span style={{ color: 'var(--text-dim)' }}>VERIFIED CONTRACT ADDRESS:</span>
        <code style={{ color: 'var(--accent-cyan)' }}>{contract.address}</code>
        <a
          href={`https://testnet.monadexplorer.com/address/${contract.address}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--active-brand)', textDecoration: 'underline' }}
        >
          View Explorer ↗
        </a>
      </div>

      <div className="grid-two-col">
        {/* Slots List */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {contract.slots.map((slot, idx) => (
              <button
                key={slot.slot}
                onClick={() => setSelectedSlotIndex(idx)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: selectedSlotIndex === idx ? '1px solid var(--active-brand)' : '1px solid var(--line-hairline)',
                  background: selectedSlotIndex === idx ? 'rgba(114, 87, 255, 0.12)' : 'var(--bg-surface-elevated)',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>WORD {slot.slot}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-pure)', margin: '6px 0' }}>
                  {slot.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{slot.bytes} bytes used</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Slot Inspector */}
        <div className="storage-slot-card">
          <span className="section-eyebrow">SELECTED STORAGE WORD DETAILS</span>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-pure)', margin: '6px 0 16px' }}>
            Slot {item.slot} · {item.title}
          </h3>
          <table className="custom-data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-dim)', width: '120px' }}>Field</td>
                <td><strong>{item.title}</strong></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Type</td>
                <td><code>{item.type}</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Bytes</td>
                <td>{item.bytes} / 32 bytes</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)' }}>Packing Note</td>
                <td style={{ color: 'var(--monad-purple-bright)' }}>{item.note}</td>
              </tr>
            </tbody>
          </table>
          <div className="info-callout" style={{ marginTop: '16px' }}>
            <b>Storage Locality Note:</b>
            <span>
              By packing the 5 logical order fields into 2 storage slots instead of 4, contract writes require 50% fewer SSTORE operations per order placement on Monad.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GasBenchmarkSection() {
  return (
    <div className="glass-panel" id="section-benchmark">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">RESEARCH / VERIFIED RECEIPT EVIDENCE</span>
          <h2 className="panel-title">Monad Testnet Gas Benchmark (Chain 10143)</h2>
        </div>
        <span className="status-badge green">30 / 30 RECEIPTS VERIFIED</span>
      </div>

      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(114, 87, 255, 0.08) 100%)',
          borderRadius: '10px',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-pure)', marginBottom: '4px' }}>
          PageSync achieved 20.42% lower median total receipt gas than NaiveOrderBook
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          All 30 transactions across 3 repeated workloads succeeded with status = 1 on Monad Testnet. Measurements reflect true receipt <code>gasUsed</code>, not estimations.
        </p>
      </div>

      <div className="table-scroll-wrapper">
        <table className="custom-data-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>NaiveOrderBook (4 Slots)</th>
              <th>PageSyncOrderBook (2 Slots)</th>
              <th>Gas Difference</th>
            </tr>
          </thead>
          <tbody>
            {BENCHMARK_RESULTS.map(([op, naive, ps, diff]) => (
              <tr key={op}>
                <td><strong>{op}</strong></td>
                <td>{formatNum(naive)} gas</td>
                <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatNum(ps)} gas</td>
                <td>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: diff.startsWith('-') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: diff.startsWith('-') ? 'var(--accent-green)' : 'var(--accent-amber)',
                    }}
                  >
                    {diff}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-four-col" style={{ marginTop: '20px' }}>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Naive Median Gas</span>
          <strong className="metric-chip-val">339,892</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">PageSync Median</span>
          <strong className="metric-chip-val green">270,478</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Total Workload Savings</span>
          <strong className="metric-chip-val purple">-20.42%</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Network Verification</span>
          <strong className="metric-chip-val">Monad 10143</strong>
        </div>
      </div>
    </div>
  );
}

function OptimizationDemoSection({ wallet }) {
  const [side, setSide] = useState(0);
  const [price, setPrice] = useState('1000');
  const [quantity, setQuantity] = useState('10');
  const [busy, setBusy] = useState('');
  const [lastTx, setLastTx] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const refreshOrders = async () => {
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 500n ? latestBlock - 500n : 0n;
      const logs = await publicClient.getLogs({
        address: PAGE_SYNC_ADDRESS,
        event: orderPlacedEvent,
        fromBlock,
        toBlock: latestBlock,
      });
      const ids = [...new Set(logs.map((l) => l.args.orderId.toString()))];
      const list = await Promise.all(
        ids.slice(0, 10).map(async (id) => {
          try {
            const [trader, p, q, s, st] = await publicClient.readContract({
              address: PAGE_SYNC_ADDRESS,
              abi: ORDER_BOOK_ABI,
              functionName: 'getOrder',
              args: [BigInt(id)],
            });
            return { id, trader, price: p.toString(), quantity: q.toString(), side: Number(s), status: Number(st) };
          } catch {
            return null;
          }
        })
      );
      setOrders(list.filter(Boolean));
    } catch (err) {
      console.warn('Orders refresh warning', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 500n ? latestBlock - 500n : 0n;
        const logs = await publicClient.getLogs({
          address: PAGE_SYNC_ADDRESS,
          event: orderPlacedEvent,
          fromBlock,
          toBlock: latestBlock,
        });
        const ids = [...new Set(logs.map((l) => l.args.orderId.toString()))];
        const list = await Promise.all(
          ids.slice(0, 10).map(async (id) => {
            try {
              const [trader, p, q, s, st] = await publicClient.readContract({
                address: PAGE_SYNC_ADDRESS,
                abi: ORDER_BOOK_ABI,
                functionName: 'getOrder',
                args: [BigInt(id)],
              });
              return { id, trader, price: p.toString(), quantity: q.toString(), side: Number(s), status: Number(st) };
            } catch {
              return null;
            }
          })
        );
        if (isMounted) setOrders(list.filter(Boolean));
      } catch (err) {
        console.warn('Orders refresh warning', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const placeOrder = async () => {
    if (!wallet.walletClient || wallet.chainId !== MONAD_CHAIN_ID) {
      setError('Connect wallet on Monad Testnet first.');
      return;
    }
    setBusy('placing');
    setError('');
    try {
      const orderId = BigInt(Date.now());
      const hash = await wallet.walletClient.writeContract({
        address: PAGE_SYNC_ADDRESS,
        abi: ORDER_BOOK_ABI,
        functionName: 'placeOrder',
        args: [orderId, BigInt(price), BigInt(quantity), side],
        account: wallet.account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setLastTx({ hash, gasUsed: receipt.gasUsed.toString(), orderId: orderId.toString() });
      await refreshOrders();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction rejected or failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="glass-panel" id="section-demo">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">LIVE WORKLOAD / MONAD TESTNET</span>
          <h2 className="panel-title">Live Storage Optimization Demo</h2>
        </div>
        <span className="status-badge purple">PageSyncOrderBook 0x5De5...</span>
      </div>

      <div className="grid-two-col">
        {/* Form */}
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`preset-chip-btn ${side === 0 ? 'active' : ''}`}
              onClick={() => setSide(0)}
              style={{ flex: 1 }}
            >
              BUY ORDER (Side 0)
            </button>
            <button
              className={`preset-chip-btn ${side === 1 ? 'active' : ''}`}
              onClick={() => setSide(1)}
              style={{ flex: 1 }}
            >
              SELL ORDER (Side 1)
            </button>
          </div>

          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
            PRICE (RAW UNITS)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#06070B',
              border: '1px solid var(--line-hairline)',
              borderRadius: '6px',
              color: '#FFF',
              marginBottom: '14px',
            }}
          />

          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
            QUANTITY
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#06070B',
              border: '1px solid var(--line-hairline)',
              borderRadius: '6px',
              color: '#FFF',
              marginBottom: '18px',
            }}
          />

          <button
            className="btn-primary"
            onClick={placeOrder}
            disabled={!wallet.account || !!busy}
            style={{ width: '100%' }}
          >
            {busy ? 'Confirming on Monad...' : 'Write Packed Order to Monad →'}
          </button>
          {error && <div className="info-callout warning" style={{ marginTop: '14px' }}>{error}</div>}
        </div>

        {/* Live Receipt & State */}
        <div>
          {lastTx ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: '16px',
              }}
            >
              <strong style={{ color: 'var(--accent-green)', display: 'block', marginBottom: '8px' }}>
                Transaction Confirmed on Monad ✓
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Order ID: <code>#{lastTx.orderId}</code> <br />
                Receipt Gas Used: <strong>{formatNum(lastTx.gasUsed)} gas</strong> <br />
                Storage Footprint: <strong>2 packed words (64 bytes)</strong>
              </div>
              <a
                href={`https://testnet.monadexplorer.com/tx/${lastTx.hash}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', marginTop: '10px', color: 'var(--accent-cyan)', fontSize: '11px' }}
              >
                View Explorer Receipt ↗
              </a>
            </div>
          ) : (
            <div className="info-callout">
              <b>Packed Storage Execution:</b>
              <span>
                When you submit an order, PageSync decodes and packs the trader address, price, quantity, side, and status into only 2 storage slots. Connect your wallet to send a live transaction.
              </span>
            </div>
          )}

          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-dim)', margin: '16px 0 8px' }}>
            Recent Orders on PageSyncOrderBook:
          </h4>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {orders.length ? (
              orders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--line-hairline)',
                    fontSize: '11px',
                  }}
                >
                  <span>#{o.id} ({o.side === 0 ? 'BUY' : 'SELL'})</span>
                  <span>{o.price} units / {o.quantity} qty</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>{shortAddress(o.trader)}</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Loading recent orders...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KuruWorkspaceSection({ wallet }) {
  const [quote, setQuote] = useState(null);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchKuru = async () => {
    setLoading(true);
    try {
      const [[bestBid, bestAsk], p] = await Promise.all([
        publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'bestBidAsk' }),
        publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'getMarketParams' }),
      ]);
      setQuote({
        bestBid: bestBid === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestBid, 8),
        bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestAsk, 8),
      });
      setParams(p);
    } catch (err) {
      console.warn('Kuru read error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const [[bestBid, bestAsk], p] = await Promise.all([
          publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'bestBidAsk' }),
          publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'getMarketParams' }),
        ]);
        if (isMounted) {
          setQuote({
            bestBid: bestBid === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestBid, 8),
            bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestAsk, 8),
          });
          setParams(p);
        }
      } catch (err) {
        console.warn('Kuru read error', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="glass-panel" id="section-kuru">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">LIVE DEX VENUE / MONAD TESTNET</span>
          <h2 className="panel-title">Kuru MON / USDC Order Book Market</h2>
        </div>
        <button className="btn-secondary" onClick={fetchKuru} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Market'}
        </button>
      </div>

      <div className="grid-four-col" style={{ marginBottom: '20px' }}>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Best Bid</span>
          <strong className="metric-chip-val green">{quote?.bestBid ?? '—'} USDC</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Best Ask</span>
          <strong className="metric-chip-val purple">{quote?.bestAsk ?? '—'} USDC</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Market Tick Size</span>
          <strong className="metric-chip-val">{params ? `${params[6]} ticks` : '100 ticks'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Settlement Contract</span>
          <strong className="metric-chip-val">MarginAccount</strong>
        </div>
      </div>

      <div style={{ marginBottom: '14px', fontSize: '11px', color: 'var(--text-dim)' }}>
        Connected Wallet: {wallet?.account ? shortAddress(wallet.account) : 'Public read mode'} · Chain 10143
      </div>

      <div className="info-callout">
        <b>Architecture Distinction:</b>
        <span>
          Kuru is the live production order book on Monad Testnet for MON/USDC trading. PageSyncOrderBook is our reference implementation demonstrating how packed structs achieve 20.42% lower median receipt gas.
        </span>
      </div>
    </div>
  );
}

function GuideSection({ onNavigate }) {
  const steps = [
    { num: '01', title: '3D Matrix Surveillance', desc: 'Scroll down the track to extrude 1,600 cubes, inspect waypoints, and adjust camera angles.', action: 'observatory' },
    { num: '02', title: 'Struct Analyzer', desc: 'Paste any Solidity struct to calculate exact byte offsets and slot packaging efficiency.', action: 'analyzer' },
    { num: '03', title: 'Storage Inspector', desc: 'Compare the compiled 4-slot layout vs PageSync 2-slot packed layout.', action: 'inspector' },
    { num: '04', title: 'Receipt Gas Benchmark', desc: 'Review 30 verified Monad Testnet transaction receipts showing 20.42% gas reduction.', action: 'benchmark' },
    { num: '05', title: 'Live Optimization Demo', desc: 'Connect a wallet to write packed transactions and inspect receipts on Monad Explorer.', action: 'demo' },
  ];

  return (
    <div className="glass-panel" id="section-guide">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">GUIDE / GETTING STARTED</span>
          <h2 className="panel-title">How to Explore PageSync 3D Observatory</h2>
        </div>
      </div>

      <div className="grid-three-col">
        {steps.map((s) => (
          <div key={s.num} className="storage-slot-card">
            <span style={{ fontSize: '11px', color: 'var(--active-brand)', fontWeight: 700 }}>
              STEP {s.num}
            </span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-pure)', margin: '6px 0 8px' }}>
              {s.title}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '14px' }}>
              {s.desc}
            </p>
            <button
              className="btn-secondary"
              onClick={() => onNavigate(s.action)}
              style={{ fontSize: '10px', padding: '6px 10px' }}
            >
              Open Step →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
