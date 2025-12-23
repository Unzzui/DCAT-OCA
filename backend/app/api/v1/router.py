from fastapi import APIRouter
from .auth import router as auth_router
from .nuevas_conexiones import router as nuevas_conexiones_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(nuevas_conexiones_router)
