from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError

from ..schemas.user import User, UserCreate, UserInDB, UserUpdate
from ..core.security import get_password_hash, verify_password, verify_password_async
from ..db.models import UserModel
from ..core.config import settings


# ============================================================
# In-memory fallback (used when DATABASE_URL is not configured)
# ============================================================
_USERS_DB: dict[str, UserInDB] = {}
_use_db = bool(settings.DATABASE_URL)

# Pre-computed bcrypt hashes for default users (avoids blocking on startup)
# These are bcrypt hashes - regenerate if passwords change
_DEFAULT_HASHES = {
    "Admin123": "$2b$12$vrtCUgCS.UDlaLKol4dJMukfCKN2AvREQva4qmJQZKdqTwYHEnqiW",
    "Diego123": "$2b$12$YQvYQiEtRP7zAghRxlgf2OlL0J9l5Y4O8Ap.eGdzAUBkUaDbpPAOC",
    "Editor123": "$2b$12$rBzuTxYLKIbMJV0vfhwoMuSTjU1YoKgjpoa.moHou5zN7Ojw0H30O",
    "Viewer123": "$2b$12$MH5HBG/TC6k3qNrroUK9OuAgvVcqyVUkcBklAXMDzOW0v0XM1K2Zm",
}


def _init_default_users_memory():
    """Initialize in-memory users for development without DB."""
    now = datetime.utcnow()
    if "admin@ocaglobal.com" not in _USERS_DB:
        _USERS_DB["admin@ocaglobal.com"] = UserInDB(
            id=1, email="admin@ocaglobal.com", full_name="Administrador",
            role="admin", is_active=True, created_at=now,
            hashed_password=_DEFAULT_HASHES["Admin123"],
        )
    if "diego.bravob@ocaglobal.com" not in _USERS_DB:
        _USERS_DB["diego.bravob@ocaglobal.com"] = UserInDB(
            id=2, email="diego.bravob@ocaglobal.com", full_name="Diego Bravo",
            role="admin", is_active=True, created_at=now,
            hashed_password=_DEFAULT_HASHES["Diego123"],
        )
    if "editor@ocaglobal.com" not in _USERS_DB:
        _USERS_DB["editor@ocaglobal.com"] = UserInDB(
            id=3, email="editor@ocaglobal.com", full_name="Editor",
            role="editor", is_active=True, created_at=now,
            hashed_password=_DEFAULT_HASHES["Editor123"],
        )
    if "viewer@ocaglobal.com" not in _USERS_DB:
        _USERS_DB["viewer@ocaglobal.com"] = UserInDB(
            id=4, email="viewer@ocaglobal.com", full_name="Visualizador",
            role="viewer", is_active=True, created_at=now,
            hashed_password=_DEFAULT_HASHES["Viewer123"],
        )


# Initialize memory users if no DB
if not _use_db:
    _init_default_users_memory()


# ============================================================
# Database-backed functions (async)
# ============================================================

async def get_user_by_email_db(db: AsyncSession, email: str) -> Optional[UserInDB]:
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()
    if user:
        return UserInDB(
            id=user.id, email=user.email, full_name=user.full_name,
            role=user.role, is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login=user.last_login,
            hashed_password=user.hashed_password,
        )
    return None


async def authenticate_user_db(db: AsyncSession, email: str, password: str) -> Optional[UserInDB]:
    user = await get_user_by_email_db(db, email)
    if not user:
        return None
    # Use async verification to avoid blocking the event loop
    if not await verify_password_async(password, user.hashed_password):
        return None
    # Update last_login
    await db.execute(
        update(UserModel).where(UserModel.email == email).values(last_login=datetime.utcnow())
    )
    await db.commit()
    return user


async def create_user_db(db: AsyncSession, user_data: UserCreate) -> User:
    user = UserModel(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active,
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return User(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_active=user.is_active, created_at=user.created_at,
        updated_at=user.updated_at, last_login=user.last_login,
    )


async def update_user_db(db: AsyncSession, user_id: int, data: dict) -> Optional[User]:
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"]
    if "role" in data and data["role"] is not None:
        user.role = data["role"]
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    if "email" in data and data["email"] is not None:
        user.email = data["email"]
    if "password" in data and data["password"]:
        user.hashed_password = get_password_hash(data["password"])

    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    return User(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_active=user.is_active, created_at=user.created_at,
        updated_at=user.updated_at, last_login=user.last_login,
    )


async def delete_user_db(db: AsyncSession, user_id: int) -> bool:
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return False
    await db.delete(user)
    await db.commit()
    return True


async def get_all_users_db(db: AsyncSession) -> List[User]:
    result = await db.execute(select(UserModel).order_by(UserModel.id))
    users = result.scalars().all()
    return [
        User(
            id=u.id, email=u.email, full_name=u.full_name,
            role=u.role, is_active=u.is_active, created_at=u.created_at,
            updated_at=u.updated_at, last_login=u.last_login,
        )
        for u in users
    ]


async def seed_default_admin(db: AsyncSession):
    """Create default admin if users table is empty."""
    result = await db.execute(select(UserModel))
    if result.first() is None:
        admin = UserModel(
            email="diego.bravob@ocaglobal.com",
            full_name="Diego Bravo",
            hashed_password=get_password_hash("Diego123"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print("Default admin user created: diego.bravob@ocaglobal.com")


# ============================================================
# Compatibility layer (works with both DB and in-memory)
# ============================================================

def get_user_by_email(email: str) -> Optional[UserInDB]:
    """Sync version for in-memory fallback only."""
    return _USERS_DB.get(email)


def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
    """Sync version for in-memory fallback only."""
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def authenticate_user_memory_async(email: str, password: str) -> Optional[UserInDB]:
    """Async version for in-memory fallback - doesn't block event loop."""
    user = get_user_by_email(email)
    if not user:
        return None
    if not await verify_password_async(password, user.hashed_password):
        return None
    return user


def create_user(user_data: UserCreate) -> User:
    """Sync version for in-memory fallback only."""
    user_id = max((u.id for u in _USERS_DB.values()), default=0) + 1
    user = UserInDB(
        id=user_id, email=user_data.email, full_name=user_data.full_name,
        role=user_data.role, is_active=user_data.is_active,
        created_at=datetime.utcnow(),
        hashed_password=get_password_hash(user_data.password),
    )
    _USERS_DB[user.email] = user
    return User.model_validate(user)


def get_all_users() -> List[User]:
    """Sync version for in-memory fallback only."""
    return [User.model_validate(user) for user in _USERS_DB.values()]


def update_user(user_id: int, data: dict) -> Optional[User]:
    """Sync version for in-memory fallback only."""
    for email, user in list(_USERS_DB.items()):
        if user.id == user_id:
            if "full_name" in data:
                user.full_name = data["full_name"]
            if "role" in data:
                user.role = data["role"]
            if "is_active" in data:
                user.is_active = data["is_active"]
            if "email" in data and data["email"] != email:
                _USERS_DB[data["email"]] = user
                user.email = data["email"]
                del _USERS_DB[email]
            if "password" in data:
                user.hashed_password = get_password_hash(data["password"])
            return User.model_validate(user)
    return None


def delete_user(user_id: int) -> bool:
    """Sync version for in-memory fallback only."""
    for email, user in list(_USERS_DB.items()):
        if user.id == user_id:
            del _USERS_DB[email]
            return True
    return False
