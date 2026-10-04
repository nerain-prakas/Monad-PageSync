import { useEffect, useRef } from 'react';

/**
 * Dynamic Neo-Brutalist Canvas Background
 * - Animated infinite-scroll technical blueprint grid with coordinate crosshairs
 * - Drifting Monad data packets and floating architectural memory tags
 * - Interactive reactive cursor aura and smooth parallax tracking (lerp)
 * - Industrial radar sweep line
 * - Auto-pauses on visibility hidden for 144+ FPS battery efficiency
 */
export default function DynamicBackground({ theme = 'brutalist-dark' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with smooth lerp
    const mouse = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2 };

    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Technical floating memory particles (crosshairs, hex addresses, and packets)
    const particleCount = 42;
    const isDark = theme !== 'brutalist-light';
    const colors = isDark
      ? ['#836ef9', '#00f0ff', '#bef264', '#ff2a85', '#9ca3af']
      : ['#7461fa', '#0284c7', '#84cc16', '#e11d48', '#6b7280'];

    const memoryCodes = ['0x4A1E', 'PAGE_4K', 'SLOT_00', 'WARM_HIT', 'SLOT_01', 'ASYNC_IO', 'MONAD_DB', 'SLOT_127'];

    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 4 + 3,
      speedX: (Math.random() - 0.5) * 0.45,
      speedY: (Math.random() - 0.5) * 0.45 - 0.18, // subtle upward drift
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.random() > 0.55 ? 'cross' : Math.random() > 0.3 ? 'square' : 'text',
      text: memoryCodes[Math.floor(Math.random() * memoryCodes.length)],
      alpha: Math.random() * 0.45 + 0.15,
      alphaSpeed: (Math.random() * 0.008 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
    }));

    let gridOffset = 0;
    let scanlineY = 0;

    // Animation Loop
    const render = () => {
      animId = requestAnimationFrame(render);

      // Lerp mouse
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      const parallaxX = (mouse.x - width / 2) * 0.03;
      const parallaxY = (mouse.y - height / 2) * 0.03;

      // Base Canvas Fill
      const isDarkTheme = theme !== 'brutalist-light';
      ctx.fillStyle = isDarkTheme ? '#090a10' : '#f4f2ea';
      ctx.fillRect(0, 0, width, height);

      // ── 1. Interactive Cursor Radial Aura ──────────────────────────────────
      const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 240);
      mouseGlow.addColorStop(0, isDarkTheme ? 'rgba(131, 110, 249, 0.08)' : 'rgba(2, 132, 199, 0.06)');
      mouseGlow.addColorStop(0.5, isDarkTheme ? 'rgba(0, 240, 255, 0.025)' : 'rgba(116, 97, 250, 0.02)');
      mouseGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = mouseGlow;
      ctx.fillRect(0, 0, width, height);

      // ── 2. Animated Technical Grid ─────────────────────────────────────────
      const gridSize = 40;
      gridOffset = (gridOffset + 0.25) % gridSize;

      ctx.lineWidth = 1;
      ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';

      // Vertical grid lines with mouse parallax
      const startX = ((parallaxX % gridSize) + gridSize) % gridSize;
      for (let x = startX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal grid lines with infinite downward glide
      const startY = ((gridOffset + parallaxY) % gridSize + gridSize) % gridSize;
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // ── 3. Major Blueprint Grid Crosshairs (+) ─────────────────────────────
      const majorStep = 160;
      ctx.strokeStyle = isDarkTheme ? 'rgba(131, 110, 249, 0.22)' : 'rgba(0, 0, 0, 0.16)';
      ctx.lineWidth = 1.2;
      const majorStartX = ((parallaxX % majorStep) + majorStep) % majorStep;
      const majorStartY = ((gridOffset + parallaxY) % majorStep + majorStep) % majorStep;
      for (let mx = majorStartX; mx < width; mx += majorStep) {
        for (let my = majorStartY; my < height; my += majorStep) {
          ctx.beginPath();
          ctx.moveTo(mx - 4, my);
          ctx.lineTo(mx + 4, my);
          ctx.moveTo(mx, my - 4);
          ctx.lineTo(mx, my + 4);
          ctx.stroke();
        }
      }

      // ── 4. Radar Scanline Sweep ────────────────────────────────────────────
      scanlineY = (scanlineY + 1.2) % (height + 200);
      const gradient = ctx.createLinearGradient(0, scanlineY - 140, 0, scanlineY);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.7, isDarkTheme ? 'rgba(131, 110, 249, 0.035)' : 'rgba(116, 97, 250, 0.025)');
      gradient.addColorStop(1, isDarkTheme ? 'rgba(0, 240, 255, 0.08)' : 'rgba(2, 132, 199, 0.06)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanlineY - 140, width, 140);

      // ── 5. Memory Telemetry Particles & Crosshairs ─────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap edges
        if (p.x < -40) p.x = width + 40;
        if (p.x > width + 40) p.x = -40;
        if (p.y < -40) p.y = height + 40;
        if (p.y > height + 40) p.y = -40;

        // Breathe alpha
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.65 || p.alpha < 0.12) p.alphaSpeed *= -1;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        const posX = p.x + parallaxX * (p.size * 0.25);
        const posY = p.y + parallaxY * (p.size * 0.25);

        if (p.type === 'cross') {
          // Tactical Crosshair (+)
          const arm = p.size + 2;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(posX - arm, posY);
          ctx.lineTo(posX + arm, posY);
          ctx.moveTo(posX, posY - arm);
          ctx.lineTo(posX, posY + arm);
          ctx.stroke();
        } else if (p.type === 'square') {
          // Solid / Hollow Memory Slot Box
          ctx.lineWidth = 1.2;
          ctx.strokeRect(posX - p.size, posY - p.size, p.size * 2, p.size * 2);
          if (p.size > 5) {
            ctx.fillRect(posX - p.size / 2, posY - p.size / 2, p.size, p.size);
          }
        } else {
          // Technical Hex Tag
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`[${p.text}]`, posX, posY);
        }

        ctx.restore();
      }

      // ── 6. Subtle Constellation Connections ────────────────────────────────
      for (let i = 0; i < particles.length; i += 2) {
        for (let j = i + 1; j < particles.length; j += 3) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;

          if (dist < 12000) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 12000) * 0.14;
            ctx.strokeStyle = isDarkTheme ? '#836ef9' : '#0284c7';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x + parallaxX, particles[i].y + parallaxY);
            ctx.lineTo(particles[j].x + parallaxX, particles[j].y + parallaxY);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // ── 7. Technical Watermark Telemetry Overlay ───────────────────────────
      ctx.save();
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.16)';
      ctx.fillText(`MONAD-PAGESYNC // LATENCY: 1.2ms // COORD [${Math.round(mouse.x)}, ${Math.round(mouse.y)}]`, 20, height - 16);
      ctx.fillText(`EVM STORAGE ENGINE // 4KB PAGE-AWARE PIPELINE`, width - 330, height - 16);
      ctx.restore();
    };

    render();

    // Sleep when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        render();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
