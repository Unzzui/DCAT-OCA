from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime

UserRole = Literal["admin", "editor", "viewer"]


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = "viewer"
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserInDB(User):
    hashed_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
