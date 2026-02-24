from datetime import datetime, timedelta
import random
from faker import Faker
from sqlalchemy.orm import Session

from db.base import Merchant, Supplier # Import Supplier
from db.session import SessionLocal, engine
from trust_score_engine import calculate_trust_score

# Ensure tables are created
from db.base import Base
Base.metadata.create_all(bind=engine)

fake = Faker()

def generate_mock_merchant_data(num_merchants: int = 5):
    merchants_data = []
    for _ in range(num_merchants):
        avg_daily_sales = round(random.uniform(500, 5000), 2)
        consistency = round(random.uniform(0.4, 0.95), 2) # Sales consistency
        days_active = random.randint(30, 365)
        
        score_data = calculate_trust_score(avg_daily_sales, consistency, days_active)

        merchants_data.append({
            "merchant_id": f"MER-{fake.unique.random_number(digits=5)}",
            "name": fake.company(),
            "business_type": random.choice(["Kibanda", "Duka", "Wholesaler", "Restaurant"]),
            "contact_person": fake.name(),
            "phone_number": fake.phone_number(),
            "email": fake.email(),
            "avg_daily_sales": avg_daily_sales,
            "consistency": consistency,
            "days_active": days_active,
            "trust_score": score_data["score"],
            "credit_limit": score_data["credit_limit"],
            "onboarded_at": fake.date_time_between(start_date='-1y', end_date='now')
        })
    return merchants_data

def seed_merchants(db: Session, num_merchants: int = 5):
    print(f"Seeding {num_merchants} mock merchants...")
    mock_merchants = generate_mock_merchant_data(num_merchants)
    for merchant_data in mock_merchants:
        # Check if merchant_id already exists to prevent duplicates on re-run
        existing_merchant = db.query(Merchant).filter(Merchant.merchant_id == merchant_data["merchant_id"]).first()
        if not existing_merchant:
            merchant = Merchant(**merchant_data)
            db.add(merchant)
            print(f"Added merchant: {merchant.name} (ID: {merchant.merchant_id})")
        else:
            print(f"Merchant with ID {merchant_data['merchant_id']} already exists, skipping.")
    db.commit()
    print("Merchant seeding complete.")

def generate_mock_supplier_data(num_suppliers: int = 3):
    suppliers_data = []
    for _ in range(num_suppliers):
        suppliers_data.append({
            "supplier_id": f"SUP-{fake.unique.random_number(digits=4)}",
            "name": fake.company() + " Supplies",
            "contact_person": fake.name(),
            "phone_number": fake.phone_number(),
            "email": fake.email(),
            "onboarded_at": fake.date_time_between(start_date='-6m', end_date='now')
        })
    return suppliers_data

def seed_suppliers(db: Session, num_suppliers: int = 3):
    print(f"Seeding {num_suppliers} mock suppliers...")
    mock_suppliers = generate_mock_supplier_data(num_suppliers)
    for supplier_data in mock_suppliers:
        existing_supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_data["supplier_id"]).first()
        if not existing_supplier:
            supplier = Supplier(**supplier_data)
            db.add(supplier)
            print(f"Added supplier: {supplier.name} (ID: {supplier.supplier_id})")
        else:
            print(f"Supplier with ID {supplier_data['supplier_id']} already exists, skipping.")
    db.commit()
    print("Supplier seeding complete.")

if __name__ == "__main__":
    # To run this seeder:
    # 1. cd backend
    # 2. pip install Faker # if not already installed (already in requirements.txt now)
    # 3. python seeder.py
    # This will create/update the 'lipwa_trust.db' file with mock data.
    db = SessionLocal()
    try:
        seed_merchants(db, num_merchants=10)
        seed_suppliers(db, num_suppliers=3) # Seed suppliers too
    finally:
        db.close()
