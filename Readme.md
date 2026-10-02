# Monad-PageSync

### Page-Aware Storage Benchmark for Onchain Order Books

Monad-PageSync is a Monad-native developer tool that compares **conventional storage layouts** with **page-aware storage layouts** for an onchain order-book workload.

It runs the same workload on both implementations, measures the actual gas usage, and uses **Envio** to index and visualize the resulting order-book activity.

> **Goal:** Measure whether page-aware storage organization can make a measurable difference for an onchain order-book workload on Monad.

---

## 🚀 What Problem Does It Solve?

Onchain applications store large amounts of data in smart-contract storage.

For an order book, operations such as:

* Creating orders
* Updating orders
* Cancelling orders
* Executing trades

continuously read and modify storage.

The way this storage is organized may affect execution efficiency.

Monad provides **storage-page behavior** that can make nearby storage locations cheaper to access after a page is warmed.

Monad-PageSync investigates this experimentally instead of assuming a fixed improvement.

---

## 💡 How It Works

Monad-PageSync creates two order-book implementations:

### 1. Conventional Order Book

Uses a normal Solidity mapping:

```solidity
mapping(uint256 => Order) public orders;
```

### 2. PageSync Order Book

Uses a deliberately designed storage layout intended to take advantage of Monad's storage-page behavior.

Both implementations receive the **same workload**.

Example:

```text
100 Order Placements
100 Order Updates
50 Order Cancellations
50 Trade Executions
```

The system then compares their actual gas usage.

```text
                 Same Workload
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   Conventional              PageSync
   Order Book                Order Book
          │                       │
          └───────────┬───────────┘
                      ▼
                Gas Benchmark
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
      Gas Results            Order Events
                                  │
                                  ▼
                                Envio
                                  │
                                  ▼
                         Historical Analytics
                                  │
                                  ▼
                            React Dashboard
```

---

## 📊 What Is Measured?

Monad-PageSync measures:

* Total gas used
* Average gas per operation
* Minimum gas
* Maximum gas
* Gas used by each operation type
* Difference between the two storage layouts
* Percentage difference

The project does **not** assume a particular percentage of gas savings.

The results shown in the dashboard come from the actual benchmark.

---

## 🔎 Example Comparison

| Operation     | Conventional | PageSync | Difference |
| ------------- | -----------: | -------: | ---------: |
| Place Order   |     Measured | Measured | Calculated |
| Update Order  |     Measured | Measured | Calculated |
| Cancel Order  |     Measured | Measured | Calculated |
| Execute Trade |     Measured | Measured | Calculated |

The actual values will be generated during benchmarking.

---

## ⛓️ Envio Integration

Envio is used as the project's **onchain data indexing and analytics layer**.

The smart contracts emit structured events such as:

```text
OrderPlaced
OrderUpdated
OrderCancelled
TradeExecuted
```

Envio indexes these events and makes historical order-book data available to the application.

The dashboard can then display:

* Recent orders
* Order activity
* Recent trades
* Historical activity
* Block information
* Transaction information
* Aggregated statistics

### Important

Envio is used for **event indexing and historical analytics**.

It is **not** used to detect low-level `SLOAD` or `SSTORE` operations.

---

## 🖥️ Dashboard

The React dashboard contains several sections.

### Overview

Shows:

* Total operations
* Orders
* Trades
* Benchmark summary
* Current contracts

### Benchmark

Shows:

* Conventional gas usage
* PageSync gas usage
* Difference
* Operation-level comparison

### Order Activity

Displays indexed:

* Order ID
* Trader
* Price
* Quantity
* Status
* Block
* Transaction

### Trade Activity

Displays:

* Order ID
* Price
* Quantity
* Block
* Transaction

### Storage Explanation

Explains visually how the two storage layouts differ and why PageSync is designed around Monad storage-page behavior.

---

## 🏗️ Architecture

```text
                    Monad Testnet
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
     Conventional Book        PageSync Book
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
                    Order Events
                         │
                         ▼
                       Envio
                         │
                         ▼
                  Backend / Queries
                         │
                         ▼
                  React Dashboard
```

---

## 🛠️ Technology Stack

### Blockchain

* Monad Testnet
* Solidity

### Smart Contract Development

* Foundry
* Solidity tests
* Gas benchmarking

### Indexing

* Envio HyperIndex / HyperSync

### Frontend

* React
* Vite
* JavaScript / TypeScript

### Backend

* Node.js

### Development

* Git
* GitHub

---

## 📁 Project Structure

