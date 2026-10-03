Monad-PageSync
Product Requirements Document (PRD)

Version: 1.0
Status: Hackathon MVP
Target Network: Monad Testnet
Main Track: Onchain Finance & Trading
Bounty Target: Envio — Best Use of Envio
Target Development Cost: ₹0

1. Product Overview
1.1 Product Name

Monad-PageSync

1.2 One-Line Description

Monad-PageSync is a Monad-native developer tool that demonstrates and measures how page-aware storage layouts can improve the efficiency of an onchain order book, while Envio provides historical order-book analytics.

1.3 Problem

Onchain trading applications store large amounts of order data.

The way this data is arranged in smart-contract storage can affect how efficiently the application accesses that data.

Monad introduces a storage-page mechanism where nearby storage slots can benefit from page warming.

However, developers need a simple way to:

Design a page-aware storage layout.
Compare it against a conventional layout.
Run the same workload.
Measure the actual gas used.
Understand the resulting performance.
Analyze the resulting onchain workload.

Currently, a developer would need to manually build these experiments.

PageSync provides a simple experimental and analytics layer for this purpose.

2. Product Goal

The primary goal is to build a working demonstration that answers:

Can a page-aware storage layout make a measurable difference for an onchain order-book workload on Monad?

The project must prove this using measured results, not assumptions.

3. Product Objectives
Objective 1 — Page-Aware Order Book

Build a simple order-book smart contract using a conventional storage layout and another using a page-aware layout.

Objective 2 — Fair Benchmark

Run the same workload against both implementations.

Objective 3 — Measure

Measure:

Gas consumed
Average gas per operation
Total gas
Operation-level gas differences
Objective 4 — Envio Analytics

Emit structured order-book events and use Envio to index and query those events.

Objective 5 — Developer Dashboard

Create a simple React dashboard that displays:

Benchmark results
Order activity
Trading activity
Historical events
PageSync comparison
4. Non-Goals

The following are explicitly outside the MVP.

4.1 No Production Exchange

PageSync is a research/demo order book.

It is not intended to compete with production exchanges.

4.2 No Real-Value Trading

Only testnet transactions should be used.

4.3 No Monad Full Node

The project will not require running a Monad validator/full node.

4.4 No Opcode-Level Conflict Detection

PageSync will not attempt to expose Monad's internal SLOAD/SSTORE execution conflicts.

4.5 No Cross-Chain Trading

Cross-chain functionality is outside the MVP.

4.6 No AI Dependency

AI must not be required for the core application.

4.7 No Forced Bounty Integrations

Additional integrations will only be added when they provide real value.

5. Target Users
Primary User
Smart Contract / DeFi Developer

A developer building an application on Monad who wants to understand whether their storage layout can be optimized.

Secondary User
Hackathon Judge

A judge should be able to understand:

What problem PageSync solves.
What Monad-specific feature it uses.
How the benchmark works.
What Envio contributes.
What improvement was actually measured.
6. Core Product Concept

PageSync consists of two major components.

                 Monad
                   |
        +----------+----------+
        |                     |
   Naive OrderBook       PageSync OrderBook
        |                     |
        +----------+----------+
                   |
              Same Workload
                   |
              Gas Benchmark
                   |
          +--------+--------+
          |                 |
       Results          Events
                            |
                          Envio
                            |
                       Analytics
                            |
                       React UI
7. Functional Requirements
FR-01 — Create Order

The system must allow a user/test script to create an order.

Required fields
Order ID
Trader address
Price
Quantity
Side
Status
Example
Order ID: 101
Trader: 0x123...
Price: 1000
Quantity: 10
Side: BUY
Status: ACTIVE
8. FR-02 — Update Order

The system must allow an existing order to be updated.

Example:

Order #101

Before:
Price = 1000
Quantity = 10

After:
Price = 1010
Quantity = 15
9. FR-03 — Cancel Order

The system must allow an active order to be cancelled.

ACTIVE
   ↓
CANCELLED
10. FR-04 — Execute Trade

The system must allow an order to be marked as executed.

ACTIVE
   ↓
EXECUTED

The MVP does not require a complete matching engine.

11. FR-05 — Naive Storage Implementation

Create a baseline order-book contract.

Example conceptual structure:

mapping(uint256 => Order) public orders;

The purpose is to provide a conventional baseline.

12. FR-06 — PageSync Storage Implementation

Create a second contract whose storage layout is deliberately designed around Monad's storage-page behavior.

The implementation must document:

Storage slot arrangement.
Frequently accessed fields.
Expected storage locality.
Why the layout is different from the baseline.
Important rule

