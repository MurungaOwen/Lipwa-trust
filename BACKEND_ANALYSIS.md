# 🔍 Backend Analysis - Gaps & Stellar Integration Plan

**Date:** February 25, 2026  
**Status:** MVP Complete ✅ | Ready for Stellar Integration 🚀

---

## Part 1: Backend vs WORK.md Deliverables Assessment

### ✅ Completed (MVP)

| Deliverable | Status | Endpoint(s) | Notes |
|-------------|--------|-----------|-------|
| Trust Score API | ✅ Complete | `GET /merchant/me/score` | Rule-based scoring working |
| Credit Limit Calculator | ✅ Complete | Integrated in `/merchant/me/score` | Dynamic based on sales data |
| Mock Data Seeder | ✅ Complete | `python seeder.py` | Seeds 10 merchants + 3 suppliers |
| Basic Credit Application API | ✅ Complete | `POST /credit/apply` | Full approval workflow |
| Repayment Settlement API | ✅ Complete | `POST /repayment/settle` | Tracks repayment progress |
| Dynamic Trust Score Update | ✅ Complete | `POST /merchant/me/simulate_daily_sales` | Simulation endpoint working |
| Merchant Dashboard API | ✅ Complete | `GET /merchant/me/dashboard` | Returns full merchant context |
| Supplier Management API | ✅ Complete | `POST /suppliers/onboard`, `GET /suppliers` | Full CRUD ready |
| Product Categories | ✅ Complete | `product_category` field in Supplier | Added in latest iteration |
| Supplier Contract Visibility | ✅ Complete | `GET /supplier/me/contracts` | Lists all/active contracts |

### ⚠️ In Progress / Needs Enhancement

| Deliverable | Status | Issue | Solution |
|-------------|--------|-------|----------|
| Merchant Risk Monitoring | ⚠️ Partial | Only basic score checks | Add risk flags (e.g., overdue contracts, declining score) |
| Pay Hero Integration | ⚠️ Mocked | Seeded data only | Add webhook listener for real Pay Hero data |
| Contract Settlement Tracking | ⚠️ Basic | No Stellar contract ID storage | Add `stellar_contract_id` field to Contract model |
| Automated Repayment Routing | ⚠️ Manual | Requires Stellar integration | Implement after Stellar oracle is ready |

### 🚀 Not Yet Started (Post-MVP)

- Advanced ML-based credit scoring
- Fraud detection system
- Real-time Pay Hero webhook ingestion
- Full Stellar smart contract automation
- Merchant reputation scoring with suppliers
- Admin audit logging system

---

## Part 2: Stellar Smart Contract Integration Architecture

### 🔗 Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Person 3)                       │
│  Merchant Dashboard → Apply for Credit → View Contract Status   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    POST /credit/apply
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Person 1)                            │
│  FastAPI → Credit Approval Logic → Create Contract Record       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
        POST /blockchain/contract/create
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               STELLAR ORACLE (Person 2)                          │
│  REST API ← → Soroban Smart Contract ← → Stellar Testnet       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                        Blockchain TX
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│          STELLAR TESTNET / MAINNET (Soroban)                    │
│  InventoryCreditContract: PENDING → DISPATCHED → SETTLED        │
└─────────────────────────────────────────────────────────────────┘
```

### 🛠️ Backend → Stellar Communication Protocol

#### 1. **Contract Creation Request** (Backend → Oracle)

```http
POST /blockchain/contract/create
Content-Type: application/json

{
  "merchant_id": "MER-12345",
  "supplier_id": "SUP-5678",
  "amount_kes": 5000.0,
  "merchant_wallet": "GXXXXXXXXX...",
  "supplier_wallet": "GYYYYYYYYY...",
  "platform_wallet": "GZZZZZZZZZ...",
  "due_date": "2026-03-25T00:00:00Z"
}
```

**Response:**
```json
{
  "contract_id": 42,
  "stellar_contract_id": "cc123456789abcdef...",
  "status": "CREATED",
  "transaction_hash": "tx1234567890abcdef"
}
```

#### 2. **Contract Dispatch** (Supplier Action)

```http
POST /blockchain/contract/dispatch
Content-Type: application/json

{
  "stellar_contract_id": "cc123456789abcdef...",
  "supplier_wallet": "GYYYYYYYYY..."
}
```

**Response:**
```json
{
  "status": "DISPATCHED",
  "timestamp": "2026-02-25T14:30:00Z",
  "transaction_hash": "tx9876543210fedcba"
}
```

#### 3. **Contract Delivery Confirmation** (Merchant Action)

```http
POST /blockchain/contract/deliver
Content-Type: application/json

{
  "stellar_contract_id": "cc123456789abcdef...",
  "merchant_wallet": "GXXXXXXXXX..."
}
```

**Response:**
```json
{
  "status": "DELIVERED",
  "payout_triggered": true,
  "payout_amount_kes": 5000.0,
  "payout_address": "GYYYYYYYYY...",
  "timestamp": "2026-02-25T15:00:00Z"
}
```

#### 4. **Record Repayment on Chain** (Backend → Oracle)

```http
POST /blockchain/contract/repay
Content-Type: application/json

