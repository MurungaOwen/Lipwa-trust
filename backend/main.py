from fastapi import FastAPI, Depends, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import random # Needed for generating merchant/supplier IDs

from trust_score_engine import calculate_trust_score
from db.session import SessionLocal, engine
from db.base import Base, Contract, User, Supplier, Merchant, ContractStatus
from models.merchant import MerchantCreate, MerchantDB, TrustScoreResponse, MerchantDashboard
from models.contract import CreditApplicationRequest, ContractDB
from models.supplier import SupplierCreate, SupplierDB
from models.repayment import RepaymentCreate, RepaymentDB
from models.user import UserCreate, UserInDB, Token
from crud import merchant as crud_merchant
from crud import contract as crud_contract
from crud import supplier as crud_supplier
from crud import repayment as crud_repayment
from crud import user as crud_user
from core.security import verify_password, create_access_token
from core.config import settings
from dependencies import get_current_active_user, get_current_merchant_user, get_current_supplier_user # Import dependencies
from core import blockchain

app = FastAPI(
    title="Lipwa-Trust Backend",
    description="Backend API for Lipwa-Trust with SQLite integration and JWT Auth.",
    version="0.3.0",
)

# --- CORS Middleware ---
origins = ["http://localhost:5173",
           "http://127.0.0.1:5173",
          ] # Allow all origins for hackathon MVP

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Initialization on Startup ---
@app.on_event("startup")
def on_startup():
    # Create all tables if they don't exist
    # This is for SQLite "drop and recreate" strategy
    Base.metadata.create_all(bind=engine)

# --- Dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Endpoints ---

# Authentication Endpoints
@app.post("/auth/register", response_model=UserInDB, summary="Register a new user")
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user with their email and password.
    Users can be registered as a merchant or a supplier.
    """
    db_user = crud_user.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    return crud_user.create_user(db=db, user=user)

@app.post("/auth/login", response_model=Token, summary="Log in user and get JWT token")
async def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), # FastAPI's built-in form data parser for OAuth2
    db: Session = Depends(get_db)
):
    """
    Logs in a user with email and password, returning an access token.
    The access token is also set as an HttpOnly cookie.
    """
    user = crud_user.get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "is_merchant": user.is_merchant, "is_supplier": user.is_supplier},
        expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token", 
        value=access_token, 
        httponly=True, 
        samesite="lax", # Strict, Lax, None. Lax is often a good default.
        secure=False, # Set to True in production for HTTPS
        max_age=int(access_token_expires.total_seconds()),
        path="/",
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Make sure there are NO spaces before @app
@app.get("/auth/me", response_model=UserInDB)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    user_data = UserInDB.model_validate(current_user)
    user_data.has_merchant_profile = current_user.merchant_profile is not None
    user_data.has_supplier_profile = current_user.supplier_profile is not None
    return user_data

# Merchant Endpoints
@app.post("/merchants/onboard", response_model=MerchantDB, summary="Onboard a new merchant (requires login)")
async def onboard_merchant(
    merchant_data: MerchantCreate, # Renamed to avoid clash with request
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Onboards a new merchant into the Lipwa-Trust system, linking it to the logged-in user.
    - User must be logged in.
    - Calculates an initial trust score and credit limit.
    """
    if current_user.merchant_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a merchant profile.")

    # Generate a unique merchant_id (since it's no longer from request body)
    generated_merchant_id = f"MER-{random.randint(10000, 99999)}"
    while crud_merchant.get_merchant_by_merchant_id(db, merchant_id=generated_merchant_id):
        generated_merchant_id = f"MER-{random.randint(10000, 99999)}"

    # Create a temporary MerchantCreate object with generated merchant_id
    merchant_data_dict = merchant_data.model_dump()
    merchant_data_dict.pop('merchant_id', None)  # Remove merchant_id if it exists to avoid duplicate keyword argument
    temp_merchant_create = MerchantCreate(merchant_id=generated_merchant_id, **merchant_data_dict)

    score_data = calculate_trust_score(
        merchant_data.avg_daily_sales,
        merchant_data.consistency,
        merchant_data.days_active
    )

    new_merchant = crud_merchant.create_merchant(
        db=db,
        merchant=temp_merchant_create,
        trust_score=score_data["score"],
        credit_limit=score_data["credit_limit"],
        user_id=current_user.id # Link to current user
    )

    # Update user's is_merchant flag
    crud_user.update_user_is_merchant(db, current_user.id, True)

    # Blockchain Wallet Creation
    wallet_data = await blockchain.create_blockchain_wallet(owner_id=new_merchant.merchant_id, wallet_type="merchant")
    if wallet_data:
        new_merchant.blockchain_wallet_id = wallet_data.get("walletId")
        new_merchant.blockchain_public_key = wallet_data.get("publicKey")
        db.add(new_merchant)
        db.commit()
        db.refresh(new_merchant)
    
    return new_merchant

