from fastapi import APIRouter
from .auth import router as auth_router
from .nuevas_conexiones import router as nuevas_conexiones_router
from .medidores_cruzados import router as medidores_cruzados_router
from .lecturas import router as lecturas_router
from .lectura_ipal import router as lectura_ipal_router
from .lectura_preventivas import router as lectura_preventivas_router
from .lectura_refacturaciones import router as lectura_refacturaciones_router
from .lectura_correos import router as lectura_correos_router
from .teleco import router as teleco_router
from .dashboard import router as dashboard_router
from .calidad import router as calidad_router
from .corte import router as corte_router
from .admin import router as admin_router
from .settings import router as settings_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(nuevas_conexiones_router)
api_router.include_router(medidores_cruzados_router)
api_router.include_router(lecturas_router)
api_router.include_router(lectura_ipal_router)
api_router.include_router(lectura_preventivas_router)
api_router.include_router(lectura_refacturaciones_router)
api_router.include_router(lectura_correos_router)
api_router.include_router(teleco_router)
api_router.include_router(dashboard_router)
api_router.include_router(calidad_router)
api_router.include_router(corte_router)
api_router.include_router(admin_router)
api_router.include_router(settings_router)
