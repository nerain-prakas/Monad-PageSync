import { useEffect, useRef, useState } from 'react';
import { analyzeStruct, generateOptimizedStruct } from '../storageLayout';
import { verifyStructLayouts } from '../solidityCompiler';
import { CONTRACTS, sampleStructs } from '../chain';


function StructAnalyzerSection() {
  const [selectedPreset, setSelectedPreset] = useState('Order');
  const [source, setSource] = useState(sampleStructs.Order);
  const [analysis, setAnalysis] = useState(() => analyzeStruct(sampleStructs.Order));
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [verification, setVerification] = useState({ status: 'estimated' });
  const [isVerifying, setIsVerifying] = useState(false);
  const verificationRun = useRef(0);
  const copyTimer = useRef(null);

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  const runAnalysis = async (input = source, presetName = '') => {
    const runId = ++verificationRun.current;
    setSelectedPreset(presetName);
    setAnalysis(null);
    setError('');
    setCopyStatus(null);
    setVerification({ status: 'pending' });
    setIsVerifying(true);

    let result;
    try {
      result = analyzeStruct(input);
    } catch (err) {
      if (runId === verificationRun.current) {
        setVerification({ status: 'failed', message: err.message });
        setError(err.message);
        setIsVerifying(false);
      }
      return;
    }

    setAnalysis(result);
    try {
      const optimizedDeclaration = generateOptimizedStruct(result);
      const compilerResult = await verifyStructLayouts(
        result,
        input,
        optimizedDeclaration
      );
      if (runId === verificationRun.current) {
        setVerification({ status: 'verified', result: compilerResult });
      }
    } catch (err) {
      if (runId === verificationRun.current) {
        setVerification({ status: 'failed', message: err.message });
      }
    } finally {
      if (runId === verificationRun.current) setIsVerifying(false);
    }
  };

  const loadPreset = (name) => {
    setSource(sampleStructs[name]);
    void runAnalysis(sampleStructs[name], name);
  };

  const updateSource = (value) => {
    verificationRun.current += 1;
    setSource(value);
    setAnalysis(null);
    setError('');
    setCopyStatus(null);
    setVerification({ status: 'estimated' });
    setIsVerifying(false);
  };

  const copyOptimizedStruct = async () => {
    if (!analysis) return;
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    let timeoutId;
    setCopyStatus({ status: 'copying', message: 'Copying the optimized declaration…' });
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser context.');
      }
      await Promise.race([
        navigator.clipboard.writeText(generateOptimizedStruct(analysis)),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error('The clipboard request timed out. Check browser permissions and retry.'));
          }, 5000);
        }),
      ]);
      setCopyStatus({ status: 'success', message: 'Optimized struct copied to clipboard.' });
    } catch (err) {
      setCopyStatus({ status: 'error', message: `Copy failed: ${err.message}` });
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
    copyTimer.current = window.setTimeout(() => setCopyStatus(null), 5000);
  };

  const renderLayout = (layout, title, description, compilerSlotCount = null) => (
    <section>
      <h3 className="storage-layout-heading">{title}</h3>
      <p className="storage-layout-description">{description}</p>
      <div className="grid-three-col" style={{ marginBottom: '12px' }}>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">{compilerSlotCount === null ? 'Estimated slots' : 'Compiler slots'}</span>
          <strong className="metric-chip-val purple">{compilerSlotCount ?? layout.storageSlots}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Occupied bytes</span>
          <strong className="metric-chip-val">{layout.bytesUsed} / {layout.capacity}</strong>
        </div>
        <div className="metric-summary-chip">
          <span className="metric-chip-label">Estimated padding</span>
          <strong className="metric-chip-val">{layout.capacity - layout.bytesUsed} bytes</strong>
        </div>
      </div>
      <div className="slot-block-list">
        {layout.slots.map((slot) => (
          <div className="storage-slot-card" key={`${title}-${slot.index}`}>
            <div className="slot-header-bar">
              <strong style={{ color: 'var(--text-pure)' }}>Slot {slot.index}</strong>
              <span style={{ color: 'var(--text-dim)' }}>{slot.used}/32 bytes</span>
            </div>
            <div className="slot-visual-bar-32">
              {slot.fields.map((field, index) => (
                <div
                  className="slot-field-segment"
                  style={{ flexBasis: `${(field.bytes / 32) * 100}%` }}
                  key={`${field.name}-${field.elementIndex ?? 'field'}-${index}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <ul className="slot-field-details">
              {slot.fields.map((field, index) => (
                <li key={`${field.name}-${field.elementIndex ?? 'field'}-${index}`}>
                  <code>{field.elementIndex === undefined ? field.name : `${field.name}[${field.elementIndex}]`}</code>
                  <span>{field.type}</span>
                  <strong>{field.bytes} B</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="glass-panel" id="section-analyzer">
      <div className="panel-header-row">
        <div>
          <span className="section-eyebrow">TOOL / SOLIDITY STORAGE ENGINE</span>
          <h2 className="panel-title">Universal Solidity Struct Optimizer</h2>
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
            PASTE ONE SOLIDITY STRUCT DECLARATION:
          </label>
          <textarea
            className="solidity-code-textarea"
            value={source}
            onChange={(e) => updateSource(e.target.value)}
            spellCheck="false"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Elementary types, one-dimensional arrays (fixed ≤256), mappings, string, bytes. User-defined/nested types are not supported yet.
            </span>
            <button className="btn-primary" onClick={() => void runAnalysis()}>
              {isVerifying ? 'Verifying…' : 'Optimize & Verify →'}
            </button>
          </div>
          {error && <div className="info-callout warning" style={{ marginTop: '14px' }}>{error}</div>}
          <div className="info-callout warning storage-compatibility-warning" role="note">
            <b>Storage compatibility warning</b>
            <span>
              Reordering struct fields changes storage layout and can break existing deployments, persisted data, or upgradeable proxies. Review generated code carefully; use it for new deployments unless compatibility has been independently established.
            </span>
          </div>
        </div>

        {/* Layout Report Column */}
        <div>
          <div
            className={`info-callout storage-verification-status ${verification.status}`}
            role="status"
            aria-live="polite"
          >
            <b>
              {verification.status === 'verified' && 'Compiler verified'}
              {verification.status === 'pending' && 'Verifying with Solidity compiler…'}
              {verification.status === 'failed' && 'Verification failed'}
              {verification.status === 'estimated' && 'Estimated only'}
            </b>
            <span>
              {verification.status === 'verified'
                ? `solc ${verification.result.compilerVersion} confirmed ${verification.result.original.storageSlots} original slots and ${verification.result.optimized.storageSlots} optimized slots. Field names, types, slots, and byte offsets match the submitted declarations.`
                : verification.status === 'failed'
                  ? verification.message
                  : verification.status === 'pending'
                    ? 'The original and generated declarations are being compiled and compared.'
                    : 'Submit a supported struct to compile both declarations and compare their storage layouts. No compiler result is being claimed yet.'}
            </span>
            {verification.status === 'verified' && (
              <div className="storage-compiler-positions">
                <span>
                  Original: {verification.result.original.members.map(({ name, slot, offset }) => `${name} → ${slot}:${offset}`).join(' · ')}
                </span>
                <span>
                  Optimized: {verification.result.optimized.members.map(({ name, slot, offset }) => `${name} → ${slot}:${offset}`).join(' · ')}
                </span>
              </div>
            )}
          </div>
          {analysis && (
            <div>
              <div className="info-callout" style={{ marginBottom: '14px' }}>
                <b>{analysis.name}</b>
                <span>
                  {analysis.estimatedSlotsSaved > 0
                    ? `The size-first suggestion uses an estimated ${analysis.estimatedSlotsSaved} fewer storage ${analysis.estimatedSlotsSaved === 1 ? 'slot' : 'slots'} for packable fields.`
                    : 'The size-first heuristic found no estimated slot reduction for this declaration.'}
                </span>
              </div>

              <div className="storage-field-list">
                <h3 className="storage-layout-heading">Field sizes</h3>
                {analysis.fields.map((field) => (
                  <div className="storage-field-row" key={field.name}>
                    <code>{field.name}</code>
                    <span>{field.type}</span>
                    <strong>
                      {field.kind === 'fixed-array'
                        ? `${field.bytes} B total · ${field.length} elements`
                        : field.kind === 'scalar'
                          ? `${field.bytes} B`
                          : '32 B storage head'}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="storage-layout-comparison">
                {renderLayout(
                  analysis.declaredLayout,
                  'Declared order',
                  verification.status === 'verified'
                    ? 'Compiler-verified layout of the submitted declaration.'
                    : 'Estimated layout using the field order you entered.',
                  verification.status === 'verified' ? verification.result.original.storageSlots : null
                )}
                {renderLayout(
                  analysis.suggestedLayout,
                  'Suggested size-first order',
                  verification.status === 'verified'
                    ? 'Compiler-verified generated declaration. Fields are reordered only when the estimate finds a strict slot reduction.'
                    : 'Heuristic proposal reorders elementary fields within runs. Array, mapping, string, and bytes fields remain boundaries.',
                  verification.status === 'verified' ? verification.result.optimized.storageSlots : null
                )}
              </div>

              <div className="optimized-code-panel">
                <div className="optimized-code-heading">
                  <div>
                    <h3 className="storage-layout-heading">Generated optimized declaration</h3>
                    <p className="storage-layout-description">
                      {analysis.optimizationApplied
                        ? 'Same struct and fields, reordered based on the calculated slot layout.'
                        : 'No estimated slot reduction was identified; the original field order is retained.'}
                    </p>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => void copyOptimizedStruct()}
                    disabled={copyStatus?.status === 'copying'}
                  >
                    {copyStatus?.status === 'copying' ? 'Copying…' : 'Copy Optimized Struct'}
                  </button>
                  {copyStatus && (
                    <span className={`storage-copy-feedback ${copyStatus.status}`} role="status">
                      {copyStatus.message}
                    </span>
                  )}
                </div>
                <pre className="optimized-solidity-code"><code>{generateOptimizedStruct(analysis)}</code></pre>
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


export function StorageLabSection() {
  const [activeSubTab, setActiveSubTab] = useState('analyzer');

  return (
    <div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={activeSubTab === 'analyzer'} className={`tab ${activeSubTab === 'analyzer' ? 'is-active' : ''}`} onClick={() => setActiveSubTab('analyzer')}>
          Struct analyzer
        </button>
        <button role="tab" aria-selected={activeSubTab === 'inspector'} className={`tab ${activeSubTab === 'inspector' ? 'is-active' : ''}`} onClick={() => setActiveSubTab('inspector')}>
          Layout inspector
        </button>
      </div>

      {activeSubTab === 'analyzer' ? <StructAnalyzerSection /> : <StorageInspectorSection />}
    </div>
  );
}

