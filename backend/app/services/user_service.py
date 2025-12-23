from typing import Optional, List
from datetime import datetime
from ..schemas.user import User, UserCreate, UserInDB, LoginRequest
from ..core.security import get_password_hash, verify_password

# In-memory user storage (replace with database in production)
USERS_DB: dict[str, UserInDB] = {}

# Create default admin user
def init_default_users():
    if "admin@ocaglobal.com" not in USERS_DB:
        admin = UserInDB(
            id=1,
            email="admin@ocaglobal.com",
            full_name="Administrador",
            role="admin",
            is_active=True,
            created_at=datetime.utcnow(),
            hashed_password=get_password_hash("admin123"),
        )
        USERS_DB[admin.email] = admin

    if "editor@ocaglobal.com" not in USERS_DB:
        editor = UserInDB(
            id=2,
            email="editor@ocaglobal.com",
            full_name="Editor",
            role="editor",
            is_active=True,
            created_at=datetime.utcnow(),
            hashed_password=get_password_hash("editor123"),
        )
        USERS_DB[editor.email] = editor

    if "viewer@ocaglobal.com" not in USERS_DB:
        viewer = UserInDB(
            id=3,
            email="viewer@ocaglobal.com",
            full_name="Visualizador",
            role="viewer",
            is_active=True,
            created_at=datetime.utcnow(),
            hashed_password=get_password_hash("viewer123"),
        )
        USERS_DB[viewer.email] = viewer


def get_user_by_email(email: str) -> Optional[UserInDB]:
    return USERS_DB.get(email)


def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(user_data: UserCreate) -> User:
    user_id = len(USERS_DB) + 1
    user = UserInDB(
        id=user_id,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active,
        created_at=datetime.utcnow(),
        hashed_password=get_password_hash(user_data.password),
    )
    USERS_DB[user.email] = user
    return User.model_validate(user)


def get_all_users() -> List[User]:
    return [User.model_validate(user) for user in USERS_DB.values()]


# Initialize default users
init_default_users()
