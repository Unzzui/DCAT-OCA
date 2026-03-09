"""
Settings API endpoints.
"""

from typing import Dict, List, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ...services import settings_service
from ...schemas.user import User
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingsBatchUpdate(BaseModel):
    settings: Dict[str, str]


@router.get("")
async def get_all_settings(current_user: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Get all application settings."""
    return await settings_service.get_all_settings()


@router.put("")
async def update_settings_batch(
    data: SettingsBatchUpdate,
    admin: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Update multiple settings at once (admin only)."""
    success = await settings_service.update_settings_batch(data.settings)
    if success:
        return {"message": "Configuraciones actualizadas", "count": len(data.settings)}
    raise HTTPException(status_code=500, detail="Error al actualizar configuraciones")


@router.get("/fechas-envio-base")
async def get_fechas_envio_base(
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """Get all configured fecha_envio per NNCC base."""
    return await settings_service.get_fechas_envio_base()


class FechasEnvioUpdate(BaseModel):
    fechas: Dict[str, str]


@router.put("/fechas-envio-base")
async def update_fechas_envio_base(
    data: FechasEnvioUpdate,
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Save fecha_envio for NNCC bases (admin only)."""
    await settings_service.set_fechas_envio_base(data.fechas)
    return {"message": "Fechas actualizadas", "count": len(data.fechas)}


@router.post("/reset")
async def reset_settings(admin: User = Depends(require_admin)) -> Dict[str, Any]:
    """Reset all settings to defaults (admin only)."""
    success = await settings_service.reset_to_defaults()
    if success:
        return {"message": "Configuraciones restauradas a valores por defecto"}
    raise HTTPException(status_code=500, detail="Error al restaurar configuraciones")


@router.get("/{key}")
async def get_setting(key: str, current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Get a specific setting."""
    value = await settings_service.get_setting(key)
    if value is None:
        raise HTTPException(status_code=404, detail="Configuracion no encontrada")
    return {"key": key, "value": value}


@router.put("/{key}")
async def update_setting(
    key: str,
    data: SettingUpdate,
    admin: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Update a specific setting (admin only)."""
    success = await settings_service.update_setting(key, data.value)
    if success:
        return {"message": "Configuracion actualizada", "key": key, "value": data.value}
    raise HTTPException(status_code=500, detail="Error al actualizar configuracion")
