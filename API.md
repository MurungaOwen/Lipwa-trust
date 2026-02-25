# 📚 Lipwa-Trust API Documentation

**Base URL:** `http://127.0.0.1:8000`  
**Version:** 0.3.0  
**Status:** Production Ready (MVP)

> 🎯 This document is **the single source of truth** for all frontend integrations.  
> Share this with the frontend team — everything they need is here.

---

## 📋 Quick Reference

| Category | Count | Status |
|----------|-------|--------|
| **Authentication** | 2 | ✅ Ready |
| **Merchant Endpoints** | 5 | ✅ Ready |
| **Supplier Endpoints** | 4 | ✅ Ready |
| **Credit/Contracts** | 4 | ✅ Ready |
| **Repayment** | 1 | ✅ Ready |
| **Total** | **16** | ✅ Ready |

---

## 🔑 Authentication

### 1. Register User

Create a new user account (merchant or supplier).

```http
POST /auth/register
Content-Type: application/json

{
  "email": "merchant@example.com",
  "password": "securepassword123",
  "is_merchant": true,
  "is_supplier": false
}
```

**Response (201):**
```json
{
  "id": 1,
  "email": "merchant@example.com",
  "is_active": true,
  "is_merchant": true,
  "is_supplier": false
}
```

**Error (400):**
```json
{
  "detail": "Email already registered"
}
```

---

### 2. Login User

Authenticate and receive JWT token (set as HttpOnly cookie).

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=merchant@example.com&password=securepassword123
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Headers Set Automatically:**
```
Set-Cookie: access_token=eyJhbGc...; HttpOnly; SameSite=Lax; Max-Age=604800
```

**Error (401):**
```json
{
  "detail": "Incorrect username or password"
}
```

> **🔐 Token Handling:** Token is automatically set as HttpOnly cookie. Frontend can just use it with `credentials: 'include'` in fetch calls.

---

## 🏪 Merchant Endpoints

### 1. Onboard Merchant

Register merchant profile (must be logged in as active user).

```http
POST /merchants/onboard
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "Mama Wanjiku's Kibanda",
  "business_type": "Kibanda",
  "contact_person": "Wanjiku Kipchoge",
  "phone_number": "+254712345678",
  "email": "wanjiku@kibanda.com",
  "avg_daily_sales": 2500.5,
  "consistency": 0.85,
  "days_active": 120
}
```

**Response (200):**
```json
{
  "id": 5,
  "merchant_id": "MER-47392",
  "name": "Mama Wanjiku's Kibanda",
  "business_type": "Kibanda",
  "contact_person": "Wanjiku Kipchoge",
  "phone_number": "+254712345678",
  "email": "wanjiku@kibanda.com",
  "avg_daily_sales": 2500.5,
  "consistency": 0.85,
  "days_active": 120,
  "trust_score": 85,
  "credit_limit": 12502.50,
  "onboarded_at": "2026-02-25T10:30:00Z"
}
```

**Parameters Explanation:**
- `avg_daily_sales` (float): Average KES earned per day
- `consistency` (0-1): How consistent sales are (0.85 = 85% consistent)
- `days_active` (int): Days since first sale

> **💡 Trust Score Formula (MVP):**
> - consistency > 0.8 → +30 points
> - avg_daily_sales > 1000 → +40 points
> - days_active > 90 → +30 points
> - **Max: 100, Min: 0**

---

### 2. Get Merchant Trust Score

Retrieve current trust score and credit limit.

```http
GET /merchant/me/score
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "merchant_id": "MER-47392",
  "trust_score": 85,
  "credit_limit": 12502.50
}
```

---

### 3. Get Merchant Dashboard

Full dashboard with all merchant data and contracts.

```http
GET /merchant/me/dashboard
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "id": 5,
  "merchant_id": "MER-47392",
  "name": "Mama Wanjiku's Kibanda",
  "business_type": "Kibanda",
  "contact_person": "Wanjiku Kipchoge",
  "phone_number": "+254712345678",
  "email": "wanjiku@kibanda.com",
  "avg_daily_sales": 2500.5,
  "consistency": 0.85,
  "days_active": 120,
  "trust_score": 85,
  "credit_limit": 12502.50,
  "onboarded_at": "2026-02-25T10:30:00Z",
  "contracts": [
    {
      "id": 1,
      "merchant_id": "MER-47392",
      "merchant_db_id": 5,
      "supplier_db_id": 3,
      "amount_requested": 6250.0,
      "amount_approved": 6250.0,
      "status": "APPROVED",
      "request_date": "2026-02-25T11:00:00Z",
      "approval_date": "2026-02-25T11:05:00Z",
      "due_date": "2026-03-25T11:05:00Z",
      "total_repaid": 1562.5
    }
  ]
}
```

