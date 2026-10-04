/**
 * 6.7 Toggle / Switch (GlassSwitch)
 * - Track: .glass-well pill, 44×24px
 * - Thumb: frosted white circle with a soft shadow
 * - On state: track fills with accent gradient and a faint glow; thumb slides 20px over 200ms
 */
export default function GlassSwitch({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="glass-switch-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`glass-switch ${checked ? 'glass-switch--on' : ''}`}
      >
        <span className="glass-switch__thumb" />
      </button>
      {label && <span className="text-micro" style={{ color: 'var(--text-secondary)' }}>{label}</span>}
    </label>
  );
}
