from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from core.config import settings
from core.security import ALGORITHM
from db.session import SessionLocal
from crud import user as crud_user
from models.user import User

# OAuth2PasswordBearer is used for FastAPI to handle the token in the header,
# but we will manually extract from cookies. The scheme is still useful for docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = request.cookies.get("access_token") # Extract token from HTTP-only cookie
    if not token:
        # Fallback to header for tools like Swagger UI if cookie isn't available
        token = await oauth2_scheme(request)
        if not token:
            raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = crud_user.get_user_by_email(db, email=user_email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

async def get_current_merchant_user(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_merchant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a merchant user")
    return current_user

async def get_current_supplier_user(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_supplier:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a supplier user")
    return current_user