> **UI Hint:** Use contracts array to show repayment progress bars.

---

### 4. Simulate Daily Sales

Simulate a day's sales activity (updates trust score).

```http
POST /merchant/me/simulate_daily_sales
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "id": 5,
  "merchant_id": "MER-47392",
  "name": "Mama Wanjiku's Kibanda",
  "business_type": "Kibanda",
  "contact_person": "Wanjiku Kipchoge",
  "phone_number": "+254712345678",
  "email": "wanjiku@kibanda.com",
  "avg_daily_sales": 2650.8,
  "consistency": 0.87,
  "days_active": 121,
  "trust_score": 87,
  "credit_limit": 13254.0,
  "onboarded_at": "2026-02-25T10:30:00Z"
}
```

> **Purpose:** Used for testing/demo. In production, this would be automated via Pay Hero webhook.

---

## 💳 Credit & Contract Endpoints

### 1. Apply for Credit

Request inventory financing.

```http
POST /credit/apply
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "amount_requested": 5000.0,
  "supplier_db_id": 3
}
```

**Parameters:**
- `amount_requested` (required, float): Amount in KES
- `supplier_db_id` (optional, int): ID of supplier to finance from

**Response (200):**
```json
{
  "id": 42,
  "merchant_id": "MER-47392",
  "merchant_db_id": 5,
  "supplier_db_id": 3,
  "amount_requested": 5000.0,
  "amount_approved": 5000.0,
  "status": "APPROVED",
  "request_date": "2026-02-25T14:00:00Z",
  "approval_date": "2026-02-25T14:00:05Z",
  "due_date": "2026-03-25T14:00:05Z",
  "total_repaid": 0.0
}
```

**Error (403) - Trust Score Too Low:**
```json
{
  "detail": "Trust score too low (35). Minimum required: 40."
}
```

**Error (403) - Amount Exceeds Limit:**
```json
{
  "detail": "Amount requested (15000.0) exceeds available credit limit (12500.0)."
}
```

> **Status Codes:**
> - `200`: Contract created successfully
> - `403`: Insufficient trust score or credit limit
> - `404`: Merchant profile not found

---

### 2. List All Suppliers

View available suppliers to finance from.

