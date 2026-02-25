# 🔗 Lipwa-Trust — Blockchain Component Implementation Plan

**Owner:** Person 2 (Blockchain / Stellar Engineer)
**Timeline:** 3-day hackathon
**Network:** Stellar Testnet (Soroban)

---

## 1. Objectives

Build the on-chain and oracle layer that:

1. Manages the full **inventory credit lifecycle** as a Soroban smart contract
2. Handles **escrow** of funds until delivery is confirmed
3. Emits **on-chain audit events** for every state transition
4. Supports **dispute / cancellation** when a supplier fails to dispatch
5. Exposes a **TypeScript HTTP oracle API** that the backend calls to interact with the chain
6. Manages **Stellar testnet wallets** (keypair creation + storage)

---

## 2. Tech Stack

| Layer                  | Technology           | Version                  |
| ---------------------- | -------------------- | ------------------------ |
| Smart Contract         | Rust (Soroban)       | Soroban Rust SDK v20.4.0 |
| Blockchain Interaction | Stellar SDK (JS)     | v14.5.0                  |
| Oracle API             | TypeScript + Express | Latest                   |
| Database (wallets)     | PostgreSQL (shared)  | —                        |
| Network                | Stellar Testnet      | Protocol 20              |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      BACKEND (Person 1)                      │
│   NestJS APIs — Trust Score, Credit, Repayment               │
└──────────────────┬───────────────────────────────────────────┘
                   │  HTTP calls
                   ▼
┌──────────────────────────────────────────────────────────────┐
│               ORACLE API (TypeScript + Express)              │
│                                                              │
│  POST /wallets/create       — generate & store keypair       │
│  GET  /wallets/:id          — retrieve public key            │
│  POST /contracts/create     — deploy contract on-chain       │
│  POST /contracts/:id/fund   — escrow funds into contract     │
│  POST /contracts/:id/dispatch  — supplier marks dispatched   │
│  POST /contracts/:id/deliver   — merchant confirms delivery  │
│  POST /contracts/:id/repay     — record a repayment slice    │
│  POST /contracts/:id/settle    — finalize settled contract   │
│  POST /contracts/:id/dispute   — raise a dispute             │
│  POST /contracts/:id/cancel    — cancel (timeout / dispute)  │
│  GET  /contracts/:id/status    — read on-chain state         │
│  GET  /contracts/:id/events    — read audit log events       │
└──────────────────┬───────────────────────────────────────────┘
                   │  Stellar SDK calls
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              STELLAR TESTNET (Soroban Runtime)                │
│                                                              │
│   InventoryCreditContract                                    │
│   ├── create()            — initialize contract state        │
│   ├── fund_escrow()       — lock funds in contract           │
│   ├── dispatch()          — supplier confirms dispatch       │
│   ├── deliver()           — merchant confirms receipt        │
│   ├── record_repayment()  — log partial repayment            │
│   ├── settle()            — close contract, release escrow   │
│   ├── raise_dispute()     — flag for dispute resolution      │
│   ├── cancel()            — cancel + refund escrow           │
│   └── get_state()         — read contract state              │
│                                                              │
│   Events emitted at every state transition for audit trail   │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Smart Contract Design (Rust / Soroban)

### 4.1 Contract State Machine

```
                          ┌──────────┐
                          │ CREATED  │
                          └────┬─────┘
                               │ fund_escrow()
                          ┌────▼─────────────┐
                          │ FUNDED / PENDING  │
                          │   DISPATCH        │
                          └────┬─────────┬────┘
                               │         │ timeout / dispute
                          dispatch()     │
                               │    ┌────▼─────┐
                          ┌────▼────┤ DISPUTED  │
                          │        └────┬──────┘
                          │             │ cancel()
                     DISPATCHED         │
                          │        ┌────▼─────┐
                          │        │ CANCELLED │
                     deliver()     │ (refund)  │
                          │        └───────────┘
                     ┌────▼──────┐
                     │ DELIVERED │
                     │ (payout   │
                     │ triggered)│
                     └────┬──────┘
                          │ record_repayment() × N
                     ┌────▼──────────┐
                     │  REPAYING     │
                     └────┬──────────┘
                          │ settle() (balance == 0)
                     ┌────▼──────┐
                     │ SETTLED   │
                     └───────────┘
```

### 4.2 Data Structures

