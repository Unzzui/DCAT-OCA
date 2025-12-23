from fastapi import APIRouter, HTTPException, status, Depends
from ...schemas.user import User, LoginRequest
from ...schemas.token import Token
from ...services.user_service import authenticate_user
from ...core.security import create_access_token
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticacion"])


@router.post("/login", response_model=dict)
async def login(credentials: LoginRequest):
    """Authenticate user and return access token."""
    user = authenticate_user(credentials.email, credentials.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contrasena incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": User.model_validate(user).model_dump()
    }


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information."""
    return current_user


@router.post("/logout")
async def logout():
    """Logout user (client should remove token)."""
    return {"message": "Sesion cerrada exitosamente"}
