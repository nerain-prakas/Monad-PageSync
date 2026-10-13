# PageSync — Frontend

React 19 + Vite web app for PageSync. See the [root README](../Readme.md) for the project overview and research result.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Node tests for the struct-layout engine (`src/storageLayout.test.js`) |
| `npm run lint` | Oxlint |
| `npm run benchmark` | Packing gas benchmark script (`benchmarks/`) |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Backend base URL used by `src/api.js` |

The Lab, Evidence and Docs pages work without the backend. Activity and indexed stats need the backend and the Envio indexer.

## Structure

```text
src/
├─ main.jsx            entry
├─ App.jsx             shell: top nav + hash routing (#/lab, #/evidence, …)
├─ styles.css          single stylesheet / design tokens
├─ chain.js            Monad config, ABIs, contract constants, useWallet hook
├─ api.js              backend API client
├─ storageLayout.js    struct parser and slot/packing analysis
├─ solidityCompiler.js solc cross-check of analysed layouts
├─ pages/
│  ├─ Landing.jsx      cinematic landing page
│  └─ Docs.jsx         in-app documentation
├─ views/
│  ├─ StorageLab.jsx   struct analyzer + layout inspector
│  ├─ Evidence.jsx     receipts, simulation tab, live reproduction
│  └─ Market.jsx       Kuru MON/USDC workspace
└─ components/
   ├─ CinematicScene.jsx   Three.js landing backdrop
   ├─ LayoutReplay.jsx     byte-level layouts + measured gas bars
   └─ ActivityWorkspace.jsx  Envio activity feed
```

## Routes

Hash-based, so it deploys as a static site with no server rewrites: `#/` landing, `#/lab`, `#/evidence`, `#/market`, `#/activity`, `#/docs`.

## Notes

- The wallet connection uses the injected provider through viem and targets Monad Testnet (chain ID `10143`). A wallet is only needed for the live reproduction and Market orders.
- The struct analyzer supports one struct built from elementary types, one-dimensional arrays, mappings, `string` and `bytes`. User-defined and nested types are not supported and fail with a clear message.
- The 3D backdrop respects `prefers-reduced-motion`.
