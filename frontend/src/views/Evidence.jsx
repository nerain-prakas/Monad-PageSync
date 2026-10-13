import { useEffect, useState } from 'react';
import LayoutReplay from '../components/LayoutReplay';
import { MONAD_CHAIN_ID, PAGE_SYNC_ADDRESS, ORDER_BOOK_ABI, orderPlacedEvent, publicClient, BENCHMARK_RESULTS, shortAddress, formatNum } from '../chain';


export function GasBenchmarkSection() {
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


export function OptimizationDemoSection({ wallet }) {
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


export function BenchmarksSection() {
  return <LayoutReplay />;
}

