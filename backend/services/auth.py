"""
JWT Authentication Service.
Handles registration, login, and token validation.
"""

import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.database import create_user, get_user_by_username, get_user_by_id

SECRET_KEY = os.getenv("JWT_SECRET", "newscurator-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def register(username: str, password: str, display_name: str = "") -> dict:
    """Register a new user. Returns user info + token."""
    existing = await get_user_by_username(username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_id = f"user_{uuid.uuid4().hex[:8]}"
    hashed = hash_password(password)
    display = display_name or username.title()

    await create_user(user_id, username, display, hashed)
    token = create_access_token(user_id, username)

    return {
        "user_id": user_id,
        "username": username,
        "display_name": display,
        "token": token,
    }


async def login(username: str, password: str) -> dict:
    """Authenticate and return token."""
    user = await get_user_by_username(username)
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"], user["username"])
    return {
        "user_id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "token": token,
    }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """FastAPI dependency: extract current user from JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict | None:
    """FastAPI dependency: extract user if token present, None otherwise."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if not payload:
            return None
        return await get_user_by_id(payload["sub"])
    except Exception:
        return None


async def seed_demo_accounts():
    """Create demo accounts for simulation."""
    demos = [
        ("tech_enthusiast", "demo123", "Tech Enthusiast", "user_1"),
        ("sports_fan", "demo123", "Sports Fan", "user_2"),
        ("business_reader", "demo123", "Business Reader", "user_3"),
        ("entertainment_lover", "demo123", "Entertainment Lover", "user_4"),
        ("general_reader", "demo123", "General Reader", "user_5"),
    ]
    for username, password, display_name, user_id in demos:
        existing = await get_user_by_username(username)
        if not existing:
            hashed = hash_password(password)
            await create_user(user_id, username, display_name, hashed, is_demo=True)