```rust
#[contracttype]
pub enum ContractStatus {
    Created,
    PendingDispatch, // funded, awaiting supplier
    Dispatched,
    Delivered,
    Repaying,
    Disputed,
    Cancelled,
    Settled,
}

#[contracttype]
pub struct CreditContract {
    pub contract_id: Symbol,
    pub merchant: Address,
    pub supplier: Address,
    pub platform: Address,       // Lipwa-Trust platform account
    pub amount: i128,            // total credit amount (in test asset units)
    pub escrow_balance: i128,    // funds held in escrow
    pub repaid: i128,            // total repaid so far
    pub status: ContractStatus,
    pub created_at: u64,         // ledger timestamp
    pub dispatch_deadline: u64,  // auto-dispute if not dispatched by this time
    pub token: Address,          // stablecoin / test asset address
}
```

### 4.3 Contract Functions

| Function                                                       | Caller               | Action                                                        | Emits Event                           |
| -------------------------------------------------------------- | -------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `create(merchant, supplier, amount, token, dispatch_deadline)` | Platform             | Initializes contract state → `Created`                        | `contract_created`                    |
| `fund_escrow(from, amount)`                                    | Platform             | Transfers test asset into contract escrow → `PendingDispatch` | `escrow_funded`                       |
| `dispatch()`                                                   | Supplier             | Marks goods as dispatched → `Dispatched`                      | `goods_dispatched`                    |
| `deliver()`                                                    | Merchant             | Confirms receipt → `Delivered`; triggers payout to supplier   | `delivery_confirmed`, `supplier_paid` |
| `record_repayment(amount)`                                     | Platform             | Records a repayment slice → `Repaying`                        | `repayment_recorded`                  |
| `settle()`                                                     | Platform             | Finalizes when `repaid >= amount` → `Settled`                 | `contract_settled`                    |
| `raise_dispute(reason)`                                        | Merchant or Platform | Flags contract → `Disputed`                                   | `dispute_raised`                      |
| `cancel()`                                                     | Platform             | Refunds escrow to platform → `Cancelled`                      | `contract_cancelled`                  |
| `get_state()`                                                  | Any                  | Returns current `CreditContract` state                        | —                                     |

### 4.4 Escrow Logic

- On `fund_escrow()`: the platform transfers the credit amount (test asset) into the contract's token balance.
- On `deliver()`: the contract transfers the escrowed funds to the **supplier** address (simulating supplier payout).
- On `cancel()`: the contract returns the escrowed funds to the **platform** address.
- The contract itself acts as the escrow holder by holding a token balance.

### 4.5 Dispute & Cancellation

- **Dispatch timeout**: If the supplier does not call `dispatch()` before `dispatch_deadline`, the platform (or an automated cron) can call `raise_dispute()` → `Disputed`.
- **Manual dispute**: The merchant can raise a dispute at any point before `Settled`.
- **Cancellation**: Only callable from `Created`, `PendingDispatch`, or `Disputed` states. Refunds escrowed funds to the platform.
- Future mainnet enhancement: multi-sig dispute resolution with an arbiter.

### 4.6 Audit Event Logging

Every state-changing function emits a Soroban contract event with:

```rust
env.events().publish(
    (symbol_short!("audit"), /* event_name */),
    (contract_id, old_status, new_status, ledger_timestamp, caller)
);
```

These events are queryable via the Horizon API and the oracle's `GET /contracts/:id/events` endpoint.

---

## 5. Oracle API Design (TypeScript + Express)

### 5.1 Project Structure

```
blockchain/
├── contracts/                     # Soroban smart contracts (Rust)
│   └── inventory_credit/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs             # Main contract logic
├── oracle/                        # TypeScript HTTP oracle
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts               # Express app entry point
│       ├── config.ts              # Stellar network config
│       ├── routes/
│       │   ├── wallets.ts         # Wallet CRUD routes
│       │   └── contracts.ts       # Contract interaction routes
│       ├── services/
│       │   ├── stellar.ts         # Stellar SDK wrapper (tx building, signing)
│       │   ├── wallet.ts          # Keypair generation + DB storage
│       │   ├── contract.ts        # Contract deployment + invocation
│       │   └── events.ts          # Event querying from Horizon
│       ├── models/
│       │   └── wallet.ts          # Wallet DB model (keypair storage)
│       └── utils/
│           ├── keypair.ts         # Keypair generation helpers
│           └── errors.ts          # Shared error types
├── PLAN.md                        # This file
└── README.md                      # Component overview & setup
```

### 5.2 Wallet Management

**Flow:**

1. Backend calls `POST /wallets/create` with `{ type: "merchant" | "supplier" | "platform", ownerId: string }`.
2. Oracle generates a Stellar keypair using the Stellar SDK.
3. Public key and encrypted secret key are stored in PostgreSQL.
4. Oracle funds the new account from a Friendbot (testnet) or a platform funding account.
5. Returns `{ publicKey, walletId }`.

**Security considerations for mainnet:**

- Secret keys should be encrypted at rest (AES-256).
- Consider HSM or KMS integration for production key custody.
- Never expose secret keys via API responses.

