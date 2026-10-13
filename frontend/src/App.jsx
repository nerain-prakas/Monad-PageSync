import { useCallback, useEffect, useState } from 'react';
import { MONAD_CHAIN_ID, shortAddress, useWallet } from './chain';
import Landing from './pages/Landing';
import Docs from './pages/Docs';
import ActivityWorkspace from './components/ActivityWorkspace';
import { StorageLabSection } from './views/StorageLab';
import { BenchmarksSection, GasBenchmarkSection, OptimizationDemoSection } from './views/Evidence';
import { KuruWorkspaceSection } from './views/Market';

const NAV = [
  { to: '/lab', label: 'Lab' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/market', label: 'Market' },
  { to: '/activity', label: 'Activity' },
  { to: '/docs', label: 'Docs' },
];

const PAGES = {
  '/lab': {
    n: '01',
    title: 'Storage Lab',
    line: 'Analyse a Solidity struct, or inspect the known order-book layouts.',
  },
  '/evidence': {
    n: '02',
    title: 'Evidence',
    line: 'Measured receipt gas on Monad Testnet — with its limits stated.',
  },
  '/market': {
    n: '03',
    title: 'Market',
    line: 'Kuru order book on Monad Testnet. Testnet funds only.',
  },
  '/docs': {
    n: '05',
    title: 'Docs',
    line: 'How to use PageSync: the tools, the wallet, the method and its limits.',
  },
  '/activity': {
    n: '04',
    title: 'Activity',
    line: 'Orders and trades indexed by Envio, linked to the explorer.',
  },
};

const EVIDENCE_TABS = [
  { id: 'receipts', label: 'Receipts' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'reproduce', label: 'Reproduce' },
];

const readRoute = () => {
  const r = window.location.hash.replace(/^#/, '') || '/';
  return r === '/' || PAGES[r] ? r : '/';
};

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PageHead({ page }) {
  return (
    <header className="pagehead">
      <span className="mono pagehead__n">{page.n}</span>
      <h1 className="pagehead__title">{page.title}</h1>
      <p className="pagehead__line">{page.line}</p>
    </header>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [evTab, setEvTab] = useState('receipts');
  const wallet = useWallet();

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((to) => {
    window.location.hash = to;
  }, []);

  const walletLabel = !wallet.account
    ? 'Connect'
    : wallet.chainId !== MONAD_CHAIN_ID
      ? 'Switch to Monad'
      : shortAddress(wallet.account);
  const walletClick = !wallet.account
    ? wallet.connect
    : wallet.chainId !== MONAD_CHAIN_ID
      ? wallet.switchNetwork
      : undefined;

  const page = PAGES[route];

  return (
    <div className="app">
      <header className="nav">
        <button className="nav__logo" onClick={() => go('/')} aria-label="PageSync home">
          PAGE<b>SYNC</b>
        </button>
        <nav className="nav__links" aria-label="Primary">
          {NAV.map((l) => (
            <button
              key={l.to}
              className={`nav__link ${route === l.to ? 'is-active' : ''}`}
              onClick={() => go(l.to)}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <button className="btn btn--small" onClick={walletClick} disabled={!walletClick && !!wallet.account}>
          {walletLabel}
        </button>
      </header>

      {route === '/' ? (
        <Landing go={go} />
      ) : (
        <main className="page" key={route}>
          <PageHead page={page} />

          {route === '/lab' && <StorageLabSection />}

          {route === '/evidence' && (
            <>
              <Tabs tabs={EVIDENCE_TABS} value={evTab} onChange={setEvTab} />
              {evTab === 'receipts' && <GasBenchmarkSection />}
              {evTab === 'simulation' && <BenchmarksSection />}
              {evTab === 'reproduce' && <OptimizationDemoSection wallet={wallet} />}
            </>
          )}

          {route === '/market' && <KuruWorkspaceSection wallet={wallet} />}
          {route === '/activity' && <ActivityWorkspace />}
          {route === '/docs' && <Docs go={go} />}
        </main>
      )}

      {route !== '/' && (
        <footer className="foot mono">
          <span>PageSync &middot; Monad Testnet 10143</span>
          <span>Research tool &mdash; no real-value trading</span>
          <button className="foot__link" onClick={() => go('/docs')}>Docs</button>
        </footer>
      )}
    </div>
  );
}
