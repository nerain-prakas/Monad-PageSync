# PageSync — Smart Contract Storage Optimizer

## Product

PageSync is a developer utility for Solidity/Web3 developers who need to understand struct packing, inspect known contract storage layouts, and verify optimization ideas with gas measurements.

## Core features

### P0

1. Solidity Struct Analyzer with supported-type validation.
2. Slot, byte-offset, packing-group, and unused-space visualization.
3. Safe, explicit packing suggestions without silently reordering fields.
4. Copy/export actions.
5. Research page for the PageSync case study.
6. Verified Monad Testnet receipt benchmark.

### P1

1. Known-contract Storage Inspector.
2. Wallet connection only for live transaction benchmarks.
3. Interactive research visualization.

### P2

Broader Solidity types, additional chains, generic ABI/storage-layout analysis, and saved analyses.

## Research evidence

The experiment compares `NaiveOrderBook` and `PageSyncOrderBook` on Monad Testnet chain `10143`. The benchmark uses separate transactions and receipt `gasUsed`, not `gasleft()`, estimates, or gas limits.

Three repeated workloads completed successfully: 30/30 receipt statuses were `1`. PageSync showed approximately **20.42% lower median total receipt gas** than NaiveOrderBook. This is evidence for a workload-specific packed-storage benefit. Both contracts remain mapping-based; the result does not prove an explicit Monad storage-page locality or warming mechanism.

## Non-goals

- Production exchange functionality
- Real-value trading
- Guaranteed gas savings
- Universal Solidity compilation
- Automatic modification of deployed contract storage
- Treating Envio as a low-level gas profiler

## Success criteria

- A developer can paste a supported struct and receive a correct slot analysis.
- Unsupported or ambiguous constructs fail clearly.
- The known Naive/PageSync layouts are inspectable.
- The saved receipt benchmark is reproducible without exposing credentials.
- Research pages use measured values and explicitly state limitations.
