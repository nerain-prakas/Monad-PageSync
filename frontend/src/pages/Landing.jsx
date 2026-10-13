import { useEffect, useRef, useState } from 'react';
import CinematicScene from '../components/CinematicScene';

const DOORS = [
  { to: '/lab', n: '01', title: 'Storage Lab', line: 'Paste a struct. See every slot, offset and wasted byte.' },
  { to: '/evidence', n: '02', title: 'Evidence', line: '30 Monad Testnet receipts. One measured result.' },
  { to: '/market', n: '03', title: 'Market', line: 'Kuru order book, live on Monad Testnet.' },
  { to: '/activity', n: '04', title: 'Activity', line: 'Every indexed order and trade, straight from Envio.' },
  { to: '/docs', n: '05', title: 'Docs', line: 'How to use the site, step by step.' },
];

/** Adds `.in` once the element scrolls into view. */
function useInView() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('in');
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function CountUp({ to, decimals = 2, active }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / 1600, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active]);
  return v.toFixed(decimals);
}

function SlotDiagram({ slots, label }) {
  return (
    <div className="slotviz">
      <span className="slotviz__label">{label}</span>
      <div className="slotviz__rows">
        {slots.map((fill, i) => (
          <div className="slotviz__slot" key={i} style={{ '--fill': `${fill}%`, '--d': `${i * 120}ms` }}>
            <i />
          </div>
        ))}
      </div>
    </div>
  );
}

function Chapter({ index, kicker, children }) {
  const ref = useInView();
  return (
    <section className="chapter" ref={ref}>
      <div className="chapter__inner">
        <span className="mono chapter__kicker">{index} &mdash; {kicker}</span>
        {children}
      </div>
    </section>
  );
}

export default function Landing({ go }) {
  const evRef = useInView();
  const [evOn, setEvOn] = useState(false);
  useEffect(() => {
    const el = evRef.current;
    if (!el) return undefined;
    const mo = new MutationObserver(() => setEvOn(el.classList.contains('in')));
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [evRef]);

  return (
    <div className="landing">
      <CinematicScene />

      <section className="hero">
        <span className="mono hero__eyebrow">Smart-contract storage optimiser &middot; Monad Testnet</span>
        <h1 className="hero__title">
          <span>Pack</span>
          <span>the struct.</span>
          <span className="ghost">Cut the gas.</span>
        </h1>
        <div className="hero__cta">
          <button className="btn btn--solid" onClick={() => go('/lab')}>Open the Lab</button>
          <button className="btn" onClick={() => go('/evidence')}>See the evidence</button>
        </div>
        <span className="mono hero__scroll">Scroll</span>
      </section>

      <Chapter index="01" kicker="The problem">
        <h2 className="chapter__title">Four slots.<br />Every write pays for each.</h2>
        <SlotDiagram label="NaiveOrderBook" slots={[62, 100, 100, 6]} />
      </Chapter>

      <Chapter index="02" kicker="The method">
        <h2 className="chapter__title">Same order.<br />Two slots.</h2>
        <SlotDiagram label="PageSyncOrderBook" slots={[100, 100]} />
      </Chapter>

      <section className="chapter chapter--evidence" ref={evRef}>
        <div className="chapter__inner">
          <span className="mono chapter__kicker">03 &mdash; The evidence</span>
          <div className="bignum">
            &minus;<CountUp to={20.42} active={evOn} />
            <small>%</small>
          </div>
          <p className="chapter__note mono">
            Median total receipt gas &middot; 30 of 30 receipts succeeded &middot; Monad Testnet 10143.
            A workload-specific result &mdash; both contracts remain mapping-based.
          </p>
        </div>
      </section>

      <section className="doors" aria-label="Explore">
        {DOORS.map((d) => (
          <button className="door" key={d.to} onClick={() => go(d.to)}>
            <span className="mono door__n">{d.n}</span>
            <span className="door__title">{d.title}</span>
            <span className="door__line">{d.line}</span>
            <span className="door__arrow" aria-hidden="true">&rarr;</span>
          </button>
        ))}
      </section>

      <section className="finale">
        <span className="mono">A storage study on</span>
        <div className="finale__word" aria-hidden="true">MONAD</div>
        <span className="mono">Testnet &middot; Chain 10143 &middot; Not for production use</span>
      </section>
    </div>
  );
}
