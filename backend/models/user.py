from pydantic import BaseModel
from typing import Optional

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    is_merchant: bool = False
    is_supplier: bool = False

class UserInDBBase(UserBase):
    id: int
    is_active: bool
    is_merchant: bool
    is_supplier: bool

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
