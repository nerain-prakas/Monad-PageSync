// Render free web services sleep after ~15 minutes without inbound HTTP traffic,
// which would stop the indexer. Request our own public /healthz (served by Envio)
// through Render's router every 10 minutes so the service stays awake.
// Does nothing outside Render (RENDER_EXTERNAL_URL unset).
const base = process.env.RENDER_EXTERNAL_URL;
const INTERVAL_MS = 10 * 60 * 1000;

if (base) {
  const ping = async () => {
    try {
      const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(30_000) });
      console.log(`[keepalive] ${res.status}`);
    } catch (err) {
      console.log(`[keepalive] failed: ${err.message}`);
    }
  };
  setTimeout(() => {
    void ping();
    setInterval(() => void ping(), INTERVAL_MS);
  }, 5 * 60 * 1000);
}
