# ─────────────────────────────────────────────────────────────────────────────
# ADD THESE ENDPOINTS TO main.py
# Place them after the existing /supplier/me/contracts/active endpoint
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, Depends, HTTPException, status, Response
# (all your existing imports stay the same — just add these endpoints)

# ── Supplier contract actions ─────────────────────────────────────────────────

@app.post("/supplier/contracts/{contract_id}/approve", response_model=ContractDB)
async def approve_contract(
    contract_id: int,
    current_user: User = Depends(get_current_supplier_user),
    db: Session = Depends(get_db)
):
    """Supplier approves a PENDING contract → status becomes APPROVED."""
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
    # TODO (P2): trigger Stellar payout here
    # e.g. await stellar_oracle.trigger_payout(contract.id, contract.amount_approved)
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
