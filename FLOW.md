# 🚀 Lipwa-Trust — Hackathon Execution Plan

**Timeline:** 3 Days  
**Goal:** A working demo showing the full credit lifecycle —
merchant onboards, gets scored, requests inventory, contract
is issued on Stellar testnet, and repayment is tracked.

---

## 🧭 Hackathon Mindset

> **Demo > Perfect code.**  
> Mock what you must. Ship what matters.  
> Every feature a judge cannot see does not exist.

### What Judges Want to See
- A real problem clearly explained
- A working product (even if partially mocked)
- A smart technical architecture
- A believable business model

---

## 👥 Role Assignments

| Person | Focus |
|--------|-------|
| **P1** | Backend APIs + Trust Score + Repayment Engine |
| **P2** | Stellar smart contract + wallet + backend oracle |
| **P3** | Frontend dashboards + full API wiring + demo polish |

---

## 📅 Day 1 — Foundation & Core Engines

> **Goal:** Everyone has a running scaffold, shared data models
> agreed, and first working endpoints.

### All Together — Kickoff
- [ ] Create GitHub repo and agree on branch strategy
- [ ] Define and lock shared **data models**:
  - `Merchant`, `Supplier`, `Contract`, `Transaction`, `TrustScore`
- [ ] Agree on **API shapes** (request/response formats)
- [ ] Set up environment variables and `.env.example`
- [ ] Split and start working independently

---

### Person 1 — Backend
- [ ] Scaffold NestJS with modules: `merchants`, `credit`, `repayment`, `trust`
- [ ] Set up PostgreSQL + run initial schema migrations
- [ ] **Mock PayHero data** — seed script with 30 days of fake sales transactions
- [ ] Build AI Trust Score engine *(rule-based — no ML needed for demo)*:
  - Input: avg daily sales, consistency, days active
  - Output: score 0–100 + credit limit
- [ ] Expose: `GET /trust/score/:merchantId`
- [ ] Expose: `POST /merchants/onboard`

### Person 2 — Blockchain
- [ ] Set up Stellar testnet accounts (merchant, supplier, platform)
- [ ] Set up Rust + Soroban development environment
- [ ] Write `InventoryCreditContract` with state fields and `create()` function
- [ ] Test basic contract deployment on Stellar testnet
- [ ] Begin `dispatch()` and `deliver()` state functions

### Person 3 — Frontend
- [ ] Scaffold Next.js + TypeScript + Tailwind project
- [ ] Set up page routes: `/merchant`, `/supplier`, `/admin`
- [ ] Build shared components: Navbar, Card, Badge, Button, ProgressBar
- [ ] Build **Merchant Dashboard shell** (static/mocked data for now):
  - Trust Score widget
  - Credit limit display
  - "Request Inventory" button

---

## 📅 Day 2 — Integration & Core Demo Flow

> **Goal:** The main credit lifecycle works end-to-end — from credit
> request to contract on Stellar to supplier payout trigger.

### Person 1
- [ ] Build `POST /credit/apply` endpoint:
  - Run approval checks (score threshold, amount vs limit)
  - Create contract record in PostgreSQL
  - Call Person 2's contract creation oracle (`POST /contract/create`)
- [ ] Build `POST /repayment/settle` — daily deduction from simulated sales
- [ ] Build `GET /merchant/dashboard` — returns score, limit, active contracts, repayment progress

### Person 2
- [ ] Complete smart contract state machine:
  - `create()` → `dispatch()` → `deliver()` → `record_repayment()` → `settle()`
- [ ] Expose HTTP oracle interface for Person 1:
  - `POST /contract/create`
  - `POST /contract/dispatch`
  - `POST /contract/deliver`
  - `POST /contract/repay`
  - `GET /contract/:id/status`
- [ ] Test all state transitions on Stellar testnet

### Person 3
- [ ] Wire Merchant Dashboard to real `GET /merchant/dashboard` API
- [ ] Build **Inventory Request Form** (supplier select, items, amount)
- [ ] Wire form to `POST /credit/apply`
- [ ] Build contract status page (shows live contract state)

---

### Person 1 + Person 2 — Integration Sprint
- [ ] Test full flow: `credit/apply` → contract created on Stellar → state = `PENDING_DISPATCH`
- [ ] Test: supplier dispatch → state = `DISPATCHED`
- [ ] Test: merchant confirms → state = `DELIVERED` + payout triggered
- [ ] Test: repayment loop for 3 simulated days → contract balance reduces

### Person 3 — Dashboard Completion
- [ ] Build **Supplier Dashboard**:
  - Incoming orders list
  - Dispatch confirmation button (triggers `POST /contract/dispatch`)
- [ ] Build **Repayment Progress UI** (progress bar + remaining balance)
- [ ] Build **Admin Dashboard** (live contract list, Trust Scores, risk flags)
- [ ] Wire Stellar contract state to frontend contract viewer

---

## 📅 Day 3 — Polish, Demo Script & Presentation

> **Goal:** A smooth, rehearsed, visually clean demo that tells
> the story compellingly.

### All Team — Demo Dry Run
- [ ] Run full end-to-end demo walkthrough:
Merchant onboards
- Trust Score appears (42/100 → limited credit)
- Merchant requests KES 5,000 inventory
- Stellar contract deployed (show testnet explorer link)
- Supplier dispatches
- Merchant confirms receipt
- Supplier payout triggered
- Repayment deducted over 3 simulated days
- Contract settles → Trust Score rises to 67/100
  - [ ] Fix any broken links, crashed states, or ugly UI
- [ ] Seed demo database with **1 convincing merchant story**
*(Mama Wanjiku's kibanda — 60 days of sales history)*

### Person 3 — Demo Polish
- [ ] Add loading states and empty states
- [ ] Make Trust Score animated (gauge or progress feel)
- [ ] Ensure mobile responsiveness across dashboards
- [ ] Add Lipwa-Trust branding and logo

---

### All Team — Presentation Prep

Structure your pitch as:

1. **Problem** *(30 sec)* — Mama Wanjiku can't restock without cash
2. **Solution** *(1 min)* — Lipwa-Trust: earn trust daily, get credit automatically
3. **How it works** *(2 min)* — live demo walkthrough
4. **Architecture** *(1 min)* — show the 3-layer diagram (PayHero → Backend → Stellar)
5. **Business model** *(30 sec)* — platform fee per contract settled
6. **Impact + Roadmap** *(30 sec)*

### Presentation Roles
- **P1** — explains AI scoring and backend logic
- **P2** — explains blockchain layer, shows Stellar testnet explorer
- **P3** — drives the live demo on screen

---

## ⚡ Mocking Strategy

> If a component isn't ready in time, use these fallbacks to keep
> the demo moving.

| Component | Mock With |
|-----------|-----------|
| PayHero API | Seeded PostgreSQL transactions (fake sales data) |
| Stellar mainnet | Stellar testnet explorer link (still impressive) |
| ML Trust Score | Rule-based formula: `score = avg_daily_sales / max × 100` |
| Real M-Pesa payout | Log entry: "Payout of KES 5,000 triggered to Supplier" |
| Web3 wallet UI | Display Stellar wallet address + Horizon testnet link |

---

## 🏁 Definition of Done

Minimum demo-able product before presenting:

- [ ] Merchant can onboard and see their Trust Score
- [ ] Credit request can be submitted and approved
- [ ] Stellar testnet contract is created and visible on explorer
- [ ] Supplier can dispatch and merchant can confirm receipt
- [ ] Repayment progress is visible and updates in real time
- [ ] Admin can see all active contracts and risk flags

---

> The winning demo is not the most complete —
> it's the one that tells the clearest story.
