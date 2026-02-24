from sqlalchemy.orm import Session
from db.base import Repayment, Contract, ContractStatus
from models.repayment import RepaymentCreate
from datetime import datetime

def create_repayment(db: Session, repayment: RepaymentCreate):
    """
    Records a new repayment and updates the associated contract's total_repaid and status.
    """
    db_repayment = Repayment(**repayment.model_dump())
    db.add(db_repayment)
    db.commit()
    db.refresh(db_repayment)

    # Update contract's total_repaid and status
    contract = db.query(Contract).filter(Contract.id == repayment.contract_id).first()
    if contract:
        contract.total_repaid += repayment.amount
        if contract.amount_approved and contract.total_repaid >= contract.amount_approved:
            contract.status = ContractStatus.SETTLED.value
        db.add(contract)
        db.commit()
        db.refresh(contract)
    
    return db_repayment

def get_repayments_by_contract_id(db: Session, contract_id: int):
    """
    Retrieves all repayments for a given contract ID.
    """
    return db.query(Repayment).filter(Repayment.contract_id == contract_id).all()