The project must not assume a fixed percentage of gas savings.

The actual benchmark result will determine the improvement.

13. FR-07 — Identical Workload

The same workload must be executed against both contracts.

Example MVP workload:

100 order placements
100 order updates
50 cancellations
50 executions

The exact workload may be adjusted during benchmarking.

The important requirement is:

Both implementations must receive the same workload.

14. FR-08 — Gas Measurement

The benchmark must record:

Total gas
Average gas
Minimum gas
Maximum gas
Gas per operation

For each operation:

placeOrder
updateOrder
cancelOrder
executeTrade
15. FR-09 — Benchmark Comparison

The system must calculate:

Absolute Difference

Naive Gas - PageSync Gas

and:

Percentage Difference

((Naive Gas - PageSync Gas) / Naive Gas) × 100

The dashboard must clearly state that this is a measured benchmark result.

16. FR-10 — Event Emission

Both order-book contracts must emit structured events.

OrderPlaced
event OrderPlaced(
    uint256 indexed orderId,
    address indexed trader,
    uint256 price,
    uint256 quantity
);
OrderUpdated
event OrderUpdated(
    uint256 indexed orderId,
    uint256 price,
    uint256 quantity
);
OrderCancelled
event OrderCancelled(
    uint256 indexed orderId
);
TradeExecuted
event TradeExecuted(
    uint256 indexed orderId,
    uint256 price,
    uint256 quantity
);
17. FR-11 — Envio Integration

Envio must be used to index the order-book events.

Envio should provide historical application data such as:

Orders created
Orders updated
Orders cancelled
Trades executed
Trading activity
Block-level activity
Important

Envio is not responsible for reading SLOAD/SSTORE operations.

It is responsible for indexing the application's emitted blockchain events.

18. FR-12 — Envio Query Layer

The application must be able to retrieve indexed data from Envio.

Example queries:

Get recent orders
Get order by ID
Get recent trades
Get total trades
Get total orders
Get order activity
19. FR-13 — Dashboard

The project must provide a web dashboard.

Dashboard sections
1. Overview
2. Benchmark
3. Order Activity
4. Trade Activity
5. Envio Data
6. Storage Explanation
20. Dashboard — Overview

Display:

PageSync

Monad Order-Book Storage Optimizer

Total Orders
Total Trades
Total Updates
Total Gas
Measured Improvement
21. Dashboard — Benchmark

Display a comparison table.

Operation	Naive	PageSync	Difference
Place Order	Actual	Actual	Actual
Update Order	Actual	Actual	Actual
Cancel Order	Actual	Actual	Actual
Execute Trade	Actual	Actual	Actual
Total	Actual	Actual	Actual

The values must come from the benchmark.

22. Dashboard — Envio Analytics

Display:

Orders Created
Orders Updated
Orders Cancelled
Trades Executed

Optional charts:

Orders over time
Trades over time
Activity by block
Order status distribution
23. Dashboard — Storage Explanation

The dashboard should explain the concept in simple language.

Example:

Traditional Layout

Order data is stored using a conventional layout.

        ↓

PageSync Layout

Frequently accessed storage data is deliberately
organized with Monad's storage-page behavior in mind.

        ↓

Benchmark

Both layouts are tested with the same workload.
24. Technical Architecture
24.1 Smart Contract Layer
Solidity
    |
    +-- NaiveOrderBook.sol
    |
    +-- PageSyncOrderBook.sol
24.2 Benchmark Layer
Foundry
    |
    +-- BenchmarkNaive
    |
    +-- BenchmarkPageSync
    |
    +-- Gas Comparison
24.3 Blockchain Layer
Monad Testnet

Used for:

Contract deployment
Real transactions
Testnet gas measurement
Demonstration
24.4 Indexing Layer
Monad
   |
Events
   |
Envio
   |
Indexed Data
24.5 Application Layer
React
   |
Node.js / API
   |
Envio
25. Technology Stack
Layer	Technology
Blockchain	Monad Testnet
Smart Contracts	Solidity
Development	Foundry
Indexing	Envio
Backend	Node.js
Frontend	React + Vite
Language	JavaScript/TypeScript
Version Control	Git/GitHub
26. Cost Requirements

The project should be developed with a target cost of:

₹0
Required infrastructure
Component	Expected Cost
Monad Testnet	₹0
Testnet MON	₹0
Solidity	₹0
Foundry	₹0
React	₹0
Node.js	₹0
Envio development tier	₹0
Local testing	₹0

No paid infrastructure should be required for the MVP.

27. Bounty Requirement — Envio
Target Bounty

Envio — Best Use of Envio