### 5.3 API Endpoints

#### Wallets

| Method | Path              | Body                | Response                                 |
| ------ | ----------------- | ------------------- | ---------------------------------------- |
| `POST` | `/wallets/create` | `{ type, ownerId }` | `{ walletId, publicKey }`                |
| `GET`  | `/wallets/:id`    | —                   | `{ walletId, publicKey, type, ownerId }` |

#### Contracts

| Method | Path                      | Body                                                                    | Response                                                     |
| ------ | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `POST` | `/contracts/create`       | `{ merchantWalletId, supplierWalletId, amount, dispatchDeadlineHours }` | `{ contractId, stellarTxHash, status }`                      |
| `POST` | `/contracts/:id/fund`     | `{ fromWalletId, amount }`                                              | `{ txHash, escrowBalance }`                                  |
| `POST` | `/contracts/:id/dispatch` | `{ supplierWalletId }`                                                  | `{ txHash, status }`                                         |
| `POST` | `/contracts/:id/deliver`  | `{ merchantWalletId }`                                                  | `{ txHash, status, supplierPayout }`                         |
| `POST` | `/contracts/:id/repay`    | `{ amount }`                                                            | `{ txHash, repaid, remaining }`                              |
| `POST` | `/contracts/:id/settle`   | —                                                                       | `{ txHash, status }`                                         |
| `POST` | `/contracts/:id/dispute`  | `{ reason, raisedBy }`                                                  | `{ txHash, status }`                                         |
| `POST` | `/contracts/:id/cancel`   | —                                                                       | `{ txHash, refundAmount, status }`                           |
| `GET`  | `/contracts/:id/status`   | —                                                                       | `{ contractId, status, amount, repaid, escrowBalance, ... }` |
| `GET`  | `/contracts/:id/events`   | —                                                                       | `[ { event, timestamp, data }, ... ]`                        |

### 5.4 Stellar SDK Integration

The `services/stellar.ts` module will:

1. Configure the Stellar SDK to connect to the **testnet** Horizon server and Soroban RPC.
2. Build, sign, and submit transactions for contract deployment and invocation.
3. Use `SorobanRpc.Server` to simulate and send Soroban transactions.
4. Query Horizon for contract events (audit log).

Key configuration (`.env`):

```env
STELLAR_NETWORK=testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
FRIENDBOT_URL=https://friendbot.stellar.org
PLATFORM_SECRET_KEY=S...  # testnet platform account secret
DATABASE_URL=postgresql://user:pass@localhost:5432/lipwa
```

---

## 6. Test Asset (Stablecoin Simulation)

For the hackathon demo, we will issue a **custom test asset** on Stellar testnet:

1. Create an **issuer account** on testnet.
2. Issue a custom asset called `KESX` (simulating a KES-pegged stablecoin).
3. Establish a trustline from merchant, supplier, and platform accounts to `KESX`.
4. Mint test `KESX` tokens to the platform account for escrow funding.

This simulates real stablecoin settlement without requiring actual USDC or KES stablecoin integration.

**Mainnet consideration:** Replace `KESX` with a regulated KES stablecoin or Stellar USDC when available.

---

## 7. Day-by-Day Execution Schedule

### Day 1 — Foundation

| #   | Task                                                              | Output                               |
| --- | ----------------------------------------------------------------- | ------------------------------------ |
| 1   | Install Rust, Soroban CLI, Stellar CLI                            | Working dev environment              |
| 2   | Scaffold Soroban contract project (`contracts/inventory_credit/`) | Compiling `hello world` contract     |
| 3   | Create testnet accounts: platform, issuer, 1 merchant, 1 supplier | Funded testnet keypairs              |
| 4   | Issue `KESX` test asset and set up trustlines                     | All accounts can hold `KESX`         |
| 5   | Implement `create()` and `get_state()` in the smart contract      | Deployable contract with basic state |
| 6   | Test contract deployment on testnet                               | Visible on Stellar explorer          |
| 7   | Scaffold TypeScript oracle project (`oracle/`)                    | Express server running locally       |
| 8   | Implement `POST /wallets/create` and `GET /wallets/:id`           | Wallet creation working              |

### Day 2 — Core Logic & Integration

| #   | Task                                                                         | Output                        |
| --- | ---------------------------------------------------------------------------- | ----------------------------- |
| 1   | Implement `fund_escrow()`, `dispatch()`, `deliver()` in contract             | Core lifecycle on-chain       |
| 2   | Implement `record_repayment()` and `settle()`                                | Repayment loop on-chain       |
| 3   | Implement `raise_dispute()` and `cancel()` with refund logic                 | Dispute/cancellation on-chain |
| 4   | Add event emission to all state-changing functions                           | Audit logging on-chain        |
| 5   | Wire oracle endpoints: `/contracts/create`, `/fund`, `/dispatch`, `/deliver` | Backend can call oracle       |
| 6   | Wire oracle endpoints: `/repay`, `/settle`, `/dispute`, `/cancel`            | Full lifecycle via HTTP       |
| 7   | Wire `GET /contracts/:id/status` and `GET /contracts/:id/events`             | State + audit queries working |
| 8   | Integration test with Person 1: `credit/apply` → contract created on-chain   | End-to-end flow validated     |

