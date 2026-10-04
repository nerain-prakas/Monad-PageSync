import { useRef, useCallback } from 'react';

/**
 * 6.1 KPI StatCard (Aurora Glassmorphism)
 * - Glass panel with cursor sheen tracking
 * - Sora display font for numbers with gradient text option
 * - JetBrains Mono delta indicator
 * - 1.5px gradient stroke sparkline with soft translucent area fill
 */
export default function StatCard({
  label,
  value,
  subValue,
  delta,
  deltaType = 'positive', // 'positive' | 'negative' | 'neutral'
  sparklineData = [12, 18, 14, 22, 19, 28, 25, 32],
  isGradientValue = false,
  badgeText = null,
  icon = null,
}) {
  const cardRef = useRef(null);
  const frameRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      cardRef.current.style.setProperty('--mx', `${x}px`);
      cardRef.current.style.setProperty('--my', `${y}px`);
    });
  }, []);

  // Generate SVG path for sparkline
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const width = 160;
  const height = 44;
  const padding = 4;

  const points = sparklineData.map((val, idx) => {
    const x = padding + (idx / (sparklineData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width - padding},${height} L ${padding},${height} Z`;
  const lastPoint = points[points.length - 1].split(',');

  const isGreen = deltaType === 'positive';
  const isRed = deltaType === 'negative';
  const deltaColor = isGreen ? 'var(--success)' : isRed ? 'var(--danger)' : 'var(--accent-2)';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="glass-panel card-hover card-sheen stat-card glass-enter"
      style={{ padding: 'var(--space-4) var(--space-5)' }}
    >
      <div className="stat-card__header">
        <div className="stat-card__title-group">
          {icon && <span className="stat-card__icon">{icon}</span>}
          <span className="text-micro" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
        {badgeText && (
          <span className="glass-chip" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
            <span className="glass-chip__dot glass-chip__dot--live" />
            {badgeText}
          </span>
        )}
      </div>

      <div className="stat-card__body">
        <div className="stat-card__values">
          <div className={`stat-card__value ${isGradientValue ? 'text-gradient' : ''}`}>
            {value}
          </div>
          {delta && (
            <div className="stat-card__delta text-data" style={{ color: deltaColor }}>
              <span>{isGreen ? '▲' : isRed ? '▼' : '●'}</span>
              <span>{delta}</span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        <div className="stat-card__sparkline" aria-hidden="true">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`grad-line-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
              <linearGradient id={`grad-area-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill={`url(#grad-area-${label.replace(/\s+/g, '')})`}
            />
            <path
              d={linePath}
              fill="none"
              stroke={`url(#grad-line-${label.replace(/\s+/g, '')})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={lastPoint[0]}
              cy={lastPoint[1]}
              r="3.5"
              fill="var(--accent-2)"
              style={{ filter: 'drop-shadow(0 0 6px var(--accent-2))' }}
            />
          </svg>
        </div>
      </div>

      {subValue && (
        <div className="stat-card__footer text-micro" style={{ marginTop: 'var(--space-2)' }}>
          {subValue}
        </div>
      )}
    </div>
  );
}
