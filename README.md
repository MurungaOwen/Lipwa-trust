# 💸 Lipwa‑Trust

**Automated Supply Chain Financing for Informal Retailers**

***

## Overview

**Lipwa‑Trust** is a closed‑loop inventory financing platform that enables small informal retailers (commonly known as *kibandas*) to access inventory credit based on verified daily sales data.  

The platform combines **AI‑driven credit scoring**, **blockchain smart contracts**, and **automated repayment systems** to create trust‑based financing for the informal economy.

### Key Technologies
- **Pay Hero integration** – captures verified payment and sales data  
- **AI‑driven Trust Score** – dynamic credit scoring based on merchant performance  
- **Stellar smart contracts (Soroban)** – manages settlement and guarantees  
- **Automated revenue‑based repayment** – aligns credit with daily earnings  

***

## Problem

Small retailers in Kenya face persistent barriers to financing:

- Lack of collateral or formal banking history  
- Absence of audited financial records  
- Predominantly cash‑based operations  
- High perceived default risk by lenders  
- Limited supplier willingness to offer credit without trust mechanisms  

***

## Solution

Lipwa‑Trust introduces a **programmable financing loop**:

1. Daily sales are captured via **Pay Hero**.  
2. An **AI model** generates a merchant’s dynamic **Trust Score**.  
3. The merchant requests inventory financing.  
4. A **smart contract** is issued on **Stellar (Soroban)** to manage the transaction.  
5. **Automated repayment** occurs through real‑time revenue inflows.  

This closed‑loop model minimizes default risk and enables scalable, data‑driven credit for small merchants.

***

## System Architecture

### 🧠 Backend
- **Node.js / NestJS/ python** – core APIs and logic  
- **Python** – AI scoring and risk modeling  
- **PostgreSQL** – persistent data storage  
- **Redis** – real‑time computation and caching  

### 🔗 Blockchain Layer
- **Stellar Soroban smart contracts**  
- **Stablecoin‑based settlements**  
- **Automated revenue routing and escrow management**

### 💻 Frontend
- **Next.js + Tailwind CSS / vite react** – responsive dashboard UI  
- **API integration layer** – connects backend & blockchain services  

***

## Core Features
- Real‑time **Trust Score** generation  
- **Revenue‑based** credit limit adjustment  
- Smart contract‑driven inventory financing  
- **Automated repayment routing** from sales inflows  
- Supplier visibility dashboard with performance insights  

***

## Impact
- Enables **bulk purchasing** by small retailers  
- Improves **profit margins** and inventory flow  
- Reduces **supplier default risk** through verified repayment logic  
- Builds programmable **B2B financing rails** for the informal economy  

***

## Future Roadmap
- Multi‑supplier marketplace integration  
- Cross‑border supplier payments via Stellar network  
- On‑chain **credit history NFTs** for each merchant  
- Embedded **micro‑insurance** and risk‑sharing layer  