### Day 3 — Polish & Demo Prep

| #   | Task                                                                         | Output                            |
| --- | ---------------------------------------------------------------------------- | --------------------------------- |
| 1   | Full lifecycle test: create → fund → dispatch → deliver → repay × 3 → settle | Happy path verified               |
| 2   | Test dispute flow: create → fund → timeout → dispute → cancel → refund       | Dispute path verified             |
| 3   | Prepare Stellar testnet explorer links for demo                              | Visual proof of on-chain activity |
| 4   | Add error handling and input validation to oracle API                        | Robust API                        |
| 5   | Seed demo data: "Mama Wanjiku" contract lifecycle                            | Demo-ready contract history       |
| 6   | Dry-run demo walkthrough with team                                           | Presentation-ready                |

---

## 8. Verification Plan

Since this is a greenfield hackathon project with no existing tests, verification is manual + scripted.

### 8.1 Smart Contract Tests (Soroban)

Run Soroban's built-in test framework:

```bash
cd blockchain/contracts/inventory_credit
cargo test
```

Tests to write in `src/test.rs`:

- **Happy path**: `create → fund → dispatch → deliver → repay → settle` — assert final state is `Settled` and balances are correct.
- **Dispute path**: `create → fund → raise_dispute → cancel` — assert escrow refunded to platform.
- **Invalid transitions**: calling `deliver()` before `dispatch()` should fail.
- **Unauthorized callers**: only the supplier can call `dispatch()`, only the merchant can call `deliver()`.

### 8.2 Oracle API Tests (Manual / curl)

After starting the oracle server (`cd blockchain/oracle && npm run dev`), run through this sequence:

```bash
# 1. Create wallets
curl -X POST http://localhost:3001/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"type":"merchant","ownerId":"merchant-1"}'

curl -X POST http://localhost:3001/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"type":"supplier","ownerId":"supplier-1"}'

# 2. Create contract
curl -X POST http://localhost:3001/contracts/create \
  -H "Content-Type: application/json" \
  -d '{"merchantWalletId":"<id>","supplierWalletId":"<id>","amount":5000,"dispatchDeadlineHours":24}'

# 3. Fund escrow
curl -X POST http://localhost:3001/contracts/<id>/fund \
  -H "Content-Type: application/json" \
  -d '{"fromWalletId":"<platform-wallet-id>","amount":5000}'

# 4. Dispatch, deliver, repay, settle...
# (continue calling each endpoint and verify status changes)

# 5. Check status
curl http://localhost:3001/contracts/<id>/status

# 6. Check audit events
curl http://localhost:3001/contracts/<id>/events
```

### 8.3 Integration Test with Backend

Coordinate with Person 1 to test:

1. `POST /credit/apply` on the backend triggers `POST /contracts/create` on the oracle.
2. Contract appears on Stellar testnet explorer.
3. State transitions flow correctly through the full lifecycle.
4. Frontend (Person 3) can display contract status from `GET /contracts/:id/status`.

### 8.4 Visual Verification

- Open the deployed contract on [Stellar Laboratory](https://laboratory.stellar.org/) or [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet) to verify:
  - Contract deployment transaction
  - Token transfer transactions (escrow, payout, refund)
  - Contract events in the transaction details

---

## 9. Mainnet Considerations (Future)

These items are **out of scope** for the hackathon but should be designed for:

| Area                   | Testnet (Now)            | Mainnet (Future)                        |
| ---------------------- | ------------------------ | --------------------------------------- |
| **Keypair storage**    | Plaintext in DB          | Encrypted (AES-256) + KMS/HSM           |
| **Funding**            | Friendbot                | Real XLM for fees, managed funding pool |
| **Stablecoin**         | Custom `KESX` test asset | Regulated KES stablecoin or USDC        |
| **Fee management**     | Free on testnet          | Fee estimation + platform fee account   |
| **Dispute resolution** | Platform-only `cancel()` | Multi-sig with independent arbiter      |
| **Rate limiting**      | None                     | Rate limiting + auth on oracle API      |
| **Monitoring**         | Console logs             | Prometheus/Grafana + alerting           |
| **Contract upgrades**  | Redeploy                 | Soroban contract upgrade mechanism      |
