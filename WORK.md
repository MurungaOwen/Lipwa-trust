# Team Roles & Technical Breakdown

This document outlines the core roles, responsibilities, and deliverables for each team member in the project.

***

## Person 1 — Backend & AI Lead

**Role:** Data + Credit Intelligence

### Responsibilities
- Integrate **Pay Hero API** (MVP: Mocked via seed script)
- Build **sales ingestion pipeline** (MVP: Mocked via seed script)
- Design and optimize **Trust Score algorithm** (MVP: Rule-based complete)
- Implement **basic credit application logic** (MVP: `POST /credit/apply` complete)
- Implement **basic supplier management API** (MVP: `POST /suppliers/onboard`, `GET /suppliers/{supplier_id}`, `GET /suppliers` complete)
- Implement **dynamic Trust Score update simulation** (MVP: `POST /merchants/simulate_daily_sales/{merchant_id}` complete)
- Implement **risk engine logic** (Future)
- Define **credit approval and validation rules** (MVP: Basic rules in `POST /credit/apply` complete)
- Develop **repayment calculation engine** (MVP: `POST /repayment/settle` complete)
- Expose analytics through **Merchant dashboard API** (MVP: `GET /merchant/dashboard` complete)

### Tech Stack
- **FastAPI (Python)** – backend and API framework
- **SQLite** (MVP) / **PostgreSQL** (Future) – relational data layer
- **Python** – AI-based scoring and predictive models

### Deliverables
- **Trust Score API** (MVP: Complete)
- **Credit Limit Calculator** (MVP: Complete)
- **Mock Data Seeder** (MVP: Complete, includes Merchants and Suppliers)
- **Basic Credit Application API** (`POST /credit/apply`) (MVP: Complete)
- **Repayment Settlement API** (`POST /repayment/settle`) (MVP: Complete)
- **Dynamic Trust Score Update API** (`POST /merchants/simulate_daily_sales/{merchant_id}`) (MVP: Complete)
- **Expanded Merchant Dashboard API** (`GET /merchant/dashboard`) (MVP: Complete)
- **Basic Supplier Management API** (MVP: Complete)
- **Repayment Percentage Engine** (MVP: Basic logic in `POST /repayment/settle`)
- **Merchant Risk Monitoring System** (Future)

***

## Person 2 — Blockchain / Stellar Engineer

**Role:** Smart Contract & Wallet Infrastructure

### Responsibilities
- Develop **Stellar smart contract logic (Soroban)**  
- Integrate **stablecoin transactions**  
- Automate **merchant and supplier wallet creation**  
- Build **automated routing and contract settlement logic**  
- Manage **on-chain audit logging** for transparency

### Tech Stack
- **Stellar SDK**  
- **Rust (Soroban)** – smart contract language  
- **Horizon API** – blockchain interaction layer  
- **Wallet Key Management System**

### Deliverables
- **Smart Contract Template**  
- **Automated Payout Routing**  
- **Blockchain Transaction Handler**  
- **Escrow and Settlement Logic**

***

## Person 3 — Frontend + Product + Integrations

**Role:** User Experience & Platform Layer

### Responsibilities
- Develop **Merchant** and **Supplier dashboards**  
- Implement **inventory request** and **contract viewing flows**  
- Track **repayment progress**  
- Build **Admin dashboard**  
- Integrate backend **APIs** and **Web3 wallet UI**

### Tech Stack
- **Next.js / vite, React** – frontend framework  
- **TypeScript** – type-safe frontend logic  
- **Tailwind CSS** – responsive UI styling  
- **Web3 wallet integration tools**  
- **API integration layer**

### Deliverables
- **Merchant UI**  
- **Supplier UI**  
- **Credit Request Interface**  
- **Repayment Tracking Interface**

***

Would you like me to add a short **project overview** section at the top and a **“How to Contribute”** section for completeness?
