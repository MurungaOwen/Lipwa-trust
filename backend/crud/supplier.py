from sqlalchemy.orm import Session
from db.base import Supplier
from models.supplier import SupplierCreate

def get_supplier_by_supplier_id(db: Session, supplier_id: str):
    """
    Retrieves a supplier from the database by their supplier_id.
    """
    return db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()

def get_all_suppliers(db: Session, skip: int = 0, limit: int = 100):
    """
    Retrieves all suppliers from the database.
    """
    return db.query(Supplier).offset(skip).limit(limit).all()

def create_supplier(db: Session, supplier: SupplierCreate, user_id: int):
    """
    Creates a new supplier record in the database, linking it to a user.
    """
    db_supplier = Supplier(
        supplier_id=supplier.supplier_id, # Use the supplier_id from the Pydantic model (generated upstream if None)
        name=supplier.name,
        contact_person=supplier.contact_person,
        phone_number=supplier.phone_number,
        email=supplier.email,
        user_id=user_id # Assign the user_id
    )
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier
