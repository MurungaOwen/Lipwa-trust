from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models.contract import ContractDB # Import ContractDB

# --- Pydantic Schemas ---

class MerchantBase(BaseModel):
    merchant_id: str
    name: str
    business_type: str
    contact_person: str
    phone_number: str
    email: Optional[str] = None
    # Data for initial trust score calculation
    avg_daily_sales: float
    consistency: float # e.g., standard deviation of daily sales or frequency of sales days
    days_active: int # days since first recorded sale

class MerchantCreate(MerchantBase):
    merchant_id: Optional[str] = None # Make merchant_id optional for creation

class MerchantDB(MerchantBase):
    id: int
    trust_score: Optional[int] = None
    credit_limit: Optional[float] = None
    onboarded_at: datetime

    class Config:
        from_attributes = True

class TrustScoreResponse(BaseModel):
    merchant_id: str
    trust_score: int
    credit_limit: float

class MerchantDashboard(MerchantDB):
    contracts: List[ContractDB] = []
