from sqlalchemy.orm import Session
from db.base import User
from models.user import UserCreate
from core.security import get_password_hash

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        is_merchant=user.is_merchant,
        is_supplier=user.is_supplier
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_is_merchant(db: Session, user_id: int, is_merchant: bool):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db_user.is_merchant = is_merchant
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    return db_user

def update_user_is_supplier(db: Session, user_id: int, is_supplier: bool):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db_user.is_supplier = is_supplier
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    return db_user