```text
monad-pagesync/
│
├── contracts/
│   ├── ConventionalOrderBook.sol
│   └── PageSyncOrderBook.sol
│
├── test/
│   ├── ConventionalOrderBook.t.sol
│   └── PageSyncOrderBook.t.sol
│
├── script/
│   └── Deploy.s.sol
│
├── benchmark/
│   └── GasBenchmark.t.sol
│
├── envio/
│   ├── config.yaml
│   └── src/
│
├── backend/
│   └── server.js
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── docs/
│   └── storage-layout.md
│
├── PRD.md
└── README.md
```

---

## ⚙️ Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>

cd monad-pagesync
```

### 2. Install Foundry

Install Foundry if it is not already installed.

Then verify:

```bash
forge --version
```

### 3. Install Dependencies

```bash
forge install
```

### 4. Build Contracts

```bash
forge build
```

### 5. Run Tests

```bash
forge test
```

### 6. Run Gas Benchmark

```bash
forge test --gas-report
```

The benchmark compares the two order-book implementations using the same workload.

---

## 🌐 Deploy to Monad Testnet

Configure the Monad Testnet RPC and wallet private key using environment variables.

Example:

```bash
export RPC_URL=<MONAD_TESTNET_RPC>
export PRIVATE_KEY=<YOUR_PRIVATE_KEY>
```

Deploy:

```bash
forge script script/Deploy.s.sol \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
```

> Never commit your private key to GitHub.

---

## 📡 Envio

Configure the Envio indexer with the deployed contract addresses and Monad network configuration.

The indexer tracks events such as:

```text
OrderPlaced
OrderUpdated
OrderCancelled
TradeExecuted
```

After indexing, the frontend can query the historical order-book data.

---

## 🧪 Benchmark Methodology

To make the comparison fair, both contracts use:

* The same compiler version
* The same optimizer settings
* The same workload
* The same input values
* The same number of operations
* The same operation order where practical

The primary difference is the **storage organization**.

Example workload:

```text
100 placements
100 updates
50 cancellations
50 executions
```

The benchmark records the gas used by each operation.

---

## 🔐 Security Considerations

The MVP includes basic protections such as:

* Order ownership validation
* Valid price checks
* Quantity validation
* Order ID validation
* Valid order-state transitions
* Protection against unnecessary external calls
* Reentrancy protection where external calls are introduced

This project is a **hackathon research/benchmarking tool** and is not intended for real-value trading.

---

## 🚫 What This Project Does NOT Do

Monad-PageSync is intentionally scoped.

It does not:

* Operate a production exchange
* Handle real user funds
* Perform real-value trading
* Run a Monad full node
* Perform opcode-level execution tracing
* Detect every `SLOAD` / `SSTORE`
* Perform autonomous AI trading
* Provide cross-chain execution
* Claim a fixed percentage of gas savings

---

## 💰 Cost

The project targets a **₹0 development cost**.

The intended stack uses:

* Monad Testnet
* Testnet MON
* Foundry
* Solidity
* React
* Node.js
* Envio's available development/free resources

Actual service limits and availability should be checked before deployment.

---

## 🎯 Hackathon Track

### Main Track

**Onchain Finance & Trading**

The project connects to the track through an onchain order-book workload involving:

```text
Order
  ↓
Storage
  ↓
Update
  ↓
Trade
  ↓
Analytics
```

### Bounty Target

**Envio — Best Use of Envio**

Envio is a meaningful part of the application rather than being added only for integration purposes.

The data flow is:

```text
Monad Contracts
      ↓
Order Events
      ↓
Envio Indexing
      ↓
Historical Queries
      ↓
Analytics Dashboard
```

---

## 📈 Success Criteria

The MVP is considered successful when:

* [ ] Both contracts compile
* [ ] Both contracts deploy
* [ ] Both contracts perform the same workload
* [ ] Gas usage is measured
* [ ] Gas results are compared
* [ ] Events are emitted
* [ ] Envio indexes the events
* [ ] Historical data can be queried
* [ ] React dashboard displays the results
* [ ] Storage layouts are clearly explained
* [ ] Benchmark evidence is reproducible

---

## 🧠 Core Philosophy

Monad-PageSync follows a simple principle:

> **Don't assume the optimization. Measure it.**

The project focuses on a clear experimental chain:

```text
Storage Layout
      ↓
Order Book
      ↓
Same Workload
      ↓
Gas Benchmark
      ↓
Real Results
      ↓
Envio Analytics
      ↓
Developer Dashboard
```

---

## 📌 Final Definition

**Monad-PageSync is a Monad testnet order-book benchmark and analytics tool that compares conventional and page-aware storage layouts, measures their actual gas behavior, and uses Envio to index and visualize the resulting onchain workload.**