```http
GET /suppliers?skip=0&limit=100
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `skip` (optional, default=0): Pagination offset
- `limit` (optional, default=100): Max results

**Response (200):**
```json
[
  {
    "id": 1,
    "supplier_id": "SUP-4521",
    "name": "Jumia Wholesale Supplies",
    "contact_person": "Ahmed Hassan",
    "phone_number": "+254713333333",
    "email": "sales@jumia-wholesale.com",
    "product_category": "Wholesale Groceries",
    "onboarded_at": "2026-02-20T08:00:00Z"
  },
  {
    "id": 2,
    "supplier_id": "SUP-6789",
    "name": "TechWare Kenya",
    "contact_person": "John Omondi",
    "phone_number": "+254714444444",
    "email": "sales@techware.com",
    "product_category": "Electronics",
    "onboarded_at": "2026-02-21T09:30:00Z"
  }
]
```

---

## 🏭 Supplier Endpoints

### 1. Onboard Supplier

Register supplier profile.

```http
POST /suppliers/onboard
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "Jumia Wholesale Supplies",
  "contact_person": "Ahmed Hassan",
  "phone_number": "+254713333333",
  "email": "sales@jumia-wholesale.com",
  "product_category": "Wholesale Groceries"
}
```

**Response (200):**
```json
{
  "id": 10,
  "supplier_id": "SUP-8765",
  "name": "Jumia Wholesale Supplies",
  "contact_person": "Ahmed Hassan",
  "phone_number": "+254713333333",
  "email": "sales@jumia-wholesale.com",
  "product_category": "Wholesale Groceries",
  "onboarded_at": "2026-02-25T15:00:00Z"
}
```

---

### 2. Get Supplier Details

Get logged-in supplier's profile.

```http
GET /supplier/me
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "id": 10,
  "supplier_id": "SUP-8765",
  "name": "Jumia Wholesale Supplies",
  "contact_person": "Ahmed Hassan",
  "phone_number": "+254713333333",
  "email": "sales@jumia-wholesale.com",
  "product_category": "Wholesale Groceries",
  "onboarded_at": "2026-02-25T15:00:00Z"
}
```

---

### 3. Get All Contracts (Supplier)

List all contracts (active and completed) for supplier.

```http
GET /supplier/me/contracts
Authorization: Bearer {access_token}
```

**Response (200):**
```json
[
  {
    "id": 42,
    "merchant_id": "MER-47392",
    "merchant_db_id": 5,
    "supplier_db_id": 10,
    "amount_requested": 5000.0,
    "amount_approved": 5000.0,
    "status": "APPROVED",
    "request_date": "2026-02-25T14:00:00Z",
    "approval_date": "2026-02-25T14:00:05Z",
    "due_date": "2026-03-25T14:00:05Z",
    "total_repaid": 0.0
  },
  {
    "id": 41,
    "merchant_id": "MER-12345",
    "merchant_db_id": 3,
    "supplier_db_id": 10,
    "amount_requested": 3500.0,
    "amount_approved": 3500.0,
    "status": "SETTLED",
    "request_date": "2026-02-20T10:00:00Z",
    "approval_date": "2026-02-20T10:05:00Z",
    "due_date": "2026-03-20T10:05:00Z",
    "total_repaid": 3500.0
  }
]
```

---

### 4. Get Active Contracts Only (Supplier)

List only ongoing contracts (not settled or rejected).

```http
GET /supplier/me/contracts/active
Authorization: Bearer {access_token}
```

**Response (200):**
```json
[
  {
    "id": 42,
    "merchant_id": "MER-47392",
    "merchant_db_id": 5,
    "supplier_db_id": 10,
    "amount_requested": 5000.0,
    "amount_approved": 5000.0,
    "status": "APPROVED",
    "request_date": "2026-02-25T14:00:00Z",
    "approval_date": "2026-02-25T14:00:05Z",
    "due_date": "2026-03-25T14:00:05Z",
    "total_repaid": 0.0
  }
]
```

---

## 💰 Repayment Endpoints

### 1. Record Repayment

Make a repayment toward a contract (merchant only).

```http
POST /repayment/settle
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "contract_id": 42,
  "amount": 1250.0
}
```

**Parameters:**
- `contract_id` (required, int): Contract ID to repay
- `amount` (required, float): Repayment amount in KES

**Response (200):**
```json
{
  "id": 1,
  "contract_id": 42,
  "amount": 1250.0,
  "repayment_date": "2026-02-25T16:30:00Z"
}
```

**Error (403) - Contract Already Settled:**
```json
{
  "detail": "Contract is already settled."
}
```

**Error (403) - Insufficient Authorization:**
```json
{
  "detail": "Contract does not belong to the current merchant."
}
```

**Error (400) - Invalid Amount:**
```json
{
  "detail": "Repayment amount must be positive."
}
```

> **Auto-Capping:** If repayment exceeds remaining balance, it's automatically capped.  
> Contract status automatically changes to `SETTLED` when fully repaid.

---

## 📊 Data Models Reference

### Merchant Object

```typescript
interface Merchant {
  id: number;
  merchant_id: string;           // e.g., "MER-47392"
  name: string;
  business_type: string;         // "Kibanda", "Duka", etc.
  contact_person: string;
  phone_number: string;
  email?: string;
  avg_daily_sales: number;       // KES
  consistency: number;            // 0-1
  days_active: number;           // days
  trust_score: number;            // 0-100
  credit_limit: number;          // KES
  onboarded_at: string;          // ISO 8601 datetime
}
```

### Supplier Object

```typescript
interface Supplier {
  id: number;
  supplier_id: string;            // e.g., "SUP-4521"
  name: string;
  contact_person: string;
  phone_number: string;
  email?: string;
  product_category?: string;      // e.g., "Wholesale Groceries"
  onboarded_at: string;           // ISO 8601 datetime
}
```

### Contract Object

```typescript
interface Contract {
  id: number;
  merchant_id: string;            // e.g., "MER-47392"
  merchant_db_id: number;
  supplier_db_id?: number;
  amount_requested: number;       // KES
  amount_approved?: number;       // KES
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISPATCHED" | "DELIVERED" | "SETTLED" | "OVERDUE";
  request_date: string;           // ISO 8601
  approval_date?: string;         // ISO 8601
  due_date?: string;              // ISO 8601
  total_repaid: number;           // KES
}
```

### Repayment Object

```typescript
interface Repayment {
  id: number;
  contract_id: number;
  amount: number;                 // KES
  repayment_date: string;         // ISO 8601
}
```

---

## 🚨 Error Handling

All errors follow this format:

```json
{
  "detail": "Human-readable error message"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Contract approved |
| 400 | Bad request | Invalid email format |
| 401 | Unauthorized | No valid token |
| 403 | Forbidden | Low trust score, wrong user type |
| 404 | Not found | Merchant profile missing |
| 500 | Server error | Database connection failed |

---

## 🔐 Authentication Pattern

### With Fetch API

```javascript
// Login
const loginResponse = await fetch('http://127.0.0.1:8000/auth/login', {
  method: 'POST',
  credentials: 'include', // Important: sends/receives cookies
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    username: 'merchant@example.com',
    password: 'password123'
  })
});

const { access_token } = await loginResponse.json();

// Subsequent API calls (token is in cookie)
const dashboardResponse = await fetch('http://127.0.0.1:8000/merchant/me/dashboard', {
  method: 'GET',
  credentials: 'include'  // Automatically sends access_token cookie
});
```

### With Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  withCredentials: true  // Important: sends/receives cookies
});

