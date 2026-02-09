from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional
from datetime import datetime
import re

UserRole = Literal["admin", "editor", "viewer"]


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = "viewer"
    is_active: bool = True


class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('La contrasena debe tener al menos 8 caracteres')
        if not re.search(r'[A-Z]', v):
            raise ValueError('La contrasena debe tener al menos una mayuscula')
        if not re.search(r'\d', v):
            raise ValueError('La contrasena debe tener al menos un digito')
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserInDB(User):
    hashed_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
