from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings

# For SQLite, use connect_args to allow multiple threads to access the database
engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
