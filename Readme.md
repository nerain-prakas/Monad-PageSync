# PageSync

PageSync is an on-chain market intelligence dashboard for the Monad Testnet MON/USDC market. Kuru remains the trading venue; PageSync makes market activity, wallet activity, and measured storage/gas evidence easier to understand.

## What it does

Solidity structs are laid out in 32-byte storage slots. Small type choices and field ordering can create packing opportunities, but changing a deployed layout can also break storage compatibility. PageSync makes those trade-offs visible before deployment.

The product has these surfaces:

- **Overview** — public market context, best bid/ask, activity preview, wallet entry point, and measured storage evidence.
- **Markets** — MON/USDC market state and simple order-book explanations.
- **Activity** — separate Kuru venue events and PageSync reference-contract events indexed by Envio.
- **My Orders** — optional wallet-scoped activity; connecting is not required for public market intelligence.
- **Watch** — lightweight market monitoring view.
- **Gas & Storage** — measured receipt benchmark and packed-storage comparison.
- **Developer Tools** — the technical tools below.

- **Struct Analyzer** — paste a supported struct and inspect slots, byte offsets, packing groups, and unused space.
- **Storage Inspector** — inspect the verified layouts of the deployed NaiveOrderBook and PageSyncOrderBook contracts.
- **Gas Benchmark** — compare receipt-based gas measurements from the controlled Monad Testnet workload.
- **Research** — explore the PageSync packed-storage case study and its limitations.
- **Kuru Market** — optional funding and trading workspace for the live Monad Testnet MON-USDC market.

## Architecture

```text
React/Vite frontend
  ├── client-side struct analysis
  ├── known storage inspection
  ├── saved receipt benchmark results
  ├── Kuru market status, funding, limit orders, and event tracking
  └── research visualization
          │
          ├── Solidity contracts / Foundry scripts
          └── Node/Express API → Envio analytics (optional, when the indexer is running)
```

Envio indexes order-book events for analytics. It does not measure individual SLOAD/SSTORE costs or replace transaction receipts as the benchmark source.

## Research: NaiveOrderBook vs PageSyncOrderBook

The research compares the same order-book operations against:

- `NaiveOrderBook`: an `Order` struct occupying four compiled storage slots. `trader`, `price`, and `quantity` occupy words; `side` and `status` share the fourth word.
- `PageSyncOrderBook`: a packed representation occupying two storage words. `data1` contains trader/price information and `data2` contains quantity/flags.

Both implementations still use mapping-based storage. PageSync does not contain an explicit page allocator, and the experiment does not prove a separate Monad storage-page warming mechanism.

### Verified Monad Testnet result

The repeated benchmark used three fresh workloads, 30 transactions total, and actual receipt `gasUsed` on chain ID `10143`. All 30 receipts returned status `1`.

> Across three repeated Monad Testnet workloads, PageSyncOrderBook showed approximately **20.42% lower median total receipt gas** than NaiveOrderBook.

| Operation | Naive median | PageSync median | Difference |
|---|---:|---:|---:|
| Placement | 99,870 | 81,986 | 17.91% lower |
| Second placement | 116,950 | 81,998 | 29.89% lower |
| Update | 36,030 | 36,394 | 1.01% higher |
| Cancel | 51,769 | 34,806 | 32.77% lower |
| Execute | 35,273 | 35,294 | 0.06% higher |

The result is workload-specific. It supports a measurable benefit from the packed representation, not a universal gas guarantee.

## Tech stack

- Solidity `0.8.24` and Foundry
- React 19, Vite, and Three.js
- Node.js/Express backend
- Envio event indexing
- Monad Testnet

## Local development

```powershell
cd frontend
npm install
npm run dev
```

The frontend can be built with:

```powershell
cd frontend
npm run build
npm run lint
```

Contract validation:

```powershell
forge build
forge test
```

The backend is optional for the client-side tools:

```powershell
cd backend
npm install
npm start
```

The Activity page calls the backend at `http://localhost:3001`. Start Envio separately
from the `envio` directory after installing the Envio CLI and completing its project
dependencies. If the backend or indexer is unavailable, the UI reports that state rather
than presenting empty activity as verified history.

## Monad Testnet

The deployed contracts are:

- NaiveOrderBook: `0x9eDDb8B7612954014Af0fFA58dc9d93dB2C75d68`
- PageSyncOrderBook: `0x5De52bC09A2A688f6c4615099465e9049CC83bC1`

Monad Testnet chain ID is `10143`. Keep `MONAD_RPC_URL` and `PRIVATE_KEY` in a local ignored `.env` file only. Never place wallet credentials in README files, source code, benchmark artifacts, or commits.

### Kuru testnet workspace

The Kuru workspace connects to the documented MON-USDC market:

- Market: `0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9`
- Quote asset: USDC
- Base asset: MON
- Settlement model: Kuru margin account
- Funding: ERC-20 approval plus verified USDC/native MON margin deposits
- Orders: validated post-only limit orders and batch cancellation
- Tracking: recent `OrderCreated`, `Trade`, and `OrdersCanceled` events from the market

The UI shows wallet, network, allowance, wallet balances, and margin balances explicitly.
Transactions are sent only to the Kuru market or MarginAccount and are shown as successful
only after a Monad Testnet receipt confirms them. Use a testnet wallet and review each
wallet prompt carefully. The PageSync reference market continues to be used only for
storage-optimization experiments.

## Limitations and roadmap

PageSync is a developer benchmark/tool, not a production exchange. It does not handle real money, guarantee savings, or automatically rewrite deployed storage. Generic storage inspection requires a contract ABI and compiler storage layout; an address alone is not enough.

Future work includes broader Solidity type support, more networks, generic ABI/layout inspection,
saved analyses, optional wallet-authorized live benchmarks, deeper Kuru book data, and richer
Envio-powered fill/cancellation analytics.