Requirement

Envio must be a meaningful part of the product.

Minimum implementation
PageSync Contracts
       ↓
Order Events
       ↓
Envio Indexing
       ↓
Historical Queries
       ↓
PageSync Dashboard
Evidence for submission

The project should clearly demonstrate:

Envio configuration.
Monad network configuration.
Event handlers.
Indexed data.
Queries.
Dashboard using Envio data.
Important

Do not claim:

"Envio reads SLOAD/SSTORE."

Instead:

"Envio indexes PageSync's order-book events and provides the historical analytics layer."

28. Main Track Requirement
Onchain Finance & Trading

The project should demonstrate a clear connection to onchain finance.

The order book provides this connection.

The project should demonstrate:

Order
 ↓
Onchain storage
 ↓
Order update
 ↓
Trade execution
 ↓
Historical analytics

The storage optimization is applied to a trading-related workload rather than an arbitrary storage benchmark.

29. Security Requirements

The MVP must include basic protections.

Order ownership

Only the order owner should be able to:

Update their order.
Cancel their order.
Input validation

Reject:

Zero quantity.
Invalid price.
Invalid order ID.
Invalid status transitions.
Reentrancy

If external calls are introduced, use appropriate protection.

Prefer avoiding unnecessary external calls in the MVP.

30. Data Requirements

The system should record:

Order ID
Trader
Price
Quantity
Side
Status
Block Number
Transaction Hash
Timestamp

Envio should provide historical blockchain-related fields where available.

31. Performance Requirements

The benchmark must support enough transactions to demonstrate a meaningful workload.

Minimum target:

100+ orders
100+ updates
50+ cancellations
50+ executions

Stretch target:

1,000+ total operations

The exact final workload depends on testnet limits and benchmark results.

32. Correctness Requirements

The Naive and PageSync implementations must produce equivalent logical results.

For the same input:

Order ID
Price
Quantity
Trader
Operation

both implementations must result in the same logical order state.

The only intended difference is the underlying storage organization.

33. Benchmark Fairness

The benchmark must ensure:

Same
Solidity compiler version
Compiler optimization settings
Workload
Number of operations
Operation order
Input values
Network conditions where practical
Different

Only:

Storage layout

This makes the comparison meaningful.

34. Success Metrics

The project is considered successful if:

Technical

Both contracts compile.

Both contracts deploy.

Both contracts execute correctly.

Identical workload can run against both.

Gas measurements are collected.

Events are emitted.

Envio indexes the events.

Dashboard retrieves Envio data.

Product

A developer can understand the storage comparison.

A judge can see the benchmark.

A judge can see Envio being used.

The project has a clear Monad-specific reason to exist.

Evidence

Real benchmark results.

Transaction hashes.

Contract addresses.

Envio configuration.

Screenshots/video of dashboard.

35. MVP Acceptance Criteria

The MVP is complete when the following flow works:

Deploy NaiveOrderBook
        ↓
Deploy PageSyncOrderBook
        ↓
Run identical workload
        ↓
Collect gas measurements
        ↓
Calculate comparison
        ↓
Emit order events
        ↓
Envio indexes events
        ↓
React dashboard displays results

If this entire flow works, the project is considered MVP-complete.

36. Development Phases
Phase 1 — Research Validation

Before building the UI:

Verify Monad MIP-8 behavior.
Verify the intended storage layout.
Create a tiny storage benchmark.
Measure whether the proposed layout produces a difference.
Decision Gate

If the difference is not meaningful:

Stop and redesign the storage layout.

Do not continue building the dashboard before this is validated.

37. Phase 2 — Smart Contracts

Build:

NaiveOrderBook.sol
PageSyncOrderBook.sol

Implement:

placeOrder()
updateOrder()
cancelOrder()
executeTrade()
38. Phase 3 — Benchmark

Create Foundry benchmark tests.

Example:

Benchmark 1
100 placements

Benchmark 2
100 updates

Benchmark 3
50 cancellations

Benchmark 4
50 executions

Generate gas reports.

39. Phase 4 — Monad Testnet

Deploy both contracts.

Record:

Contract addresses
Transaction hashes
Block numbers
Gas used
40. Phase 5 — Envio

Configure Envio for Monad.

Create handlers for:

OrderPlaced
OrderUpdated
OrderCancelled
TradeExecuted

Verify that the events are indexed correctly.

41. Phase 6 — Backend

Create a small API layer if required.

Example:

GET /orders
GET /orders/:id
GET /trades
GET /stats
GET /benchmark

Keep the backend as small as possible.

42. Phase 7 — React Dashboard

Build the dashboard.

