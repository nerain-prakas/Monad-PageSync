# Repeated Monad Testnet Receipt Benchmark

All measurements are transaction receipt gasUsed values. Receipt status was 1 for every transaction.

## Per-operation medians

| Operation | Naive Median | PageSync Median | Gas Difference | % Difference |
|---|---:|---:|---:|---:|
| Placement | 99870 | 81986 | 17884 | 17.91% |
| Second Placement | 116950 | 81998 | 34952 | 29.89% |
| Update | 36030 | 36394 | -364 | -1.01% |
| Cancel | 51769 | 34806 | 16963 | 32.77% |
| Execute | 35273 | 35294 | -21 | -0.06% |

## Per-run totals

| Run | Naive Total | PageSync Total | % Difference |
|---:|---:|---:|---:|
| 1 | 339892 | 270478 | 20.42% |
| 2 | 358751 | 289337 | 19.35% |
| 3 | 339892 | 270478 | 20.42% |

## Aggregate

| Contract | Total across runs | Average total/run | Median total/run |
|---|---:|---:|---:|
| NaiveOrderBook | 1038535 | 346178.33 | 339892 |
| PageSyncOrderBook | 830293 | 276764.33 | 270478 |

Overall percentage difference: **20.05% lower for PageSyncOrderBook**.

This measures the packed-storage implementation for this workload; it does not establish an explicit Monad storage-page locality or warming mechanism.
