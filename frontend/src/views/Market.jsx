import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { MONAD_CHAIN_ID, publicClient, KURU_MARKET_ADDRESS, KURU_USDC_ADDRESS, KURU_MARGIN_ACCOUNT_ADDRESS, KURU_NATIVE_MON_ADDRESS, KURU_ERC20_ABI, KURU_MARGIN_ABI, KURU_ABI, KURU_EMPTY_PRICE, shortAddress } from '../chain';


export function KuruWorkspaceSection({ wallet }) {
  const [quote, setQuote] = useState(null);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [walletReadState, setWalletReadState] = useState({
    monBalance: null,
    usdcBalance: null,
    allowance: null,
    monMargin: null,
    usdcMargin: null,
    status: 'Checking wallet state…',
    error: '',
  });

  const formatTokenRead = (value, decimals = 18) => {
    if (value === null || value === undefined || value === 'Unavailable') return 'Unavailable';
    try {
      return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch {
      return value.toString();
    }
  };

  const readWalletState = async () => {
    if (!wallet?.account || wallet.chainId !== MONAD_CHAIN_ID) {
      setWalletReadState({
        monBalance: 'Unavailable',
        usdcBalance: 'Unavailable',
        allowance: 'Unavailable',
        monMargin: 'Unavailable',
        usdcMargin: 'Unavailable',
        status: wallet?.account ? 'Wrong network' : 'Wallet disconnected',
        error: wallet?.account ? 'MetaMask must be on Monad Testnet (chain ID 10143).' : 'Connect a wallet to inspect Kuru wallet state.',
      });
      return;
    }

    setWalletReadState((prev) => ({ ...prev, status: 'Querying wallet and margin state…', error: '' }));

    const requests = [
      {
        key: 'monBalance',
        label: 'Wallet MON',
        call: () => publicClient.getBalance({ address: wallet.account }),
        format: (v) => formatTokenRead(v, 18),
      },
      {
        key: 'usdcBalance',
        label: 'Wallet USDC',
        call: () => publicClient.readContract({
          address: KURU_USDC_ADDRESS,
          abi: KURU_ERC20_ABI,
          functionName: 'balanceOf',
          args: [wallet.account],
        }),
        format: (v) => formatTokenRead(v, 6),
      },
      {
        key: 'allowance',
        label: 'USDC allowance',
        call: () => publicClient.readContract({
          address: KURU_USDC_ADDRESS,
          abi: KURU_ERC20_ABI,
          functionName: 'allowance',
          args: [wallet.account, KURU_MARGIN_ACCOUNT_ADDRESS],
        }),
        format: (v) => (v === 0n ? 'Required' : `${formatTokenRead(v, 6)} USDC`),
      },
      {
        key: 'monMargin',
        label: 'MON margin',
        call: () => publicClient.readContract({
          address: KURU_MARGIN_ACCOUNT_ADDRESS,
          abi: KURU_MARGIN_ABI,
          functionName: 'getBalance',
          args: [wallet.account, KURU_NATIVE_MON_ADDRESS],
        }),
        format: (v) => formatTokenRead(v, 18),
      },
      {
        key: 'usdcMargin',
        label: 'USDC margin',
        call: () => publicClient.readContract({
          address: KURU_MARGIN_ACCOUNT_ADDRESS,
          abi: KURU_MARGIN_ABI,
          functionName: 'getBalance',
          args: [wallet.account, KURU_USDC_ADDRESS],
        }),
        format: (v) => formatTokenRead(v, 6),
      },
    ];

    const nextState = {
      monBalance: 'Unavailable',
      usdcBalance: 'Unavailable',
      allowance: 'Unavailable',
      monMargin: 'Unavailable',
      usdcMargin: 'Unavailable',
      status: 'Ready for Kuru approval/deposit checks',
      error: '',
    };

    const failures = [];

    for (const request of requests) {
      try {
        const value = await request.call();
        nextState[request.key] = request.format(value);
      } catch (error) {
        failures.push(`${request.label}: ${error?.shortMessage || error?.message || 'RPC request failed'}`);
      }
    }

    if (failures.length) {
      nextState.status = 'Kuru wallet reads unavailable';
      nextState.error = failures.join(' | ');
    }

    setWalletReadState(nextState);
  };

  const fetchKuru = async () => {
    setLoading(true);
    setMarketError('');

    const requests = [
      { name: 'bestBidAsk', call: () => publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'bestBidAsk' }) },
      { name: 'getMarketParams', call: () => publicClient.readContract({ address: KURU_MARKET_ADDRESS, abi: KURU_ABI, functionName: 'getMarketParams' }) },
    ];

    const failures = [];

    for (const request of requests) {
      try {
        const value = await request.call();
        if (request.name === 'bestBidAsk') {
          const [bestBid, bestAsk] = value;
          setQuote({
            bestBid: bestBid === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestBid, 8),
            bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestAsk, 8),
          });
        }
        if (request.name === 'getMarketParams') {
          setParams(value);
        }
      } catch (error) {
        failures.push(`${request.name}: ${error?.shortMessage || error?.message || 'RPC request failed'}`);
      }
    }

    if (failures.length) {
      setMarketError(failures.join(' | '));
    }

    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setMarketError('');

      const failures = [];

      try {
        const bestBidAsk = await publicClient.readContract({
          address: KURU_MARKET_ADDRESS,
          abi: KURU_ABI,
          functionName: 'bestBidAsk',
        });
        if (isMounted) {
          const [bestBid, bestAsk] = bestBidAsk;
          setQuote({
            bestBid: bestBid === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestBid, 8),
            bestAsk: bestAsk === KURU_EMPTY_PRICE ? 'None' : formatUnits(bestAsk, 8),
          });
        }
      } catch (error) {
        failures.push(`${error?.shortMessage || error?.message || 'bestBidAsk RPC request failed'}`);
      }

      try {
        const paramsResult = await publicClient.readContract({
          address: KURU_MARKET_ADDRESS,
          abi: KURU_ABI,
          functionName: 'getMarketParams',
        });
        if (isMounted) {
          setParams(paramsResult);
        }
      } catch (error) {
        failures.push(`${error?.shortMessage || error?.message || 'getMarketParams RPC request failed'}`);
      }

      if (isMounted && failures.length) {
        setMarketError(failures.join(' | '));
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    load();
    readWalletState();

    return () => {
      isMounted = false;
    };
  }, [wallet?.account, wallet?.chainId]);

  useEffect(() => {
    readWalletState();
  }, [wallet?.account, wallet?.chainId]);

  const readiness = !wallet?.account
    ? 'Not ready — wallet disconnected'
    : wallet.chainId !== MONAD_CHAIN_ID
      ? 'Not ready — wrong network'
      : marketError || walletReadState.error
        ? 'Not ready — Kuru RPC read failure'
        : 'Ready for approval/deposit checks';

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
          <strong className="metric-chip-val">{params ? `${params[6]} ticks` : 'Unavailable'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Settlement Contract</span>
          <strong className="metric-chip-val">MarginAccount</strong>
        </div>
      </div>

      <div style={{ marginBottom: '14px', fontSize: '11px', color: 'var(--text-dim)' }}>
        Connected Wallet: {wallet?.account ? shortAddress(wallet.account) : 'Public read mode'} · Chain {wallet?.chainId ?? '—'}
      </div>

      {marketError && (
        <div className="info-callout warning" style={{ marginBottom: '16px' }}>
          <b>Kuru market read failed:</b>
          <span> {marketError}</span>
        </div>
      )}

      <div className="grid-two-col" style={{ marginBottom: '14px' }}>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Wallet</span>
          <strong className="metric-chip-val">{wallet?.account ? 'Connected' : 'Disconnected'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Monad Testnet</span>
          <strong className="metric-chip-val">{wallet?.chainId === MONAD_CHAIN_ID ? '✓' : 'Waiting…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Kuru Market</span>
          <strong className="metric-chip-val">{KURU_MARKET_ADDRESS}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">MarginAccount</span>
          <strong className="metric-chip-val">{KURU_MARGIN_ACCOUNT_ADDRESS}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Wallet MON balance</span>
          <strong className="metric-chip-val">{walletReadState.monBalance ?? 'Checking…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Wallet USDC balance</span>
          <strong className="metric-chip-val">{walletReadState.usdcBalance ?? 'Checking…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">MON margin balance</span>
          <strong className="metric-chip-val">{walletReadState.monMargin ?? 'Checking…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">USDC margin balance</span>
          <strong className="metric-chip-val">{walletReadState.usdcMargin ?? 'Checking…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">USDC allowance</span>
          <strong className="metric-chip-val">{walletReadState.allowance ?? 'Checking…'}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Trading readiness</span>
          <strong className="metric-chip-val">{readiness}</strong>
        </div>
      </div>

      {walletReadState.error && (
        <div className="info-callout warning" style={{ marginBottom: '16px' }}>
          <b>Wallet read detail:</b>
          <span> {walletReadState.error}</span>
        </div>
      )}

      <div className="info-callout">
        <b>Architecture Distinction:</b>
        <span>
          Kuru is the live production order book on Monad Testnet for MON/USDC trading. PageSyncOrderBook is our reference implementation demonstrating how packed structs achieve 20.42% lower median receipt gas.
        </span>
      </div>
    </div>
  );
}

