from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional, List
from datetime import datetime
import re

UserRole = Literal["admin", "editor", "viewer"]

# Módulos disponibles en el sistema
AVAILABLE_MODULES = [
    "dashboard",
    "nuevas-conexiones",
    "lecturas",
    "telecomunicaciones",
    "corte-reposicion",
    "control-perdidas",
]


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = "viewer"
    is_active: bool = True
    allowed_modules: List[str] = AVAILABLE_MODULES.copy()  # Por defecto todos los módulos


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

    @field_validator('allowed_modules')
    @classmethod
    def validate_modules(cls, v: List[str]) -> List[str]:
        invalid = [m for m in v if m not in AVAILABLE_MODULES]
        if invalid:
            raise ValueError(f'Módulos inválidos: {invalid}')
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    allowed_modules: Optional[List[str]] = None

    @field_validator('allowed_modules')
    @classmethod
    def validate_modules(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            invalid = [m for m in v if m not in AVAILABLE_MODULES]
            if invalid:
                raise ValueError(f'Módulos inválidos: {invalid}')
        return v


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
