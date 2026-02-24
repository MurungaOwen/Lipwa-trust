from pydantic import BaseModel
from datetime import datetime

class RepaymentBase(BaseModel):
    contract_id: int
    amount: float

class RepaymentCreate(RepaymentBase):
    pass

class RepaymentDB(RepaymentBase):
    id: int
    repayment_date: datetime

    class Config:
        from_attributes = True