{
  "stellar_contract_id": "cc123456789abcdef...",
  "repayment_amount_kes": 1250.0,
  "merchant_wallet": "GXXXXXXXXX...",
  "platform_wallet": "GZZZZZZZZZ..."
}
```

**Response:**
```json
{
  "status": "REPAYMENT_RECORDED",
  "total_repaid": 1250.0,
  "remaining_balance": 3750.0,
  "transaction_hash": "tx5555555555555555"
}
```

#### 5. **Contract Settlement** (Final Repayment)

```http
POST /blockchain/contract/settle
Content-Type: application/json

{
  "stellar_contract_id": "cc123456789abcdef...",
  "merchant_wallet": "GXXXXXXXXX..."
}
```

**Response:**
```json
{
  "status": "SETTLED",
  "total_repaid": 5000.0,
  "settlement_fee_kes": 50.0,
  "platform_fee_kes": 50.0,
  "net_supplier_payout": 4900.0,
  "transaction_hash": "tx6666666666666666"
}
```

---

### 📊 Data Model Updates Required

Add these fields to `Contract` database model:

```python
class Contract(Base):
    # ... existing fields ...
    
    # Stellar integration fields
    stellar_contract_id: str = None  # Smart contract address
    merchant_wallet_address: str = None  # Stellar wallet
    supplier_wallet_address: str = None  # Stellar wallet
    platform_wallet_address: str = None  # Lipwa-Trust wallet
    
    # Settlement tracking
    settlement_fees: float = 0.0  # Platform fees
    supplier_payout_address: str = None  # Where funds go
    on_chain_status: str = None  # Mirrors blockchain state
    last_blockchain_sync: datetime = None  # When we last synced
```

---

### 🔄 State Machine Definition

**Contract States & Transitions:**

```
APPROVED (Created in DB)
   ↓
PENDING_BLOCKCHAIN_CREATION → (Oracle creates smart contract)
   ↓
ACTIVE (On blockchain)
   ↓
DISPATCHED (Supplier ships)
   ↓
DELIVERED (Merchant receives, supplier paid)
   ↓
REPAYMENT_IN_PROGRESS (Repayments being recorded)
   ↓
SETTLED (All repaid, contract closed)

Failure paths:
REJECTED → Contract denied
OVERDUE → Repayment deadline missed
```

---

### 🔐 Security Considerations

1. **Wallet Authentication:** Sign all Oracle requests with backend private key
2. **Rate Limiting:** Limit contract creation to prevent spam
3. **Idempotency:** Use `contract_id` as idempotency key for all blockchain operations
4. **Webhook Verification:** Verify Stellar Horizon webhooks with HMAC-SHA256
5. **Amount Validation:** Always validate amounts before submitting to blockchain

---

### 📝 Oracle Service Endpoints (For Person 2)

The Stellar engineer should expose these endpoints:

```
POST /blockchain/contract/create
POST /blockchain/contract/dispatch
POST /blockchain/contract/deliver
POST /blockchain/contract/repay
POST /blockchain/contract/settle
GET  /blockchain/contract/{stellar_contract_id}/status
POST /blockchain/wallet/create (creates new Stellar wallet)
GET  /blockchain/transactions/{tx_hash} (lookup transaction)
```

---

## Part 3: What's Missing from Backend (Recommendations)

### Must-Have (For Demo)

1. **Stellar Contract ID Storage**
   - Add `stellar_contract_id` to Contract model
   - Update contract endpoints to return this field

2. **Wallet Address Fields**
   - Add wallet fields to Merchant and Supplier models
   - Optional fields initially (can be mocked with fake addresses)

3. **Contract Status Enum Update**
   - Add blockchain states: `PENDING_BLOCKCHAIN_CREATION`, `DISPATCHED`, `DELIVERED`
   - Add settlement fee tracking

4. **Webhook Listener** (Optional but Nice)
   - Add endpoint to receive updates from Stellar Oracle
   - Sync contract status automatically

### Nice-to-Have (Post-MVP)

5. **Risk Flags Endpoint**
   - Add `GET /admin/risk-flags` for contract risk analysis
   - Flag overdue contracts, declining scores, etc.

6. **Merchant Supplier History**
   - Track which merchants buy from which suppliers
   - Build supplier-specific merchant reputation

7. **Admin Dashboard API**
   - `GET /admin/contracts` (all contracts with filtering)
   - `GET /admin/merchants` (all merchants with risk scores)
   - `GET /admin/audit-log` (transaction history)

---

## Summary

✅ **Backend is MVP-complete and Stellar-ready.**  
The main gap is connecting to the Stellar smart contract oracle,  
which requires coordination with Person 2.

**Next Steps:**
1. Person 2 implements Stellar Oracle endpoints
2. Person 1 adds `stellar_contract_id` field and calls Oracle endpoints
3. Person 3 builds UI components and wires to updated endpoints

