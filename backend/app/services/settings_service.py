"""
Settings service for application configuration.
"""

import logging
from typing import Dict, Any, Optional, List
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from ..db.models import SettingsModel
from ..db import session as db_session
from ..core.config import settings as app_settings

# Default settings with descriptions
DEFAULT_SETTINGS = {
    # Telecomunicaciones
    "teleco_meta_aprobacion": {
        "value": "50",
        "description": "Meta de aprobacion para Telecomunicaciones (%)",
        "category": "telecomunicaciones"
    },
    # Nuevas Conexiones
    "nncc_meta_efectividad": {
        "value": "85",
        "description": "Meta de efectividad para Nuevas Conexiones (%)",
        "category": "nuevas_conexiones"
    },
    # Lecturas
    "lecturas_meta_plazo": {
        "value": "90",
        "description": "Meta de cumplimiento de plazo para Lecturas (%)",
        "category": "lecturas"
    },
    # Control de Perdidas
    "calidad_meta_normalidad": {
        "value": "80",
        "description": "Meta de normalidad para Control de Perdidas (%)",
        "category": "control_perdidas"
    },
    # Corte y Reposicion
    "corte_meta_efectividad": {
        "value": "85",
        "description": "Meta de efectividad para Corte y Reposicion (%)",
        "category": "corte_reposicion"
    },
    # General
    "exportacion_limite_registros": {
        "value": "50000",
        "description": "Limite maximo de registros para exportacion",
        "category": "general"
    },
    "cache_ttl_stats": {
        "value": "60",
        "description": "Tiempo de cache para estadisticas (segundos)",
        "category": "general"
    },
}

# In-memory cache (always used as fallback)
_settings_cache: Dict[str, str] = {}
_use_db = bool(app_settings.DATABASE_URL)


def _init_memory_settings():
    """Initialize in-memory settings with defaults."""
    global _settings_cache
    for key, data in DEFAULT_SETTINGS.items():
        if key not in _settings_cache:
            _settings_cache[key] = data["value"]


# Always initialize memory cache
_init_memory_settings()


async def get_all_settings() -> List[Dict[str, Any]]:
    """Get all settings."""
    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                result = await session.execute(select(SettingsModel))
                db_settings = {s.key: s for s in result.scalars().all()}

                # Merge with defaults
                all_settings = []
                for key, default in DEFAULT_SETTINGS.items():
                    if key in db_settings:
                        s = db_settings[key]
                        all_settings.append({
                            "key": s.key,
                            "value": s.value,
                            "description": s.description or default["description"],
                            "category": s.category or default["category"],
                        })
                    else:
                        all_settings.append({
                            "key": key,
                            "value": default["value"],
                            "description": default["description"],
                            "category": default["category"],
                        })
                return all_settings
        except Exception as e:
            logger.warning("Failed to read settings from DB: %s", e)

    # In-memory mode or DB error fallback
    return [
        {
            "key": key,
            "value": _settings_cache.get(key, default["value"]),
            "description": default["description"],
            "category": default["category"],
        }
        for key, default in DEFAULT_SETTINGS.items()
    ]


async def get_setting(key: str) -> Optional[str]:
    """Get a single setting value."""
    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                result = await session.execute(
                    select(SettingsModel.value).where(SettingsModel.key == key)
                )
                row = result.scalar_one_or_none()
                if row is not None:
                    return row
        except Exception as e:
            logger.warning("Failed to read setting '%s' from DB: %s", key, e)
    else:
        if key in _settings_cache:
            return _settings_cache[key]

    # Return default if not found
    if key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]["value"]
    return None


async def get_setting_int(key: str, default: int = 0) -> int:
    """Get a setting as integer."""
    value = await get_setting(key)
    try:
        return int(value) if value else default
    except (ValueError, TypeError):
        return default


async def get_setting_float(key: str, default: float = 0.0) -> float:
    """Get a setting as float."""
    value = await get_setting(key)
    try:
        return float(value) if value else default
    except (ValueError, TypeError):
        return default


async def update_setting(key: str, value: str) -> bool:
    """Update a setting value."""
    # Always update in-memory cache
    _settings_cache[key] = value

    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                # Check if exists
                result = await session.execute(
                    select(SettingsModel).where(SettingsModel.key == key)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    existing.value = value
                else:
                    # Create new
                    default = DEFAULT_SETTINGS.get(key, {})
                    new_setting = SettingsModel(
                        key=key,
                        value=value,
                        description=default.get("description"),
                        category=default.get("category"),
                    )
                    session.add(new_setting)

                await session.commit()
        except Exception as e:
            logger.warning("Failed to save setting '%s' to DB: %s", key, e)

    return True


async def update_settings_batch(settings: Dict[str, str]) -> bool:
    """Update multiple settings at once."""
    for key, value in settings.items():
        await update_setting(key, value)
    return True


async def get_fechas_envio_base() -> dict[str, str]:
    """Get all nncc_fecha_envio_base:* settings as {base_name: date_str}."""
    prefix = "nncc_fecha_envio_base:"
    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                result = await session.execute(
                    select(SettingsModel).where(SettingsModel.key.like(f"{prefix}%"))
                )
                return {
                    s.key[len(prefix):]: s.value
                    for s in result.scalars().all()
                    if s.value
                }
        except Exception as e:
            logger.warning("Failed settings DB operation: %s", e)
    return {
        k[len(prefix):]: v
        for k, v in _settings_cache.items()
        if k.startswith(prefix) and v
    }


async def set_fechas_envio_base(fechas: dict[str, str]) -> bool:
    """Save fecha_envio for multiple bases. fechas = {base_name: 'YYYY-MM-DD'}."""
    for base_name, fecha in fechas.items():
        key = f"nncc_fecha_envio_base:{base_name}"
        DEFAULT_SETTINGS[key] = {
            "value": fecha,
            "description": f"Fecha envio base {base_name}",
            "category": "nuevas_conexiones",
        }
        await update_setting(key, fecha)
    return True


async def reset_to_defaults() -> bool:
    """Reset all settings to defaults."""
    # Always reset in-memory cache
    _init_memory_settings()

    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                await session.execute(delete(SettingsModel))
                await session.commit()
        except Exception as e:
            logger.warning("Failed to reset settings in DB: %s", e)

    return True
