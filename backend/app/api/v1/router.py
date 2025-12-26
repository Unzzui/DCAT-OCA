from fastapi import APIRouter
from .auth import router as auth_router
from .nuevas_conexiones import router as nuevas_conexiones_router
from .lecturas import router as lecturas_router
from .teleco import router as teleco_router
from .dashboard import router as dashboard_router
from .calidad import router as calidad_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(nuevas_conexiones_router)
api_router.include_router(lecturas_router)
api_router.include_router(teleco_router)
api_router.include_router(dashboard_router)
api_router.include_router(calidad_router)
