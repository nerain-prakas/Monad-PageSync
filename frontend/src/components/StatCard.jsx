/**
 * Neo-Brutalist StatCard
 * - Solid opaque slab with 2px ink border
 * - Hard offset shadow: 4px 4px 0px #000
 * - High-impact display font with solid delta pill
 * - High-contrast angular sparkline
 */
export default function StatCard({
  label,
  value,
  subValue,
  delta,
  deltaType = 'positive',
  sparklineData = [12, 18, 14, 22, 19, 28, 25, 32],
  badgeText = null,
  icon = null,
}) {
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const width = 120;
  const height = 36;
  const padding = 2;

  const points = sparklineData.map((val, idx) => {
    const x = padding + (idx / (sparklineData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const isGreen = deltaType === 'positive';
  const isRed = deltaType === 'negative';

  return (
    <div className="brutalist-stat-card">
      <div className="stat-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon && <span style={{ fontSize: '0.95rem' }}>{icon}</span>}
          <span className="stat-card-label">{label}</span>
        </div>
        {badgeText && (
          <span className="brutalist-badge brutalist-badge--volt" style={{ fontSize: '0.65rem' }}>
            {badgeText}
          </span>
        )}
      </div>

      <div className="stat-card-val-row">
        <div className="stat-card-val">{value}</div>

        {/* Angular Sparkline */}
        <div style={{ width: '100px', height: '32px', flexShrink: 0 }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
            <path
              d={linePath}
              fill="none"
              stroke={isGreen ? 'var(--accent-volt)' : isRed ? 'var(--accent-pink)' : 'var(--accent-cyan)'}
              strokeWidth="2.5"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </svg>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {delta && (
          <span
            className={`brutalist-badge ${
              isGreen ? 'brutalist-badge--volt' : isRed ? 'brutalist-badge--pink' : 'brutalist-badge--cyan'
            }`}
            style={{ fontSize: '0.72rem' }}
          >
            {isGreen ? '▲' : isRed ? '▼' : '●'} {delta}
          </span>
        )}
        {subValue && (
          <span className="stat-card-sub" style={{ margin: 0, padding: 0, border: 'none', textAlign: 'right' }}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}