Priority:

Benchmark comparison
        ↓
Envio analytics
        ↓
Order activity
        ↓
Visual polish

Do not spend excessive time on animations.

43. Phase 8 — Final Demo

Prepare:

Demo 1

Deploy/show contracts.

Demo 2

Run benchmark.

Demo 3

Show measured gas difference.

Demo 4

Show Envio indexing.

Demo 5

Show dashboard.

Demo 6

Explain the Monad storage-page concept.

44. Optional Features

Only implement these if the MVP is finished.

Optional 1 — PageSync Copilot

AI explains storage layouts.

Contract
   ↓
Storage analysis
   ↓
Possible page-locality opportunities
   ↓
Human-readable explanation
Optional 2 — Storage Visualizer

Show:

Storage Slot 0
Storage Slot 1
Storage Slot 2
...
Storage Slot 127

and visually show which slots are accessed.

Optional 3 — Workload Generator

Allow users to choose:

100 orders
500 orders
1,000 orders

and run a benchmark.

45. Features Explicitly Deferred

These should not be attempted until the MVP works:

Full production exchange.
Real money trading.
Cross-chain settlement.
AI autonomous trading.
Liquidation engine.
Monad full node.
Opcode-level execution tracing.
Complex matching engine.
Multiple external bounty integrations.
46. Repository Structure

Recommended structure:

monad-pagesync/
│
├── contracts/
│   ├── NaiveOrderBook.sol
│   ├── PageSyncOrderBook.sol
│   └── interfaces/
│
├── test/
│   ├── OrderBook.t.sol
│   ├── PageSync.t.sol
│   └── Benchmark.t.sol
│
├── script/
│   ├── DeployNaive.s.sol
│   └── DeployPageSync.s.sol
│
├── envio/
│   ├── config.yaml
│   ├── schema.graphql
│   └── handlers/
│
├── backend/
│   └── server.js
│
├── frontend/
│   ├── src/
│   ├── components/
│   └── pages/
│
├── benchmark/
│   └── results/
│
├── docs/
│   ├── architecture.md
│   └── benchmark.md
│
├── README.md
└── PRD.md
47. README Requirements

The final README must contain:

Problem.
Solution.
Why Monad.
Why storage pages.
Architecture.
Benchmark methodology.
Actual results.
Envio integration.
Setup instructions.
Contract addresses.
Demo link.
Screenshots.
Limitations.
Future work.
48. Important Claims Policy

The project must avoid unsupported claims.

Do NOT say:

"PageSync provides 90% gas savings."

Unless our benchmark actually demonstrates it.

Do NOT say:

"Envio detects SLOAD/SSTORE conflicts."

It does not provide that functionality.

Do NOT say:

"PageSync makes Monad faster."

The project measures application-level storage behavior; it does not modify Monad itself.

Do say:

"PageSync measures the effect of a page-aware storage layout on our order-book workload."

49. Final Product Definition

At completion, PageSync should be:

A working Monad testnet order-book benchmark and analytics tool that compares conventional and page-aware storage layouts, measures their actual gas behavior, and uses Envio to index and visualize the resulting onchain workload.

50. Final MVP in One Diagram
                    USER
                     |
                     ▼
              React Dashboard
                     |
          +----------+----------+
          |                     |
          ▼                     ▼
    Benchmark Data         Envio Data
          |                     |
          |                     ▼
          |               Indexed Events
          |                     |
          ▼                     |
    Foundry Tests              |
          |                     |
     +----+----+                |
     |         |                |
     ▼         ▼                |
   Naive    PageSync            |
   Book       Book              |
     |         |                |
     +----+----+                |
          |                     |
          ▼                     |
       Monad Testnet <----------+
51. Definition of Done

Monad-PageSync is DONE when:

Naive order book works.

PageSync order book works.

Both use equivalent functionality.

Page-aware storage layout is documented.

Same workload runs on both.

Gas measurements are collected.

Actual difference is calculated.

Contracts are deployed on Monad Testnet.

Order events are emitted.

Envio indexes the events.

Dashboard displays Envio data.

Dashboard displays benchmark results.

README explains the architecture.

Demo can be completed in approximately 2–3 minutes.

No paid infrastructure is required for the MVP.

52. Core Philosophy

Build the smallest thing that proves the idea.

Don't start with:
AI + Perpl + Chainlink + Nansen + Cross-chain

Start with:

Storage Layout
      ↓
Order Book
      ↓
Benchmark
      ↓
Real Result
      ↓
Envio
      ↓
Dashboard

The benchmark result is the heart of PageSync.

Everything else exists to make that result understandable and useful.