@app.get("/merchant/me/score", response_model=TrustScoreResponse, summary="Get logged-in merchant's trust score and credit limit")
async def get_my_trust_score(
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the current trust score and credit limit for the logged-in merchant.
    """
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant profile not found for this user.")

    return TrustScoreResponse(
        merchant_id=merchant.merchant_id,
        trust_score=merchant.trust_score,
        credit_limit=merchant.credit_limit
    )

@app.get("/merchant/me/dashboard", response_model=MerchantDashboard, summary="Get full dashboard data for logged-in merchant")
async def get_my_merchant_dashboard(
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all relevant data for the logged-in merchant's dashboard,
    including their profile, trust score, credit limit, and all associated contracts.
    """
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant profile not found for this user.")
    
    contracts = crud_contract.get_contracts_by_merchant_id(db, merchant_id=merchant.merchant_id)
    
    merchant_data = MerchantDB.model_validate(merchant)
    contract_data = [ContractDB.model_validate(c) for c in contracts]
    
    return MerchantDashboard(
        **merchant_data.model_dump(),
        contracts=contract_data
    )

@app.post("/merchant/me/simulate_daily_sales", response_model=MerchantDB, summary="Simulate a day's sales for logged-in merchant and update their trust score")
async def simulate_my_daily_sales(
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """
    Simulates a day's sales activity for the logged-in merchant,
    updating their average daily sales, consistency, days active,
    and recalculating their trust score and credit limit.
    """
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant profile not found for this user.")
    
    updated_merchant = crud_merchant.update_merchant_sales_and_score(db, merchant)
    return updated_merchant


# Credit Endpoints
@app.post("/credit/apply", response_model=ContractDB, summary="Apply for credit/inventory financing (logged-in merchant)")
async def apply_for_credit(
    request: CreditApplicationRequest,
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """
    Allows the logged-in merchant to apply for credit or inventory financing.
    Performs checks against the merchant's trust score and credit limit.
    """
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant profile not found for this user.")

    # Basic approval logic for MVP
    min_trust_score_for_credit = 40
    if merchant.trust_score < min_trust_score_for_credit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Trust score too low ({merchant.trust_score}). Minimum required: {min_trust_score_for_credit}."
        )
    
    if request.amount_requested > merchant.credit_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Amount requested ({request.amount_requested}) exceeds available credit limit ({merchant.credit_limit})."
        )
    
    # If all checks pass, create the contract (starts PENDING — supplier must approve)
    amount_approved = request.amount_requested
    new_contract = crud_contract.create_contract(
        db,
        request,
        amount_approved,
        merchant.id,
        merchant_id=merchant.merchant_id,
        supplier_db_id=getattr(request, 'supplier_db_id', None)
    )
    print(f"[BACKEND] Created contract #{new_contract.id} for merchant {merchant.merchant_id} amount={amount_approved}")

    # Blockchain Contract Creation (when both wallets exist)
    supplier = None
    if request.supplier_db_id:
        supplier = db.query(Supplier).filter(Supplier.id == request.supplier_db_id).first()

    if merchant.blockchain_wallet_id and supplier and supplier.blockchain_wallet_id:
        print(f"[BLOCKCHAIN] Creating on-chain contract: merchant_wallet={merchant.blockchain_wallet_id} supplier_wallet={supplier.blockchain_wallet_id} amount={amount_approved}")
        contract_data = await blockchain.create_blockchain_contract(
            merchant_wallet_id=merchant.blockchain_wallet_id,
            supplier_wallet_id=supplier.blockchain_wallet_id,
            amount=amount_approved,
            deadline_hours=settings.BLOCKCHAIN_DISPATCH_DEADLINE_HOURS
        )
        if contract_data:
            bc_id = contract_data.get("contractId")
            new_contract.blockchain_contract_id = bc_id
            db.add(new_contract)
            db.commit()
            db.refresh(new_contract)
            print(f"[BLOCKCHAIN] ✅ On-chain contract created: {bc_id}")
            print(f"[BLOCKCHAIN] 🌐 View at: https://stellar.expert/explorer/testnet/contract/{bc_id}")
        else:
            print(f"[BLOCKCHAIN] ⚠ Oracle did not return contractId. Contract saved off-chain only.")
    else:
        missing = []
        if not merchant.blockchain_wallet_id: missing.append("merchant wallet")
        if not supplier: missing.append("supplier not found")
        elif not supplier.blockchain_wallet_id: missing.append("supplier wallet")
        print(f"[BLOCKCHAIN] Skipping on-chain contract — missing: {', '.join(missing)}")

    return new_contract

# Repayment Endpoints
@app.post("/repayment/settle", response_model=RepaymentDB, summary="Record a repayment for a contract (logged-in merchant)")
async def record_repayment(
    request: RepaymentCreate,
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """
    Records a repayment for a specific contract belonging to the logged-in merchant
    and updates the contract's total_repaid and status.
    """
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant profile not found for this user.")

    contract = db.query(Contract).filter(Contract.id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found.")
    
    # Authorization check: Ensure contract belongs to the current merchant
    if contract.merchant_db_id != merchant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Contract does not belong to the current merchant.")

    if request.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Repayment amount must be positive.")

    # Prevent over-repayment or repayment on settled/rejected contracts (simple MVP logic)
    if contract.status == ContractStatus.SETTLED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract is already settled.")
    if contract.status == ContractStatus.REJECTED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract was rejected.")
    
    # If amount repaid exceeds remaining balance, cap it (simple MVP logic)
    if contract.amount_approved and (contract.total_repaid + request.amount > contract.amount_approved):
        repayment_amount = contract.amount_approved - contract.total_repaid
        if repayment_amount <= 0: # Already fully repaid or more
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract already fully repaid.")
        request.amount = repayment_amount # Adjust repayment to settle exactly
    
    res = crud_repayment.create_repayment(db=db, repayment=request)
    
    # Blockchain Repayment
    if contract.blockchain_contract_id:
        await blockchain.record_blockchain_repayment(contract.blockchain_contract_id, request.amount)
        
    return res

# Supplier Endpoints
@app.post("/suppliers/onboard", response_model=SupplierDB, summary="Onboard a new supplier (requires login)")
async def onboard_supplier(
    supplier_data: SupplierCreate, # Renamed to avoid clash with request
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Onboards a new supplier into the Lipwa-Trust system, linking it to the logged-in user.
    - User must be logged in.
    """
    if current_user.supplier_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a supplier profile.")

    # Generate a unique supplier_id
    generated_supplier_id = f"SUP-{random.randint(1000, 9999)}"
    while crud_supplier.get_supplier_by_supplier_id(db, supplier_id=generated_supplier_id):
        generated_supplier_id = f"SUP-{random.randint(1000, 9999)}"

    # Create a temporary SupplierCreate object with generated supplier_id
    supplier_data_dict = supplier_data.model_dump()
    supplier_data_dict.pop('supplier_id', None)  # Remove supplier_id if it exists to avoid duplicate keyword argument
    temp_supplier_create = SupplierCreate(supplier_id=generated_supplier_id, **supplier_data_dict)

    new_supplier = crud_supplier.create_supplier(
        db=db,
        supplier=temp_supplier_create,
        user_id=current_user.id # Link to current user
    )

    # Update user's is_supplier flag
    crud_user.update_user_is_supplier(db, current_user.id, True)

    # Blockchain Wallet Creation
    wallet_data = await blockchain.create_blockchain_wallet(owner_id=new_supplier.supplier_id, wallet_type="supplier")
    if wallet_data:
        new_supplier.blockchain_wallet_id = wallet_data.get("walletId")
        new_supplier.blockchain_public_key = wallet_data.get("publicKey")
        db.add(new_supplier)
        db.commit()
        db.refresh(new_supplier)
    
    return new_supplier

@app.get("/supplier/me", response_model=SupplierDB, summary="Get logged-in supplier's details")
async def get_my_supplier_details(
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the details of the logged-in supplier.
    """
    supplier = current_user.supplier_profile
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found for this user.")
    return supplier


@app.get("/supplier/me/contracts", response_model=List[ContractDB], summary="Get all contracts for logged-in supplier")
async def get_my_supplier_contracts(
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all contracts (both active and completed) for the logged-in supplier.
    """
    supplier = current_user.supplier_profile
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found for this user.")
    
    contracts = crud_contract.get_contracts_by_supplier_id(db, supplier.id)
    return contracts


@app.get("/supplier/me/contracts/active", response_model=List[ContractDB], summary="Get active contracts for logged-in supplier")
async def get_my_supplier_active_contracts(
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves only active (ongoing) contracts for the logged-in supplier.
    Active means not settled or rejected.
    """
    supplier = current_user.supplier_profile
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found for this user.")
    
    active_contracts = crud_contract.get_active_contracts_for_supplier(db, supplier.id)
    return active_contracts
@app.post("/supplier/contracts/{contract_id}/approve", response_model=ContractDB)
async def approve_contract(
    contract_id: int,
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """Supplier approves a PENDING contract → status becomes APPROVED, escrow funded on-chain."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.supplier_db_id != current_user.supplier_profile.id:
        raise HTTPException(status_code=403, detail="Not your contract.")
    if contract.status != ContractStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Contract is {contract.status}, not PENDING.")

    contract.status = ContractStatus.APPROVED.value
    contract.approval_date = datetime.utcnow()
    db.commit()
    db.refresh(contract)
    print(f"[BACKEND] Contract #{contract_id} approved by supplier {current_user.supplier_profile.supplier_id}")

    # Blockchain: Fund Escrow
    if contract.blockchain_contract_id and current_user.supplier_profile.blockchain_wallet_id:
        print(f"[BLOCKCHAIN] Funding escrow for contract {contract.blockchain_contract_id} amount={contract.amount_approved}")
        ok = await blockchain.fund_blockchain_contract(
            contract_id=contract.blockchain_contract_id,
            from_wallet_id=current_user.supplier_profile.blockchain_wallet_id,
            amount=contract.amount_approved
        )
        if ok:
            print(f"[BLOCKCHAIN] ✅ Escrow funded for {contract.blockchain_contract_id}")
        else:
            print(f"[BLOCKCHAIN] ⚠ Escrow funding failed for {contract.blockchain_contract_id}")

    return contract


@app.post("/supplier/contracts/{contract_id}/dispatch", response_model=ContractDB)
async def dispatch_contract(
    contract_id: int,
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """Supplier marks goods as dispatched → status becomes DISPATCHED."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.supplier_db_id != current_user.supplier_profile.id:
        raise HTTPException(status_code=403, detail="Not your contract.")
    if contract.status != ContractStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail=f"Contract must be APPROVED before dispatch. Current: {contract.status}.")

    contract.status = ContractStatus.DISPATCHED.value

    # Blockchain Dispatch
    if contract.blockchain_contract_id and current_user.supplier_profile.blockchain_wallet_id:
        print(f"[BLOCKCHAIN] Dispatching goods for contract {contract.blockchain_contract_id}")
        ok = await blockchain.dispatch_blockchain_goods(
            contract.blockchain_contract_id,
            current_user.supplier_profile.blockchain_wallet_id
        )
        if ok:
            print(f"[BLOCKCHAIN] ✅ Dispatch recorded on-chain for {contract.blockchain_contract_id}")
        else:
            print(f"[BLOCKCHAIN] ⚠ Dispatch oracle call failed for {contract.blockchain_contract_id}")

    db.commit()
    db.refresh(contract)
    return contract


@app.post("/supplier/contracts/{contract_id}/deliver", response_model=ContractDB)
async def confirm_delivery(
    contract_id: int,
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """Supplier confirms delivery → status becomes DELIVERED, payout triggered."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.supplier_db_id != current_user.supplier_profile.id:
        raise HTTPException(status_code=403, detail="Not your contract.")
    if contract.status != ContractStatus.DISPATCHED.value:
        raise HTTPException(status_code=400, detail=f"Contract must be DISPATCHED before delivery. Current: {contract.status}.")

    contract.status = ContractStatus.DELIVERED.value

    # Blockchain Delivery — use the MERCHANT's wallet (loaded from contract relationship)
    if contract.blockchain_contract_id and contract.merchant and contract.merchant.blockchain_wallet_id:
        print(f"[BLOCKCHAIN] Confirming delivery for contract {contract.blockchain_contract_id}")
        ok = await blockchain.confirm_blockchain_delivery(
            contract.blockchain_contract_id,
            contract.merchant.blockchain_wallet_id
        )
        if ok:
            print(f"[BLOCKCHAIN] ✅ Delivery confirmed, payout triggered for {contract.blockchain_contract_id}")
        else:
            print(f"[BLOCKCHAIN] ⚠ Delivery confirmation failed for {contract.blockchain_contract_id}")

    db.commit()
    db.refresh(contract)
    return contract


@app.get("/supplier/me/dashboard")
async def get_supplier_dashboard(
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """Full supplier dashboard — profile + all contracts grouped by status."""
    supplier = current_user.supplier_profile
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier profile not found.")

    all_contracts = crud_contract.get_contracts_by_supplier_id(db, supplier.id)

    pending    = [c for c in all_contracts if c.status == ContractStatus.PENDING.value]
    approved   = [c for c in all_contracts if c.status == ContractStatus.APPROVED.value]
    dispatched = [c for c in all_contracts if c.status == ContractStatus.DISPATCHED.value]
    delivered  = [c for c in all_contracts if c.status == ContractStatus.DELIVERED.value]
    settled    = [c for c in all_contracts if c.status == ContractStatus.SETTLED.value]

    total_value    = sum(c.amount_approved or 0 for c in all_contracts)
    total_repaid   = sum(c.total_repaid or 0 for c in all_contracts)
    settled_value  = sum(c.amount_approved or 0 for c in settled)

    return {
        "supplier": {
            "id": supplier.id,
            "supplier_id": supplier.supplier_id,
            "name": supplier.name,
            "contact_person": supplier.contact_person,
            "phone_number": supplier.phone_number,
            "email": supplier.email,
            "product_category": supplier.product_category,
        },
        "stats": {
            "total_contracts": len(all_contracts),
            "pending_count":    len(pending),
            "approved_count":   len(approved),
            "dispatched_count": len(dispatched),
            "delivered_count":  len(delivered),
            "settled_count":    len(settled),
            "total_value":      total_value,
            "total_repaid":     total_repaid,
            "settled_value":    settled_value,
        },
        "contracts": {
            "pending":    [ContractDB.model_validate(c).model_dump() for c in pending],
            "approved":   [ContractDB.model_validate(c).model_dump() for c in approved],
            "dispatched": [ContractDB.model_validate(c).model_dump() for c in dispatched],
            "delivered":  [ContractDB.model_validate(c).model_dump() for c in delivered],
            "settled":    [ContractDB.model_validate(c).model_dump() for c in settled],
        }
    }

@app.get("/suppliers", response_model=List[SupplierDB], summary="Get a list of all suppliers (active user access)")
async def get_all_suppliers(
    current_user: User = Depends(get_current_active_user), # Protected endpoint
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """
    Retrieves a list of all registered suppliers. Accessible by any active logged-in user.
    """
    suppliers = crud_supplier.get_all_suppliers(db, skip=skip, limit=limit)
    return suppliers

@app.get("/contracts/{contract_id}/blockchain-status", summary="Get live on-chain status for a contract")
async def get_contract_blockchain_status(
    contract_id: int,
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """Fetches the live on-chain state for a contract from the Stellar oracle."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.merchant_db_id != current_user.merchant_profile.id:
        raise HTTPException(status_code=403, detail="Not your contract.")
    if not contract.blockchain_contract_id:
        return {"error": "No blockchain contract ID for this contract.", "on_chain": False}

    on_chain = await blockchain.get_blockchain_contract_status(contract.blockchain_contract_id)
    if not on_chain:
        raise HTTPException(status_code=502, detail="Could not reach blockchain oracle.")

    stellar_explorer_url = (
        f"https://stellar.expert/explorer/testnet/contract/{contract.blockchain_contract_id}"
    )
    return {
        **on_chain,
        "on_chain": True,
        "blockchain_contract_id": contract.blockchain_contract_id,
        "explorer_url": stellar_explorer_url,
    }


@app.post("/repayment/simulate", summary="Simulate a repayment for a contract (merchant only)")
async def simulate_repayment(
    request: RepaymentCreate,
    current_user: User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db)
):
    """Simulate a repayment — same as /repayment/settle but clearly marked as a simulation endpoint."""
    merchant = current_user.merchant_profile
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant profile not found.")

    contract = db.query(Contract).filter(Contract.id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.merchant_db_id != merchant.id:
        raise HTTPException(status_code=403, detail="Contract does not belong to you.")
    if contract.status == ContractStatus.SETTLED.value:
        raise HTTPException(status_code=400, detail="Contract is already settled.")
    if contract.status == ContractStatus.REJECTED.value:
        raise HTTPException(status_code=400, detail="Contract was rejected.")

    remaining = (contract.amount_approved or 0) - (contract.total_repaid or 0)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Contract already fully repaid.")
    
    pay_amount = min(request.amount, remaining)
    request.amount = pay_amount

    res = crud_repayment.create_repayment(db=db, repayment=request)

    blockchain_result = None
    if contract.blockchain_contract_id:
        ok = await blockchain.record_blockchain_repayment(contract.blockchain_contract_id, pay_amount)
        blockchain_result = {"recorded_on_chain": ok, "blockchain_contract_id": contract.blockchain_contract_id}

    # Refresh contract to get updated status
    db.refresh(contract)
    return {
        "repayment": RepaymentDB.model_validate(res).model_dump(),
        "contract_status": contract.status,
        "total_repaid": contract.total_repaid,
        "remaining": max(0, (contract.amount_approved or 0) - (contract.total_repaid or 0)),
        "blockchain": blockchain_result,
    }


@app.get("/", summary="Root endpoint")
async def root():
    return {"message": "Lipwa-Trust Backend is running!"}

# To run this application:
# 1. Ensure you have created a Python virtual environment and activated it.
# 2. Install dependencies: pip install -r requirements.txt
# 3. cd backend
# 4. uvicorn main:app --reload --port 8000