// Login
const { data } = await api.post('/auth/login', {
  username: 'merchant@example.com',
  password: 'password123'
});

// All subsequent calls automatically include the token
const dashboard = await api.get('/merchant/me/dashboard');
```

---

## 📋 Implementation Checklist for Frontend

- [ ] **Auth Pages**
  - [ ] Login page (email + password)
  - [ ] Register page (email + password + role select)
  
- [ ] **Merchant Dashboard**
  - [ ] Trust score display (gauge or progress bar)
  - [ ] Credit limit card
  - [ ] Active contracts list with repayment progress
  - [ ] "Request Credit" button → form

- [ ] **Credit Request Form**
  - [ ] Amount input with max limit validation
  - [ ] Supplier dropdown
  - [ ] Submit button → calls POST /credit/apply
  - [ ] Success/error toast notifications

- [ ] **Repayment UI**
  - [ ] Contract list with status badges
  - [ ] Repayment form (amount input with max validation)
  - [ ] Progress bar showing repayment %
  - [ ] Auto-disable when contract settled

- [ ] **Supplier Dashboard**
  - [ ] Supplier info card
  - [ ] Incoming orders table
  - [ ] Order status badges
  - [ ] Contracts list with merchant details

- [ ] **General**
  - [ ] Logout functionality
  - [ ] Error handling with user-friendly messages
  - [ ] Loading states on all API calls
  - [ ] Empty states for no data

---

## 🧪 Test Data (Seed Database)

To seed test data:

```bash
cd backend
python seeder.py
```

This creates:
- **10 merchants** with varying trust scores
- **3 suppliers** with product categories
- Ready to onboard via UI and test the full flow

---

## 🎯 Demo Flow (For Hackathon Judges)

1. **Register & Login** → New merchant account
2. **Onboard Merchant** → Set sales data, view auto-calculated trust score
3. **View Suppliers** → See all available suppliers with categories
4. **Apply for Credit** → Request KES 5,000, pick supplier, get approved instantly
5. **Simulate Sales** → Click "Simulate Day" to see score increase
6. **Record Repayment** → Make 3 payments to settle contract
7. **Check Supplier View** → Switch to supplier account, see incoming orders
8. **Check Updated Trust Score** → Merchant score increased after repayment

---

## 📞 Support

- **Backend Issues?** Check `/` root endpoint to verify server is running
- **Token Expired?** Re-login to get a new token
- **Database Reset?** Run `python seeder.py` again to refresh test data

---

**Last Updated:** February 25, 2026  
**Maintained By:** Backend Team (Person 1)  
**Status:** ✅ Production Ready

